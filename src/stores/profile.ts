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

  // Getters
  const currentStatus = computed(() => profile.value?.status?.status);
  const customStatus = computed(() => profile.value?.status?.custom_message);
  const availableLanguages = computed(() => {
    if (!languagesData.value) return [];
    return languagesData.value.supported_locales.map(code => ({
      code,
      name: languagesData.value!.language_names[code] || code,
      native_name: languagesData.value!.language_names[code] || code,
    }));
  });

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

  return {
    // State
    profile,
    availableStatuses,
    languagesData,
    isLoading,
    error,

    // Getters
    currentStatus,
    customStatus,
    availableLanguages,

    // Actions
    fetchProfile,
    setUsername,
    setStatus,
    fetchAvailableStatuses,
    fetchLanguages,
    updateLocale,
    clearError,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useProfileStore, import.meta.hot));
}
