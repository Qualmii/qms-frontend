import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { User } from '@/types/api';
import { apiClient } from '@/services/api';
import { webSocketService } from '@/services/websocket';

export const useAuthStore = defineStore('auth', () => {
  // State
  const user = ref<User | null>(null);
  const token = ref<string | null>(null);
  const isAuthenticated = computed(() => !!token.value && !!user.value);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // Actions
  const initializeAuth = () => {
    const storedToken = localStorage.getItem('auth_token');
    const storedUser = localStorage.getItem('user');

    if (storedToken && storedUser) {
      token.value = storedToken;
      user.value = JSON.parse(storedUser);
    }
  };

  const login = async (login: string, password: string, deviceName?: string) => {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await apiClient.login({ login, password, device_name: deviceName });

      if (response.data.requires_confirmation) {
        return { requiresConfirmation: true, message: response.data.message };
      }

      if (response.data.access_token && response.data.user) {
        setAuthData(response.data.access_token, response.data.user);
        return { success: true };
      }

      throw new Error('Invalid response format');
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Login failed';
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  const confirmLogin = async (confirmationToken: string) => {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await apiClient.confirmLogin({ token: confirmationToken });
      setAuthData(response.data.access_token, response.data.user);
      return { success: true };
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Confirmation failed';
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  const register = async (name: string, email: string, password: string, passwordConfirmation: string) => {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await apiClient.register({
        name,
        email,
        password,
        password_confirmation: passwordConfirmation,
      });
      return { success: true, message: response.data.message, requiresConfirmation: true };
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Registration failed';
      throw err;
    } finally {
      isLoading.value = false;
    }
  };  const logout = async () => {
    try {
      await apiClient.logout();
    } catch (err) {
      // Ignore logout errors
    } finally {
      webSocketService.disconnect();
      clearAuthData();
    }
  };

  const refreshUser = async () => {
    if (!isAuthenticated.value) return;

    try {
      const response = await apiClient.getCurrentUser();
      user.value = response.data;
      localStorage.setItem('user', JSON.stringify(response.data));
    } catch (err) {
      // If refresh fails, logout
      clearAuthData();
    }
  };

  const setAuthData = (newToken: string, newUser: User) => {
    token.value = newToken;
    user.value = newUser;

    localStorage.setItem('auth_token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));

    error.value = null;
  };

  const clearAuthData = () => {
    token.value = null;
    user.value = null;

    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');

    error.value = null;
  };

  // Initialize auth on store creation
  initializeAuth();

  return {
    // State
    user,
    token,
    isAuthenticated,
    isLoading,
    error,

    // Actions
    login,
    confirmLogin,
    register,
    logout,
    refreshUser,
    clearAuthData,
  };
});
