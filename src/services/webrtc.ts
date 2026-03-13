const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

export type OnRemoteStreamCallback = (stream: MediaStream) => void;
export type OnIceCandidateCallback = (candidate: RTCIceCandidate) => void;
export type OnConnectionStateChangeCallback = (state: RTCPeerConnectionState) => void;

class WebRTCService {
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private callStartTime: Date | null = null;

  // ─── Медиа ────────────────────────────────────────────────────────────────

  async initializeMedia(constraints: MediaStreamConstraints): Promise<MediaStream> {
    this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
    return this.localStream;
  }

  stopLocalStream(): void {
    this.localStream?.getTracks().forEach((t) => t.stop());
    this.localStream = null;
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  // ─── PeerConnection ───────────────────────────────────────────────────────

  /**
   * Создаёт RTCPeerConnection и навешивает обработчики.
   * Вызывать после initializeMedia().
   */
  createPeerConnection(
    onRemoteStream: OnRemoteStreamCallback,
    onIceCandidate: OnIceCandidateCallback,
    onConnectionStateChange?: OnConnectionStateChangeCallback,
  ): RTCPeerConnection {
    this.closePeerConnection();

    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.remoteStream = new MediaStream();

    // Добавляем локальные треки
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        this.pc!.addTrack(track, this.localStream!);
      });
    }

    // Принимаем удалённые треки
    this.pc.ontrack = (event) => {
      event.streams[0]?.getTracks().forEach((track) => {
        this.remoteStream!.addTrack(track);
      });
      onRemoteStream(this.remoteStream!);
    };

    // ICE-кандидаты
    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        onIceCandidate(event.candidate);
      }
    };

    // Состояние соединения
    if (onConnectionStateChange) {
      this.pc.onconnectionstatechange = () => {
        onConnectionStateChange(this.pc!.connectionState);
      };
    }

    return this.pc;
  }

  /**
   * Создаёт SDP-offer (сторона звонящего).
   * @returns строка SDP для передачи на сервер
   */
  async createOffer(): Promise<string> {
    if (!this.pc) throw new Error('PeerConnection not initialized');

    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);

    // Дожидаемся завершения ICE-gathering для получения полного SDP
    await this.waitForIceGathering();

    return this.pc.localDescription!.sdp;
  }

  /**
   * Устанавливает remote SDP-offer и создаёт SDP-answer (сторона отвечающего).
   * @returns строка SDP-answer для передачи на сервер
   */
  async createAnswer(remoteSdpOffer: string): Promise<string> {
    if (!this.pc) throw new Error('PeerConnection not initialized');

    await this.pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: remoteSdpOffer }));
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);

    await this.waitForIceGathering();

    return this.pc.localDescription!.sdp;
  }

  /**
   * Устанавливает remote SDP-answer (сторона звонящего после получения ответа).
   */
  async setRemoteAnswer(remoteSdpAnswer: string): Promise<void> {
    if (!this.pc) throw new Error('PeerConnection not initialized');
    await this.pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: remoteSdpAnswer }));
    this.callStartTime = new Date();
  }

  /**
   * Добавляет ICE-кандидата, полученного от сервера.
   * candidate — строка (JSON-сериализованный RTCIceCandidateInit).
   */
  async addIceCandidate(candidateStr: string): Promise<void> {
    if (!this.pc) return;
    try {
      const init: RTCIceCandidateInit = JSON.parse(candidateStr);
      await this.pc.addIceCandidate(new RTCIceCandidate(init));
    } catch (err) {
      console.error('Failed to add ICE candidate:', err);
    }
  }

  // ─── Управление звонком ───────────────────────────────────────────────────

  toggleAudio(enabled: boolean): void {
    this.localStream?.getAudioTracks().forEach((t) => (t.enabled = enabled));
  }

  toggleVideo(enabled: boolean): void {
    this.localStream?.getVideoTracks().forEach((t) => (t.enabled = enabled));
  }

  getCallDuration(): number {
    if (!this.callStartTime) return 0;
    return Math.floor((Date.now() - this.callStartTime.getTime()) / 1000);
  }

  endCall(): void {
    this.closePeerConnection();
    this.stopLocalStream();
    this.remoteStream = null;
    this.callStartTime = null;
  }

  // ─── Вспомогательные ─────────────────────────────────────────────────────

  private closePeerConnection(): void {
    if (this.pc) {
      this.pc.ontrack = null;
      this.pc.onicecandidate = null;
      this.pc.onconnectionstatechange = null;
      this.pc.close();
      this.pc = null;
    }
  }

  /** Ждём завершения ICE-gathering (не более 3 с). */
  private waitForIceGathering(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.pc || this.pc.iceGatheringState === 'complete') {
        resolve();
        return;
      }
      const timeout = setTimeout(resolve, 3000);
      this.pc.onicegatheringstatechange = () => {
        if (this.pc?.iceGatheringState === 'complete') {
          clearTimeout(timeout);
          resolve();
        }
      };
    });
  }
}

export const webrtcService = new WebRTCService();
