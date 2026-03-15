import { defineStore, acceptHMRUpdate } from 'pinia';
import { ref, computed } from 'vue';
import type { User, LanguagesResponse } from '@/types/api';
import { apiClient } from '@/services/api';

export const useProfileStore = defineStore('profile', () => {
  // State
  const profile = ref<User | null>(null);
  const availableStatuses = ref<Record<string, string>>({});
  const languagesData = ref<LanguagesResponse | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // Theme state
  const theme = ref<'light' | 'dark'>('light');

  // Getters
  const currentStatus = computed(() => profile.value?.online_status);
  const customStatus = computed(() => profile.value?.custom_status);
  const availableLanguages = computed(() => {
    if (!languagesData.value) return [];
    return languagesData.value.supported_locales.map(code => ({
      code,
      name: languagesData.value!.language_names[code] || code,
      native_name: languagesData.value!.language_names[code] || code,
    }));
  });
  const isDarkMode = computed(() => theme.value === 'dark');

  // Actions
  const fetchProfile = async () => {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await apiClient.getProfile();
      profile.value = response.data;
      return response.data;
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch profile';
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  const setUsername = async (username: string) => {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await apiClient.setUsername(username);
      if (profile.value) {
        profile.value.username = response.data.username;
      }
      return response.data;
    } catch (err: any) {
      error.value = err.message || 'Failed to set username';
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  const deleteUsername = async () => {
    isLoading.value = true;
    error.value = null;

    try {
      await apiClient.deleteUsername();
      if (profile.value) {
        profile.value.username = undefined;
      }
    } catch (err: any) {
      error.value = err.message || 'Failed to delete username';
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  const setStatus = async (status: string, customMessage?: string) => {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await apiClient.setStatus(status, customMessage);
      if (profile.value) {
        profile.value.online_status = response.data.online_status;
        profile.value.custom_status = customMessage ?? null;
      }
      return response.data;
    } catch (err: any) {
      error.value = err.message || 'Failed to set status';
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  const fetchAvailableStatuses = async () => {
    try {
      const response = await apiClient.getAvailableStatuses();
      availableStatuses.value = response.data.statuses;
      return response.data.statuses;
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch statuses';
      throw err;
    }
  };

  const fetchLanguages = async () => {
    try {
      const response = await apiClient.getLanguages();
      languagesData.value = response.data;
      return response.data;
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch languages';
      throw err;
    }
  };

  const updateLocale = async (locale: string) => {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await apiClient.updateLocale(locale);
      if (profile.value) {
        profile.value.locale = locale;
      }
      return response.data;
    } catch (err: any) {
      error.value = err.message || 'Failed to update locale';
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  const clearError = () => {
    error.value = null;
  };

  // Theme actions
  const initializeTheme = () => {
    // Загружаем тему из localStorage или используем системную настройку
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;

    if (savedTheme) {
      theme.value = savedTheme;
    } else {
      // Проверяем системные настройки
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      theme.value = prefersDark ? 'dark' : 'light';
    }

    applyTheme();
  };

  const setTheme = (newTheme: 'light' | 'dark') => {
    theme.value = newTheme;
    localStorage.setItem('theme', newTheme);
    applyTheme();
  };

  const toggleTheme = () => {
    const newTheme = theme.value === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
  };

  const applyTheme = () => {
    // Применяем или удаляем класс 'dark' на документе
    console.log('Applying theme:', theme.value);
    if (theme.value === 'dark') {
      document.documentElement.classList.add('dark');
      console.log('Dark mode enabled');
    } else {
      document.documentElement.classList.remove('dark');
      console.log('Light mode enabled');
    }
  };

  return {
    // State
    profile,
    availableStatuses,
    languagesData,
    isLoading,
    error,
    theme,

    // Getters
    currentStatus,
    customStatus,
    availableLanguages,
    isDarkMode,

    // Actions
    fetchProfile,
    setUsername,
    deleteUsername,
    setStatus,
    fetchAvailableStatuses,
    fetchLanguages,
    updateLocale,
    clearError,
    initializeTheme,
    setTheme,
    toggleTheme,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useProfileStore, import.meta.hot));
}
