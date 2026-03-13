import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Chat, Message, WsMessageSentPayload } from '@/types/api';
import { apiClient } from '@/services/api';
import { webSocketService } from '@/services/websocket';

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

  const createChat = async (type: 'private' | 'group', name?: string, userIds?: string[]) => {
    try {
      const response = await apiClient.createChat({ type, name, user_ids: userIds });
      const newChat = response.data;

      chats.value.unshift(newChat);
      return newChat;
    } catch (err: unknown) {
      error.value = getErrorMessage(err, 'Failed to create chat');
      throw err;
    }
  };

  const selectChat = async (chatId: number) => {
    // Отписываемся от предыдущего канала чата
    if (currentChat.value && currentChat.value.id !== chatId) {
      webSocketService.unsubscribeFromChatChannel(currentChat.value.id);
    }

    const chat = chats.value.find(c => c.id === chatId);
    if (!chat) return;

    currentChat.value = chat;

    // Подписываемся на Reverb-канал нового чата
    webSocketService.subscribeToChatChannel(chatId, handleWsMessageSent);

    // Load messages if not already loaded
    if (!messages.value[chatId]) {
      await fetchMessages(chatId);
    }
  };

  const fetchMessages = async (chatId: number, page = 1) => {
    try {
      const response = await apiClient.getMessages({ chat_id: chatId, page, limit: 50 });
      const newMessages = response.data.data;

      if (page === 1) {
        messages.value[chatId] = newMessages.reverse(); // Reverse to show oldest first
      } else {
        if (!messages.value[chatId]) {
          messages.value[chatId] = [];
        }
        messages.value[chatId]!.unshift(...newMessages.reverse());
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
      if (chat) chat.last_message = fullMessage;

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
      if (!chats.value.find(c => c.id === chat.id)) chats.value.unshift(chat);
      return chat;
    } catch (err: unknown) {
      error.value = getErrorMessage(err, 'Failed to create private chat');
      throw err;
    }
  };

  const getOrCreateFavoritesChat = async () => {
    try {
      const response = await apiClient.getOrCreateFavoritesChat();
      const chat = response.data;
      if (!chats.value.find(c => c.id === chat.id)) chats.value.unshift(chat);
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
    fetchMessages,
    sendMessage,
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
  };
});
