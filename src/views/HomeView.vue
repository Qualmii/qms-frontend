<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const authStore = useAuthStore();

const handleLogout = async () => {
  await authStore.logout();
  router.push('/login');
};
</script>

<template>
  <div class="min-h-screen bg-gray-100">
    <header class="bg-white shadow-sm border-b">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center py-4">
          <h1 class="text-xl font-semibold text-gray-900">QMS - Главная</h1>
          <button
            @click="handleLogout"
            class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Выйти
          </button>
        </div>
      </div>
    </header>

    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="bg-white rounded-lg shadow p-6">
        <h2 class="text-2xl font-bold text-gray-900 mb-4">Добро пожаловать, {{ authStore.user?.name }}!</h2>
        <p class="text-gray-600 mb-4">
          Вы успешно вошли в систему. Здесь будет интерфейс мессенджера.
        </p>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div class="p-4 border rounded-lg">
            <h3 class="font-semibold text-gray-900">Чаты</h3>
            <p class="text-sm text-gray-600">Список ваших чатов</p>
          </div>
          <div class="p-4 border rounded-lg">
            <h3 class="font-semibold text-gray-900">Сообщения</h3>
            <p class="text-sm text-gray-600">Обмен сообщениями</p>
          </div>
          <div class="p-4 border rounded-lg">
            <h3 class="font-semibold text-gray-900">Звонки</h3>
            <p class="text-sm text-gray-600">Видео и аудио звонки</p>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>
