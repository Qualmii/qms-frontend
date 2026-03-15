import { defineStore, acceptHMRUpdate } from 'pinia';
import { ref, computed } from 'vue';
import type { Chat, Message, WsMessageSentPayload, WsUserPresencePayload } from '@/types/api';
import { apiClient } from '@/services/api';
import { webSocketService } from '@/services/websocket';
import { useAuthStore } from '@/stores/auth';

// Вспомогательная функция — извлекает сообщение об ошибке из unknown
function getErrorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

export const useChatStore = defineStore('chat', () => {
  // State
  const chats = ref<Chat[]>([]);
  const currentChat = ref<Chat | null>(null);
  const messages = ref<Record<number, Message[]>>({});
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // Getters
  const sortedChats = computed(() => {
    return [...chats.value].sort((a, b) => {
      const aTime = a.last_message?.created_at || a.created_at;
      const bTime = b.last_message?.created_at || b.created_at;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });
  });

  const getChatById = computed(() => {
    return (chatId: number) => chats.value.find(chat => chat.id === chatId);
  });

  const getMessagesForChat = computed(() => {
    return (chatId: number) => messages.value[chatId] || [];
  });

  // Actions
  const fetchChats = async () => {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await apiClient.getChats();
      chats.value = response.data;
    } catch (err: unknown) {
      error.value = getErrorMessage(err, 'Failed to fetch chats');
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * Обновляет статус пользователя во всех чатах при получении WS-события user.presence.
   */
  const updateUserPresence = (payload: WsUserPresencePayload) => {
    chats.value.forEach(chat => {
      const user = chat.users?.find(u => u.id === payload.user_id);
      if (user) {
        user.status = payload.status;
        user.last_seen_at = payload.last_seen_at;
        if (payload.online_status !== null) user.online_status = payload.online_status ?? undefined;
        user.custom_status = payload.custom_status;
      }
    });
  };

  const createChat = async (type: 'private' | 'group', name?: string, userIds?: string[]) => {
    try {
      const response = await apiClient.createChat({ type, name, user_ids: userIds });
      const newChat = response.data;

      chats.value.unshift(newChat);

      // Подписываемся на канал нового чата
      webSocketService.subscribeToChatChannel(newChat.id, handleWsMessageSent, updateUserPresence);

      return newChat;
    } catch (err: unknown) {
      error.value = getErrorMessage(err, 'Failed to create chat');
      throw err;
    }
  };

  const selectChat = async (chatId: number) => {
    const chat = chats.value.find(c => c.id === chatId);
    if (!chat) return;

    currentChat.value = chat;

    // Load messages if not already loaded
    if (!messages.value[chatId]) {
      await fetchMessages(chatId);
    }

    // Помечаем все сообщения как прочитанные на сервере
    if (chat.unread_count && chat.unread_count > 0) {
      const oldCount = chat.unread_count;
      chat.unread_count = 0; // Сбрасываем счётчик локально для быстрого UI

      try {
        await apiClient.markChatAsRead(chatId);
      } catch (err) {
        console.error('Failed to mark chat as read:', err);
        // Восстанавливаем счётчик при ошибке
        chat.unread_count = oldCount;
      }
    }
  };

  /**
   * Подписывается на каналы всех чатов для получения уведомлений о новых сообщениях
   */
  const subscribeToAllChats = () => {
    chats.value.forEach(chat => {
      webSocketService.subscribeToChatChannel(chat.id, handleWsMessageSent, updateUserPresence);
    });
  };

  /**
   * Отписывается от всех каналов чатов
   */
  const unsubscribeFromAllChats = () => {
    chats.value.forEach(chat => {
      webSocketService.unsubscribeFromChatChannel(chat.id);
    });
  };

  const fetchMessages = async (chatId: number, page = 1) => {
    try {
      const response = await apiClient.getMessages({ chat_id: chatId, page, limit: 50 });
      // Backend returns a plain array sorted asc by created_at
      const newMessages = response.data;

      if (!Array.isArray(newMessages)) {
        console.warn('fetchMessages: unexpected response shape', newMessages);
        messages.value[chatId] = [];
        return;
      }

      if (page === 1) {
        messages.value[chatId] = newMessages;
      } else {
        if (!messages.value[chatId]) {
          messages.value[chatId] = [];
        }
        messages.value[chatId]!.unshift(...newMessages);
      }
    } catch (err: unknown) {
      error.value = getErrorMessage(err, 'Failed to fetch messages');
      throw err;
    }
  };

  const sendMessage = async (
    chatId: number,
    content: string,
    type: Message['type'] = 'text',
  ) => {
    try {
      const response = await apiClient.sendMessage({ chat_id: chatId, content, type });
      const fullMessage = (await apiClient.getMessage(response.data.id)).data;

      if (!messages.value[chatId]) messages.value[chatId] = [];
      messages.value[chatId]!.push(fullMessage);

      const chat = chats.value.find(c => c.id === chatId);
      if (chat) {
        chat.last_message = fullMessage;

        // Сбрасываем счётчик при отправке сообщения
        const hadUnread = chat.unread_count && chat.unread_count > 0;
        if (hadUnread) {
          chat.unread_count = 0;

          // Помечаем на сервере как прочитанные
          try {
            await apiClient.markChatAsRead(chatId);
          } catch (err) {
            console.error('Failed to mark chat as read:', err);
          }
        }
      }

      return fullMessage;
    } catch (err: unknown) {
      error.value = getErrorMessage(err, 'Failed to send message');
      throw err;
    }
  };

  const getOrCreatePrivateChat = async (userId: string) => {
    try {
      const response = await apiClient.getOrCreatePrivateChat(userId);
      const chat = response.data;

      // Find existing chat
      const existingIndex = chats.value.findIndex(c => c.id === chat.id);

      if (existingIndex !== -1) {
        // Update existing chat using splice to ensure reactivity
        chats.value.splice(existingIndex, 1, chat);
      } else {
        // Add new chat to the beginning of the list
        chats.value.unshift(chat);

        // Подписываемся на канал нового чата
        webSocketService.subscribeToChatChannel(chat.id, handleWsMessageSent, updateUserPresence);
      }

      return chat;
    } catch (err: unknown) {
      error.value = getErrorMessage(err, 'Failed to create private chat');
      throw err;
    }
  };

  const sendFileMessage = async (chatId: number, file: File) => {
    const type: Message['type'] = file.type.startsWith('image/') ? 'image'
      : file.type.startsWith('video/') ? 'video'
      : file.type.startsWith('audio/') ? 'voice'
      : 'file';

    // 1. Создаём сообщение (контент = имя файла)
    const sendResp = await apiClient.sendMessage({ chat_id: chatId, content: file.name, type });
    const msgId = (sendResp.data as unknown as { id: number }).id;

    // 2. Загружаем файл к сообщению
    await apiClient.uploadFile(msgId, file);

    // 3. Забираем полное сообщение с вложением
    const fullMessage = (await apiClient.getMessage(msgId)).data;

    if (!messages.value[chatId]) messages.value[chatId] = [];
    messages.value[chatId]!.push(fullMessage);

    const chat = chats.value.find(c => c.id === chatId);
    if (chat) {
      chat.last_message = fullMessage;
    }

    return fullMessage;
  };

  const getOrCreateFavoritesChat = async () => {
    try {
      const response = await apiClient.getOrCreateFavoritesChat();
      const chat = response.data;

      if (!chats.value.find(c => c.id === chat.id)) {
        chats.value.unshift(chat);

        // Подписываемся на канал нового чата
        webSocketService.subscribeToChatChannel(chat.id, handleWsMessageSent, updateUserPresence);
      }

      return chat;
    } catch (err: unknown) {
      error.value = getErrorMessage(err, 'Failed to get favorites chat');
      throw err;
    }
  };

  const addUserToChat = async (chatId: number, userId: string) => {
    try {
      await apiClient.addUserToChat(chatId, userId);
      const chat = chats.value.find(c => c.id === chatId);
      if (chat && !chat.users?.find(u => u.id === userId)) await fetchChats();
    } catch (err: unknown) {
      error.value = getErrorMessage(err, 'Failed to add user to chat');
      throw err;
    }
  };

  const removeUserFromChat = async (chatId: number, userId: string) => {
    try {
      await apiClient.removeUserFromChat(chatId, userId);
      await fetchChats();
    } catch (err: unknown) {
      error.value = getErrorMessage(err, 'Failed to remove user from chat');
      throw err;
    }
  };

  const toggleChatMute = async (chatId: number) => {
    try {
      await apiClient.toggleChatMute(chatId);
      await fetchChats();
    } catch (err: unknown) {
      error.value = getErrorMessage(err, 'Failed to toggle chat mute');
      throw err;
    }
  };

  // WebSocket handlers


  /**
   * Обработчик события message.sent от Reverb.
   * Payload содержит только метаданные — загружаем полный контент через REST.
   */
  const handleWsMessageSent = async (payload: WsMessageSentPayload) => {
    try {
      const response = await apiClient.getMessage(payload.message_id);
      addMessageToChat(response.data);
    } catch (err) {
      console.error('Failed to fetch message after WS event:', err);
    }
  };

  const addMessageToChat = (message: Message) => {
    if (!messages.value[message.chat_id]) {
      messages.value[message.chat_id] = [];
    }

    const chatMessages = messages.value[message.chat_id];
    if (chatMessages) {
      // Avoid duplicates
      if (!chatMessages.find((m) => m.id === message.id)) {
        chatMessages.push(message);
      }
    }

    // Update last message in chat
    const chat = chats.value.find((c) => c.id === message.chat_id);
    if (chat) {
      chat.last_message = message;

      // Увеличиваем счётчик непрочитанных только для оптимистичного обновления UI
      // Реальный счётчик будет обновлён при следующей загрузке чатов с сервера
      if (currentChat.value?.id !== message.chat_id) {
        const authStore = useAuthStore();

        if (message.sender_id !== authStore.user?.id) {
          chat.unread_count = (chat.unread_count || 0) + 1;
        }
      }
    }
  };

  const addChat = (chat: Chat) => {
    if (!chats.value.find(c => c.id === chat.id)) {
      chats.value.unshift(chat);
    }
  };

  const updateChat = (chat: Chat) => {
    const index = chats.value.findIndex(c => c.id === chat.id);
    if (index !== -1) {
      chats.value[index] = chat;
    }

    if (currentChat.value?.id === chat.id) {
      currentChat.value = chat;
    }
  };

  const clearCurrentChat = () => {
    currentChat.value = null;
  };

  const clearError = () => {
    error.value = null;
  };

  return {
    // State
    chats,
    currentChat,
    messages,
    isLoading,
    error,

    // Getters
    sortedChats,
    getChatById,
    getMessagesForChat,

    // Actions
    fetchChats,
    createChat,
    selectChat,
    subscribeToAllChats,
    unsubscribeFromAllChats,
    fetchMessages,
    sendMessage,
    sendFileMessage,
    getOrCreatePrivateChat,
    getOrCreateFavoritesChat,
    addUserToChat,
    removeUserFromChat,
    toggleChatMute,
    addMessageToChat,
    addChat,
    updateChat,
    clearCurrentChat,
    clearError,
    handleWsMessageSent,
    updateUserPresence,
  };
});

// Поддержка Vite HMR — стор обновляется без перезагрузки страницы
if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useChatStore, import.meta.hot));
}

