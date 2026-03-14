import { defineStore, acceptHMRUpdate } from 'pinia';
import { ref, computed } from 'vue';
import type { Call, WsCallUpdatedPayload, CallResponse } from '@/types/api';
import { apiClient } from '@/services/api';
import { webSocketService } from '@/services/websocket';
import { webrtcService } from '@/services/webrtc';

export const useCallStore = defineStore('call', () => {
  // ─── State ─────────────────────────────────────────────────────────────────
  const currentCall = ref<Call | null>(null);
  const incomingCall = ref<Call | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const localStream = ref<MediaStream | null>(null);
  const remoteStream = ref<MediaStream | null>(null);
  const callDuration = ref(0);
  const callDurationInterval = ref<ReturnType<typeof setInterval> | null>(null);

  // ─── Getters ───────────────────────────────────────────────────────────────
  const isCallActive = computed(() => currentCall.value !== null);
  const hasIncomingCall = computed(() => incomingCall.value !== null);

  // ─── WebSocket handler ─────────────────────────────────────────────────────
  /**
   * Единый обработчик события call.updated, приходящего через Reverb.
   * Используется и для канала user.{id}, и для канала call.{uuid}.
   */
  const handleCallUpdated = async (payload: WsCallUpdatedPayload) => {
    switch (payload.status) {
      // Входящий звонок — показываем уведомление
      case 'ringing': {
        incomingCall.value = {
          call_uuid: payload.call_uuid,
          chat_id: payload.chat_id,
          caller_id: payload.caller_id,
          callee_id: payload.callee_id,
          type: payload.type,
          status: 'ringing',
        };
        break;
      }

      // Звонок принят — устанавливаем remote SDP answer (сторона звонящего)
      case 'active': {
        if (currentCall.value?.call_uuid === payload.call_uuid && payload.sdp_answer) {
          try {
            await webrtcService.setRemoteAnswer(payload.sdp_answer);
            currentCall.value.status = 'active';
            startCallTimer();
          } catch (err) {
            console.error('Failed to set remote answer:', err);
          }
        }
        break;
      }

      // Завершение звонка по любой причине
      case 'ended':
      case 'declined':
      case 'missed':
      case 'failed': {
        _cleanupCall();
        break;
      }
    }
  };

  // ─── Инициация звонка ──────────────────────────────────────────────────────
  const initiateCall = async (chatId: number, calleeId: string, type: 'audio' | 'video') => {
    isLoading.value = true;
    error.value = null;

    try {
      localStream.value = await webrtcService.initializeMedia({
        audio: true,
        video: type === 'video' ? { width: 1280, height: 720 } : false,
      });

      // Создаём PeerConnection и получаем SDP-offer
      webrtcService.createPeerConnection(
        (stream) => { remoteStream.value = stream; },
        (candidate) => {
          if (currentCall.value) {
            apiClient
              .addIceCandidate(currentCall.value.call_uuid, JSON.stringify(candidate.toJSON()))
              .catch(console.error);
          }
        },
        (state) => {
          if (state === 'disconnected' || state === 'failed') {
            endCall().catch(console.error);
          }
        },
      );

      const sdpOffer = await webrtcService.createOffer();

      // Отправляем на сервер — он рассылает ringing через Reverb
      const response = await apiClient.initiateCall({ chat_id: chatId, callee_id: calleeId, type, sdp_offer: sdpOffer });
      currentCall.value = response.data;

      // Подписываемся на канал звонка для получения sdp_answer
      webSocketService.subscribeToCallChannel(response.data.call_uuid, handleCallUpdated);

      return response.data;
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Failed to initiate call';
      _cleanupCall();
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  // ─── Ответ на звонок ───────────────────────────────────────────────────────
  const answerCall = async () => {
    if (!incomingCall.value) return;

    isLoading.value = true;
    error.value = null;

    const call = incomingCall.value;

    try {
      localStream.value = await webrtcService.initializeMedia({
        audio: true,
        video: call.type === 'video' ? { width: 1280, height: 720 } : false,
      });

      webrtcService.createPeerConnection(
        (stream) => { remoteStream.value = stream; },
        (candidate) => {
          apiClient
            .addIceCandidate(call.call_uuid, JSON.stringify(candidate.toJSON()))
            .catch(console.error);
        },
        (state) => {
          if (state === 'disconnected' || state === 'failed') {
            endCall().catch(console.error);
          }
        },
      );

      // Получаем sdp_offer через REST (GET /calls/{uuid} возвращает sdp_offer при статусе ringing)
      const callData = await apiClient.getCall(call.call_uuid);
      const sdpOffer = (callData.data as CallResponse).sdp_offer;
      if (!sdpOffer) throw new Error('SDP offer not available');

      const sdpAnswer = await webrtcService.createAnswer(sdpOffer!);
      await apiClient.answerCall(call.call_uuid, sdpAnswer);

      currentCall.value = { ...call, status: 'active' };
      incomingCall.value = null;

      webSocketService.subscribeToCallChannel(call.call_uuid, handleCallUpdated);
      startCallTimer();

      return currentCall.value;
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Failed to answer call';
      _cleanupCall();
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  // ─── Отклонить звонок ──────────────────────────────────────────────────────
  const declineCall = async () => {
    if (!incomingCall.value) return;
    try {
      await apiClient.declineCall(incomingCall.value.call_uuid);
      incomingCall.value = null;
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Failed to decline call';
      throw err;
    }
  };

  // ─── Завершить звонок ──────────────────────────────────────────────────────
  const endCall = async () => {
    if (!currentCall.value) return;
    try {
      await apiClient.endCall(currentCall.value.call_uuid);
    } catch {
      // Игнорируем — всё равно чистим локальное состояние
    } finally {
      _cleanupCall();
    }
  };

  // ─── Управление потоками ───────────────────────────────────────────────────
  const toggleAudio = (enabled: boolean) => webrtcService.toggleAudio(enabled);
  const toggleVideo = (enabled: boolean) => webrtcService.toggleVideo(enabled);

  // ─── Таймер длительности ──────────────────────────────────────────────────
  const startCallTimer = () => {
    stopCallTimer();
    callDurationInterval.value = setInterval(() => { callDuration.value += 1; }, 1000);
  };

  const stopCallTimer = () => {
    if (callDurationInterval.value) {
      clearInterval(callDurationInterval.value);
      callDurationInterval.value = null;
    }
  };

  const formatCallDuration = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  // ─── Приватный хелпер ──────────────────────────────────────────────────────
  const _cleanupCall = () => {
    if (currentCall.value) {
      webSocketService.unsubscribeFromCallChannel(currentCall.value.call_uuid);
    }
    stopCallTimer();
    webrtcService.endCall();
    localStream.value = null;
    remoteStream.value = null;
    currentCall.value = null;
    incomingCall.value = null;
    callDuration.value = 0;
  };

  const clearError = () => { error.value = null; };

  return {
    // State
    currentCall, incomingCall, isLoading, error,
    localStream, remoteStream, callDuration,
    // Getters
    isCallActive, hasIncomingCall,
    // Actions
    initiateCall, answerCall, declineCall, endCall,
    toggleAudio, toggleVideo,
    formatCallDuration, handleCallUpdated,
    clearError,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useCallStore, import.meta.hot));
}
