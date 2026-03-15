<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useChatStore } from '@/stores/chat';
import { useCallStore } from '@/stores/call';
import { useProfileStore } from '@/stores/profile';
import { webSocketService } from '@/services/websocket';
import ChatSearch from '@/components/ChatSearch.vue';
import ChatList from '@/components/ChatList.vue';
import UserSearch from '@/components/UserSearch.vue';
import ChatWindow from '@/components/ChatWindow.vue';
import StatusPicker from '@/components/StatusPicker.vue';

const router = useRouter();
const authStore = useAuthStore();
const chatStore = useChatStore();
const callStore = useCallStore();
const profileStore = useProfileStore();

const selectedChatId = ref<number | null>(null);
const searchQuery = ref('');
const showUserSearch = ref(false);
const isSidebarOpen = ref(true);

// Текущий чат — объект из стора, соответствующий selectedChatId
const currentChatData = computed(() =>
  selectedChatId.value !== null
    ? chatStore.chats.find(c => c.id === selectedChatId.value) ?? null
    : null
);

onMounted(async () => {
  await chatStore.fetchChats();

  // Подписываемся на каналы всех чатов для получения уведомлений о новых сообщениях
  if (webSocketService.isConnected()) {
    chatStore.subscribeToAllChats();
  }

  // Загружаем список статусов один раз — нужен ChatWindow для отображения статуса собеседника
  if (Object.keys(profileStore.availableStatuses).length === 0) {
    profileStore.fetchAvailableStatuses();
  }

  // Подписываемся на личный канал пользователя (входящие звонки, онлайн-статусы)
  if (authStore.user?.id && webSocketService.isConnected()) {
    webSocketService.subscribeToUserChannel(
      authStore.user.id,
      callStore.handleCallUpdated,
      chatStore.updateUserPresence,
    );
  }
});

const handleSearch = (query: string) => {
  searchQuery.value = query;
};

const handleSelectChat = (chatId: number) => {
  selectedChatId.value = chatId;
  chatStore.selectChat(chatId);
  if (window.innerWidth < 768) {
    isSidebarOpen.value = false;
  }
};

const handleCreateChat = async (userId: string) => {
  try {
    const chat = await chatStore.getOrCreatePrivateChat(userId);
    showUserSearch.value = false;
    selectedChatId.value = chat.id;
    chatStore.selectChat(chat.id);
    if (window.innerWidth < 768) {
      isSidebarOpen.value = true;
    }
  } catch (error) {
    console.error('Failed to create chat:', error);
  }
};

const handleLogout = async () => {
  await authStore.logout();
  router.push('/login');
};

const toggleSidebar = () => {
  isSidebarOpen.value = !isSidebarOpen.value;
};
</script>

<template>
  <div class="h-screen flex overflow-hidden bg-gray-100">
    <!-- Sidebar -->
    <div
      class="flex flex-col bg-white border-r border-gray-200 transition-all duration-300"
      :class="[
        isSidebarOpen ? 'w-full md:w-80 lg:w-96' : 'w-0 md:w-0',
        'md:relative absolute inset-y-0 left-0 z-30'
      ]"
    >
      <!-- Sidebar Header -->
      <div class="flex items-center justify-between px-4 py-3 border-b bg-white gap-2">
        <!-- Выбор статуса в стиле ICQ -->
        <StatusPicker class="flex-1 min-w-0" />

        <div class="flex items-center gap-1 shrink-0">
          <button
            @click="showUserSearch = true"
            class="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Поиск контактов"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </button>

          <button
            @click="handleLogout"
            class="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Выйти"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>

          <!-- Close sidebar on mobile -->
          <button
            @click="toggleSidebar"
            class="md:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Search -->
      <ChatSearch @search="handleSearch" />

      <!-- Chat List -->
      <ChatList
        :chats="chatStore.sortedChats"
        :selected-chat-id="selectedChatId"
        :search-query="searchQuery"
        @select-chat="handleSelectChat"
      />
    </div>

    <!-- Main Content -->
    <div class="flex-1 flex flex-col">
      <!-- Mobile Header -->
      <div class="md:hidden flex items-center gap-3 px-4 py-3 bg-white border-b">
        <button
          @click="toggleSidebar"
          class="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <h1 class="text-lg font-semibold text-gray-900">QMS</h1>
      </div>

      <!-- Empty State / Chat Window -->
      <div class="flex-1 flex flex-col overflow-hidden">
        <div v-if="!currentChatData" class="flex-1 flex items-center justify-center bg-gray-50 px-4">
          <div class="text-center">
            <div class="w-24 h-24 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
              <svg class="w-12 h-12 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h2 class="text-2xl font-semibold text-gray-900 mb-2">Добро пожаловать в QMS!</h2>
            <p class="text-gray-600 mb-6">Выберите чат из списка или начните новый диалог</p>
            <button
              @click="showUserSearch = true"
              class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Найти контакты
            </button>
          </div>
        </div>

        <ChatWindow v-else :chat="currentChatData" class="flex-1 min-h-0" />
      </div>
    </div>

    <!-- User Search Modal -->
    <UserSearch
      :show="showUserSearch"
      @close="showUserSearch = false"
      @create-chat="handleCreateChat"
    />
  </div>
</template>
