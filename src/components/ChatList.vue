<script setup lang="ts">
import { computed } from 'vue';
import type { Chat, ChatUser } from '@/types/api';
import { useAuthStore } from '@/stores/auth';
import { getStatusEmoji } from '@/utils/statusConfig';

interface Props {
  chats: Chat[];
  selectedChatId: number | null;
  searchQuery: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  selectChat: [chatId: number]
}>();

const authStore = useAuthStore();

// Filter chats based on search query
const filteredChats = computed(() => {
  if (!props.searchQuery) return props.chats;

  const query = props.searchQuery.toLowerCase();
  return props.chats.filter(chat =>
    getChatName(chat).toLowerCase().includes(query) ||
    chat.last_message?.content?.toLowerCase().includes(query)
  );
});

// Format last message time
const formatTime = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  if (diff < 24 * 60 * 60 * 1000) {
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
};

// Get chat display name
const getChatName = (chat: Chat): string => {
  if (chat.type === 'private') {
    const other = chat.users?.find(u => u.id !== authStore.user?.id);
    return other?.name || other?.username || other?.uin || other?.email || 'Пользователь';
  }
  if (chat.type === 'favorites') return 'Избранное';
  return chat.name || 'Групповой чат';
};

// Get chat avatar initials
const getInitials = (chat: Chat): string => {
  return getChatName(chat).substring(0, 2).toUpperCase();
};

type MessageType = 'text' | 'image' | 'voice' | 'video' | 'file';

const TYPE_LABELS: Record<Exclude<MessageType, 'text'>, string> = {
  image: '🖼 Изображение',
  voice: '🎤 Голосовое сообщение',
  video: '📹 Видео сообщение',
  file:  '📎 Вложение',
};

const getLastMessagePreview = (chat: Chat): string => {
  const msg = chat.last_message;
  if (!msg) return '';
  if (msg.type === 'text') return msg.content || 'Сообщение';
  return TYPE_LABELS[msg.type as Exclude<MessageType, 'text'>] ?? '📎 Вложение';
};

// Собеседник в приватном чате
const getOtherUser = (chat: Chat): ChatUser | undefined =>
  chat.type === 'private'
    ? chat.users?.find(u => u.id !== authStore.user?.id)
    : undefined;
</script>

<template>
  <div class="flex-1 overflow-y-auto">
    <div v-if="filteredChats.length === 0" class="p-4 text-center text-gray-500">
      <p v-if="searchQuery">Чаты не найдены</p>
      <p v-else>Нет чатов</p>
    </div>

    <div
      v-for="chat in filteredChats"
      :key="chat.id"
      class="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors border-b border-gray-100"
      :class="{ 'bg-blue-50': chat.id === selectedChatId }"
      @click="emit('selectChat', chat.id)"
    >
      <!-- Avatar -->
      <div class="relative shrink-0">
        <!-- Фото или инициалы -->
        <div class="w-12 h-12 rounded-full overflow-hidden ring-2 ring-white shadow-sm">
          <img
            v-if="getOtherUser(chat)?.avatar_url"
            :src="getOtherUser(chat)?.avatar_url ?? ''"
            :alt="getChatName(chat)"
            class="w-full h-full object-cover"
          />
          <div
            v-else
            class="w-full h-full bg-linear-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold"
          >
            {{ getInitials(chat) }}
          </div>
        </div>
        <!-- Иконка онлайн-статуса собеседника -->
        <span
          v-if="getOtherUser(chat)?.status === 'online'"
          class="absolute -bottom-0.5 -right-0.5 w-5 h-5 flex items-center justify-center bg-white rounded-full shadow-sm text-xs leading-none"
        >{{ getStatusEmoji(getOtherUser(chat)?.online_status) }}</span>
      </div>

      <!-- Chat Info -->
      <div class="flex-1 min-w-0">
        <div class="flex justify-between items-baseline mb-1">
          <h3 class="font-semibold text-gray-900 truncate">{{ getChatName(chat) }}</h3>
          <span v-if="chat.last_message" class="text-xs text-gray-500 shrink-0 ml-2">
            {{ formatTime(chat.last_message.created_at) }}
          </span>
        </div>
        <p v-if="chat.last_message" class="text-sm truncate"
          :class="chat.last_message.type === 'text' ? 'text-gray-600' : 'text-gray-400 italic'"
        >
          {{ getLastMessagePreview(chat) }}
        </p>
        <p v-else class="text-sm text-gray-400 italic">Нет сообщений</p>
      </div>

      <!-- Unread badge -->
      <div v-if="chat.unread_count && chat.unread_count > 0" class="shrink-0">
        <span
          class="inline-flex items-center justify-center w-6 h-6 text-xs font-bold text-white bg-blue-600 rounded-full"
        >
          {{ (chat.unread_count ?? 0) > 99 ? '99+' : chat.unread_count }}
        </span>
      </div>
    </div>
  </div>
</template>
