<script setup lang="ts">
import { ref } from 'vue';

const searchQuery = ref('');

const emit = defineEmits<{
  search: [query: string]
}>();

const handleSearch = () => {
  emit('search', searchQuery.value);
};
</script>

<template>
  <div class="p-4 border-b border-gray-200 dark:border-gray-700">
    <div class="relative">
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Поиск чатов..."
        class="w-full px-4 py-2 pl-10 bg-gray-100 dark:bg-gray-700 border-0 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:bg-white dark:focus:bg-gray-600 transition-all"
        @input="handleSearch"
      />
      <svg
        class="absolute left-3 top-2.5 w-5 h-5 text-gray-400 dark:text-gray-500"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
    </div>
  </div>
</template>

