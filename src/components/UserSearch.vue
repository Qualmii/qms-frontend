<script setup lang="ts">
import { ref, computed } from 'vue';
import { apiClient } from '@/services/api';
import type { SearchUserResponse } from '@/types/api';

interface Props {
  show: boolean;
}

defineProps<Props>();

const emit = defineEmits<{
  close: []
  createChat: [userId: string]
}>();

const searchQuery = ref('');
const searchResult = ref<SearchUserResponse | null>(null);
const isSearching = ref(false);
const searchError = ref('');

const hasSearched = computed(() => searchResult.value !== null || searchError.value !== '');

const handleSearch = async () => {
  if (!searchQuery.value.trim()) return;

  isSearching.value = true;
  searchError.value = '';
  searchResult.value = null;

  try {
    const response = await apiClient.searchUsers({ query: searchQuery.value });
    searchResult.value = response.data;
  } catch (error: any) {
    if (error?.response?.status === 404) {
      searchError.value = 'Пользователь не найден';
    } else {
      searchError.value = 'Ошибка поиска';
    }
  } finally {
    isSearching.value = false;
  }
};

const handleCreateChat = (userId: string) => {
  emit('createChat', userId);
  closeModal();
};

const closeModal = () => {
  searchQuery.value = '';
  searchResult.value = null;
  searchError.value = '';
  emit('close');
};
</script>

<template>
  <Transition name="modal">
    <div
      v-if="show"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 dark:bg-opacity-70"
      @click.self="closeModal"
    >
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md mx-4">
        <!-- Header -->
        <div class="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Поиск контактов</h2>
          <button
            @click="closeModal"
            class="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Search Input -->
        <div class="p-6">
          <div class="relative">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Email, UIN или имя пользователя..."
              class="w-full px-4 py-3 pr-12 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
              @keyup.enter="handleSearch"
            />
            <button
              @click="handleSearch"
              :disabled="!searchQuery.trim() || isSearching"
              class="absolute right-2 top-2 px-4 py-1.5 bg-blue-600 dark:bg-blue-500 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
            >
              <span v-if="isSearching" class="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
              <span v-else>Найти</span>
            </button>
          </div>
        </div>

        <!-- Results -->
        <div class="px-6 pb-6 max-h-96 overflow-y-auto">
          <!-- Error -->
          <div v-if="searchError" class="text-center text-gray-500 dark:text-gray-400 py-8">
            {{ searchError }}
          </div>

          <!-- Single Result -->
          <div v-else-if="searchResult" class="space-y-2">
            <div
              class="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg cursor-pointer transition-colors"
              @click="handleCreateChat(searchResult.id)"
            >
              <!-- Avatar -->
              <div class="w-12 h-12 rounded-full bg-linear-to-br from-green-500 to-blue-500 flex items-center justify-center text-white font-semibold">
                {{ searchResult.name.substring(0, 2).toUpperCase() }}
              </div>

              <!-- User Info -->
              <div class="flex-1 min-w-0">
                <h4 class="font-semibold text-gray-900 dark:text-white">{{ searchResult.name }}</h4>
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  @{{ searchResult.username || searchResult.uin }}
                </p>
              </div>

              <!-- Add Button -->
              <button class="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors">
                Написать
              </button>
            </div>
          </div>

          <!-- Empty State -->
          <div v-else class="text-center text-gray-500 dark:text-gray-400 py-8">
            Введите email, UIN или имя пользователя для поиска
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>


