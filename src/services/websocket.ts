import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import type {
  WsMessageSentPayload,
  WsCallUpdatedPayload,
  WsUserPresencePayload,
} from '@/types/api';

// Pusher нужен глобально для laravel-echo
(globalThis as Record<string, unknown>).Pusher = Pusher;

type CallUpdatedCallback = (payload: WsCallUpdatedPayload) => void;
type MessageSentCallback = (payload: WsMessageSentPayload) => void;
type UserPresenceCallback = (payload: WsUserPresencePayload) => void;

class WebSocketService {
  private echo: Echo<'reverb'> | null = null;
  /** Список каналов, на которые есть активная подписка */
  private subscribedChannels: Set<string> = new Set();

  // ─── Подключение / отключение ─────────────────────────────────────────────

  connect(token: string): void {
    if (this.echo) return;

    this.echo = new Echo({
      broadcaster: 'reverb',
      key: import.meta.env.VITE_REVERB_APP_KEY as string,
      wsHost: import.meta.env.VITE_REVERB_HOST as string,
      wsPort: Number(import.meta.env.VITE_REVERB_WS_PORT ?? 8080),
      wssPort: Number(import.meta.env.VITE_REVERB_WSS_PORT ?? 443),
      forceTLS: (import.meta.env.VITE_REVERB_SCHEME ?? 'http') === 'https',
      enabledTransports: ['ws', 'wss'],
      authEndpoint: `${import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1'}/broadcasting/auth`,
      auth: {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      },
    });
  }

  disconnect(): void {
    this.echo?.disconnect();
    this.echo = null;
    this.subscribedChannels.clear();
  }


  isConnected(): boolean {
    return this.echo !== null;
  }

  // ─── Приватный канал пользователя: user.{id} ──────────────────────────────

  subscribeToUserChannel(
    userId: string,
    onCallUpdated: CallUpdatedCallback,
    onPresenceChanged?: UserPresenceCallback,
  ): void {
    if (!this.echo) return;

    const channelName = `user.${userId}`;
    if (this.subscribedChannels.has(channelName)) return;

    this.echo
      .private(channelName)
      .listen('.call.updated', onCallUpdated)
      .listen('.user.presence', onPresenceChanged ?? (() => {}));

    this.subscribedChannels.add(channelName);
  }

  unsubscribeFromUserChannel(userId: string): void {
    const channelName = `user.${userId}`;
    this.echo?.leave(channelName);
    this.subscribedChannels.delete(channelName);
  }

  // ─── Приватный канал чата: chat.{id} ──────────────────────────────────────

  subscribeToChatChannel(chatId: number, onMessageSent: MessageSentCallback): void {
    if (!this.echo) return;

    const channelName = `chat.${chatId}`;
    if (this.subscribedChannels.has(channelName)) return;

    this.echo.private(channelName).listen('.message.sent', onMessageSent);
    this.subscribedChannels.add(channelName);
  }

  unsubscribeFromChatChannel(chatId: number): void {
    const channelName = `chat.${chatId}`;
    this.echo?.leave(channelName);
    this.subscribedChannels.delete(channelName);
  }

  // ─── Приватный канал звонка: call.{uuid} ──────────────────────────────────

  subscribeToCallChannel(callUuid: string, onCallUpdated: CallUpdatedCallback): void {
    if (!this.echo) return;

    const channelName = `call.${callUuid}`;
    if (this.subscribedChannels.has(channelName)) return;

    this.echo.private(channelName).listen('.call.updated', onCallUpdated);
    this.subscribedChannels.add(channelName);
  }

  unsubscribeFromCallChannel(callUuid: string): void {
    const channelName = `call.${callUuid}`;
    this.echo?.leave(channelName);
    this.subscribedChannels.delete(channelName);
  }
}

export const webSocketService = new WebSocketService();

