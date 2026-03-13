<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const authStore = useAuthStore();

const login = ref('');
const password = ref('');
const isLoginMode = ref(true); // true - login, false - register
const showConfirmLogin = ref(false);
const confirmationToken = ref('');

// Register fields
const name = ref('');
const email = ref('');
const registerPassword = ref('');
const confirmPassword = ref('');

// Computed
const isPasswordValid = computed(() => password.value.length >= 8 && password.value.length <= 25);
const isRegisterPasswordValid = computed(() => registerPassword.value.length >= 8 && registerPassword.value.length <= 25);
const isConfirmPasswordValid = computed(() => registerPassword.value === confirmPassword.value && confirmPassword.value.length > 0);
const canLogin = computed(() => login.value.trim() && isPasswordValid.value && !authStore.isLoading);
const canRegister = computed(() => name.value.trim() && email.value.trim() && isRegisterPasswordValid.value && isConfirmPasswordValid.value && !authStore.isLoading);

// Actions
const handleLogin = async () => {
  if (!canLogin.value) return;

  try {
    const result = await authStore.login(login.value, password.value);
    if (result.requiresConfirmation) {
      showConfirmLogin.value = true;
    } else if (result.success) {
      // Router guard will redirect to home
    }
  } catch (error) {
    // Error handled in store
  }
};

const handleConfirmLogin = async () => {
  if (!confirmationToken.value.trim()) return;

  try {
    await authStore.confirmLogin(confirmationToken.value);
    // Router guard will redirect to home
  } catch (error) {
    // Error handled in store
  }
};

const handleRegister = async () => {
  if (!canRegister.value) return;

  try {
    const result = await authStore.register(name.value, email.value, registerPassword.value, confirmPassword.value);
    if (result.success) {
      // Show success message, switch to login mode
      isLoginMode.value = true;
      name.value = '';
      email.value = '';
      registerPassword.value = '';
      confirmPassword.value = '';
    }
  } catch (error) {
    // Error handled in store
  }
};

const switchToRegister = () => {
  isLoginMode.value = false;
  authStore.error = null;
};

const switchToLogin = () => {
  isLoginMode.value = true;
  authStore.error = null;
};

const backToLogin = () => {
  showConfirmLogin.value = false;
  confirmationToken.value = '';
  authStore.error = null;
};
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
    <div class="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
      <!-- Header -->
      <div class="text-center mb-8">
        <h1 class="text-3xl font-bold text-gray-900 mb-2">QMS</h1>
        <p class="text-gray-600">Quantum Messaging System</p>
      </div>

      <!-- Error Message -->
      <div v-if="authStore.error" class="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
        <p class="text-red-700 text-sm">{{ authStore.error }}</p>
      </div>

      <!-- Login Form -->
      <form v-if="isLoginMode" @submit.prevent="handleLogin" class="space-y-6">
        <div>
          <label for="login" class="block text-sm font-medium text-gray-700 mb-2">
            Email или UIN
          </label>
          <input
            id="login"
            v-model="login"
            type="text"
            required
            class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
            placeholder="example@email.com или 12345678"
          />
        </div>

        <div>
          <label for="password" class="block text-sm font-medium text-gray-700 mb-2">
            Пароль
          </label>
          <input
            id="password"
            v-model="password"
            type="password"
            required
            minlength="8"
            maxlength="25"
            class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
            placeholder="••••••••"
          />
          <p v-if="password && !isPasswordValid" class="mt-1 text-sm text-red-600">
            Пароль должен быть от 8 до 25 символов
          </p>
        </div>

        <button
          type="submit"
          :disabled="!canLogin"
          class="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors"
        >
          <span v-if="authStore.isLoading" class="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
          Войти
        </button>
      </form>

      <!-- Confirmation Form -->
      <div v-if="showConfirmLogin" class="space-y-6">
        <p class="text-sm text-gray-700">
          На ваш Email отправлен код подтверждения. Пожалуйста, введите его ниже:
        </p>
        <div>
          <label for="confirmationToken" class="block text-sm font-medium text-gray-700 mb-2">
            Код подтверждения
          </label>
          <input
            id="confirmationToken"
            v-model="confirmationToken"
            type="text"
            required
            class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
            placeholder="Введите код"
          />
        </div>

        <button
          @click="handleConfirmLogin"
          class="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
        >
          Подтвердить
        </button>

        <button
          @click="backToLogin"
          class="w-full text-blue-600 hover:text-blue-800 font-medium transition-colors"
        >
          Назад к входу
        </button>
      </div>

      <!-- Register Form -->
      <form v-else @submit.prevent="handleRegister" class="space-y-6">
        <div>
          <label for="name" class="block text-sm font-medium text-gray-700 mb-2">
            Имя
          </label>
          <input
            id="name"
            v-model="name"
            type="text"
            required
            class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
            placeholder="Ваше имя"
          />
        </div>

        <div>
          <label for="email" class="block text-sm font-medium text-gray-700 mb-2">
            Email
          </label>
          <input
            id="email"
            v-model="email"
            type="email"
            required
            class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
            placeholder="example@email.com"
          />
        </div>

        <div>
          <label for="registerPassword" class="block text-sm font-medium text-gray-700 mb-2">
            Пароль
          </label>
          <input
            id="registerPassword"
            v-model="registerPassword"
            type="password"
            required
            minlength="8"
            maxlength="25"
            class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
            placeholder="••••••••"
          />
          <p v-if="registerPassword && !isRegisterPasswordValid" class="mt-1 text-sm text-red-600">
            Пароль должен быть от 8 до 25 символов
          </p>
        </div>

        <div>
          <label for="confirmPassword" class="block text-sm font-medium text-gray-700 mb-2">
            Подтверждение пароля
          </label>
          <input
            id="confirmPassword"
            v-model="confirmPassword"
            type="password"
            required
            class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
            placeholder="••••••••"
          />
          <p v-if="confirmPassword && !isConfirmPasswordValid" class="mt-1 text-sm text-red-600">
            Пароли не совпадают
          </p>
        </div>

        <button
          type="submit"
          :disabled="!canRegister"
          class="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors"
        >
          <span v-if="authStore.isLoading" class="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
          Зарегистрироваться
        </button>
      </form>

      <!-- Switch Mode -->
      <div class="mt-6 text-center">
        <button
          v-if="isLoginMode"
          @click="switchToRegister"
          class="text-blue-600 hover:text-blue-800 font-medium transition-colors"
        >
          Нет аккаунта? Зарегистрироваться
        </button>
        <button
          v-else
          @click="switchToLogin"
          class="text-blue-600 hover:text-blue-800 font-medium transition-colors"
        >
          Уже есть аккаунт? Войти
        </button>
      </div>
    </div>
  </div>
</template>
