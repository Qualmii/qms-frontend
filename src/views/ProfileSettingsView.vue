<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useProfileStore } from '@/stores/profile'
import { STATUS_CONFIG } from '@/utils/statusConfig'
import type { Session } from '@/types/api'

type SessionWithCurrent = Session & { is_current?: boolean }

const router = useRouter()
const authStore = useAuthStore()
const profileStore = useProfileStore()

const user = computed(() => authStore.user)

// ─── Аватар / инициалы ────────────────────────────────────────────────────
const avatarInitials = computed(() => {
  const name = user.value?.name ?? ''
  return name.substring(0, 2).toUpperCase()
})

const currentStatusConfig = computed(() =>
  STATUS_CONFIG[user.value?.online_status ?? 'online'] ?? STATUS_CONFIG['online']!
)

// ─── Ник ──────────────────────────────────────────────────────────────────
const usernameInput    = ref(user.value?.username ?? '')
const isSavingUsername = ref(false)
const isDeletingUsername = ref(false)
const usernameApiError = ref<string | null>(null)
const usernameSuccess  = ref(false)

/** Валидация поля ника */
const usernameValidationError = computed(() => {
  const val = usernameInput.value.trim()
  if (!val) return null
  if (val.length < 3)  return 'Минимум 3 символа'
  if (val.length > 20) return 'Максимум 20 символов'
  if (!/^[a-zA-Z0-9_-]+$/.test(val)) return 'Только латиница, цифры, _ и -'
  return null
})

const canSaveUsername = computed(() => {
  const val = usernameInput.value.trim()
  if (!val) return false
  if (usernameValidationError.value) return false
  if (val === user.value?.username) return false
  return true
})

const saveUsername = async () => {
  if (!canSaveUsername.value || isSavingUsername.value) return
  isSavingUsername.value = true
  usernameApiError.value = null
  usernameSuccess.value = false
  try {
    await profileStore.setUsername(usernameInput.value.trim())
    if (authStore.user) {
      authStore.user.username = usernameInput.value.trim()
      localStorage.setItem('user', JSON.stringify(authStore.user))
    }
    usernameSuccess.value = true
    setTimeout(() => { usernameSuccess.value = false }, 3000)
  } catch (err: any) {
    usernameApiError.value = err?.response?.data?.message
      ?? err?.response?.data?.error
      ?? 'Не удалось сохранить ник'
  } finally {
    isSavingUsername.value = false
  }
}

const deleteUsername = async () => {
  if (isDeletingUsername.value) return
  isDeletingUsername.value = true
  usernameApiError.value = null
  usernameSuccess.value = false
  try {
    await profileStore.deleteUsername()
    if (authStore.user) {
      authStore.user.username = undefined
      localStorage.setItem('user', JSON.stringify(authStore.user))
    }
    usernameInput.value = ''
    usernameSuccess.value = true
    setTimeout(() => { usernameSuccess.value = false }, 3000)
  } catch (err: any) {
    usernameApiError.value = err?.response?.data?.message
      ?? err?.response?.data?.error
      ?? 'Не удалось удалить ник'
  } finally {
    isDeletingUsername.value = false
  }
}

// ─── Сессии (mock-данные для вёрстки) ─────────────────────────────────────
const sessions = ref<SessionWithCurrent[]>([
  {
    id: 1,
    device_name: 'Chrome · macOS',
    ip_address: '192.168.1.1',
    confirmed_at: '2026-03-15T08:00:00Z',
    expires_at: '2026-04-14T08:00:00Z',
    is_current: true,
  },
  {
    id: 2,
    device_name: 'Safari · iPhone 15',
    ip_address: '10.0.0.5',
    confirmed_at: '2026-03-14T18:30:00Z',
    expires_at: '2026-04-13T18:30:00Z',
    is_current: false,
  },
  {
    id: 3,
    device_name: 'Firefox · Windows 11',
    ip_address: '172.16.0.10',
    confirmed_at: '2026-03-13T09:15:00Z',
    expires_at: '2026-04-12T09:15:00Z',
    is_current: false,
  },
])

const otherSessions = computed(() => sessions.value.filter(s => !s.is_current))

// ─── Язык ─────────────────────────────────────────────────────────────────
const selectedLocale = ref(user.value?.locale ?? 'ru')

const languages = [
  { code: 'ru', flag: '🇷🇺', name: 'Русский',  nativeName: 'Русский' },
  { code: 'en', flag: '🇺🇸', name: 'English',  nativeName: 'English' },
  { code: 'de', flag: '🇩🇪', name: 'Deutsch',  nativeName: 'Deutsch' },
]

type DeviceType = 'iphone' | 'android' | 'macos' | 'windows' | 'linux' | 'phone' | 'desktop'

function getDeviceType(name: string): DeviceType {
  const l = name.toLowerCase()
  if (l.includes('iphone') || l.includes('ipad') || l.includes('ios')) return 'iphone'
  if (l.includes('android'))                                             return 'android'
  if (l.includes('mac') || l.includes('macos') || l.includes('macbook')) return 'macos'
  if (l.includes('windows'))                                             return 'windows'
  if (l.includes('linux') || l.includes('ubuntu') || l.includes('debian') || l.includes('fedora')) return 'linux'
  if (l.includes('mobile'))                                              return 'phone'
  return 'desktop'
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}
</script>

<template>
  <div class="min-h-screen bg-gray-100">

    <!-- Шапка -->
    <header class="sticky top-0 z-10 bg-white border-b border-gray-200">
      <div class="max-w-2xl mx-auto flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          class="p-2 -ml-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          @click="router.push('/')"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 class="text-base font-semibold text-gray-900">Настройки профиля</h1>
      </div>
    </header>

    <!-- Контент -->
    <main class="max-w-2xl mx-auto px-4 py-6 space-y-4">

      <!-- Карточка профиля -->
      <div class="bg-white rounded-2xl border border-gray-200 overflow-hidden">

        <!-- Фон-баннер -->
        <div class="h-24 bg-linear-to-r from-blue-500 via-indigo-500 to-purple-500" />

        <!-- Аватар + имя -->
        <div class="px-6 pb-6">

          <!-- Аватар (смещён поверх баннера) -->
          <div class="relative -mt-12 mb-4 w-fit">
            <div class="w-24 h-24 rounded-full bg-linear-to-br from-blue-500 to-purple-500
                        flex items-center justify-center
                        text-white font-bold text-2xl select-none
                        ring-4 ring-white">
              {{ avatarInitials }}
            </div>
            <!-- Индикатор статуса -->
            <span
              class="absolute bottom-1 right-1 w-5 h-5 rounded-full border-2 border-white"
              :class="currentStatusConfig.dotColor"
            />
          </div>

          <!-- Имя -->
          <h2 class="text-xl font-bold text-gray-900 leading-tight">
            {{ user?.name }}
          </h2>

          <!-- Ник, если есть -->
          <p v-if="user?.username" class="text-sm text-gray-500 mt-0.5">
            @{{ user.username }}
          </p>

        </div>
      </div>

      <!-- Секция: Информация об аккаунте -->
      <div class="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div class="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <h2 class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Аккаунт</h2>
        </div>

        <!-- Email -->
        <div class="px-4 py-4 flex items-center gap-3">
          <div class="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
            <svg class="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-xs text-gray-400 mb-0.5">Электронная почта</p>
            <p class="text-sm font-medium text-gray-900 truncate">{{ user?.email }}</p>
          </div>
          <!-- Замок: поле нередактируемое -->
          <svg class="w-4 h-4 text-gray-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>

        <div class="border-t border-gray-100" />

        <!-- UIN -->
        <div class="px-4 py-4 flex items-center gap-3">
          <div class="w-9 h-9 rounded-full bg-purple-50 flex items-center justify-center shrink-0">
            <svg class="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
            </svg>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-xs text-gray-400 mb-0.5">UIN</p>
            <p class="text-sm font-mono font-semibold text-gray-900">{{ user?.uin }}</p>
          </div>
          <svg class="w-4 h-4 text-gray-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
      </div>

      <!-- Секция: Ник -->
      <div class="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div class="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <h2 class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Имя пользователя</h2>
        </div>

        <div class="px-4 py-4 space-y-3">
          <div>
            <label class="block text-xs text-gray-400 mb-1.5">Ник</label>
            <div class="flex">
              <!-- Префикс @ -->
              <div class="flex items-center px-3 bg-gray-50 border border-gray-200 border-r-0 rounded-l-lg
                          text-sm text-gray-400 select-none shrink-0">
                @
              </div>
              <input
                v-model="usernameInput"
                type="text"
                maxlength="20"
                placeholder="username"
                :class="[
                  'flex-1 px-3 py-2 text-sm border rounded-r-lg',
                  'focus:outline-none focus:ring-2 focus:border-transparent placeholder:text-gray-300',
                  usernameValidationError
                    ? 'border-red-300 focus:ring-red-400'
                    : 'border-gray-200 focus:ring-blue-400'
                ]"
                @keydown.enter="saveUsername"
              />
            </div>

            <!-- Ошибка валидации -->
            <p v-if="usernameValidationError" class="text-xs text-red-500 mt-1.5 flex items-center gap-1">
              <svg class="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
              </svg>
              {{ usernameValidationError }}
            </p>

            <!-- Ошибка API -->
            <p v-else-if="usernameApiError" class="text-xs text-red-500 mt-1.5 flex items-center gap-1">
              <svg class="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
              </svg>
              {{ usernameApiError }}
            </p>

            <!-- Успех -->
            <p v-else-if="usernameSuccess" class="text-xs text-green-600 mt-1.5 flex items-center gap-1">
              <svg class="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
              </svg>
              Сохранено
            </p>

            <!-- Подсказка -->
            <p v-else class="text-xs text-gray-400 mt-1.5">
              От 3 до 20 символов: латиница, цифры,
              <span class="font-mono">_</span> и <span class="font-mono">-</span>
            </p>
          </div>

          <!-- Кнопки действий -->
          <div class="flex gap-2 pt-1">
            <button
              type="button"
              class="flex-1 py-2 px-4 text-sm font-medium rounded-lg transition-colors
                     flex items-center justify-center gap-2
                     disabled:opacity-40 disabled:cursor-not-allowed"
              :class="canSaveUsername
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'"
              :disabled="!canSaveUsername || isSavingUsername"
              @click="saveUsername"
            >
              <svg v-if="isSavingUsername" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
              {{ isSavingUsername ? 'Сохраняем…' : 'Сохранить' }}
            </button>

            <button
              v-if="user?.username"
              type="button"
              class="py-2 px-4 text-sm font-medium rounded-lg border transition-colors
                     flex items-center justify-center gap-2
                     disabled:opacity-40 disabled:cursor-not-allowed"
              :class="isDeletingUsername
                ? 'border-gray-200 text-gray-400'
                : 'border-red-200 text-red-600 hover:bg-red-50'"
              :disabled="isDeletingUsername"
              @click="deleteUsername"
            >
              <svg v-if="isDeletingUsername" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
              {{ isDeletingUsername ? '…' : 'Удалить' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Секция: Активные сессии -->
      <div class="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div class="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <h2 class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Активные сессии</h2>
          <span class="text-xs font-semibold text-white bg-blue-500 rounded-full px-2 py-0.5">
            {{ sessions.length }}
          </span>
        </div>

        <ul class="divide-y divide-gray-100">
          <li
            v-for="session in sessions"
            :key="session.id"
            class="flex items-start gap-3 px-4 py-4"
          >
            <!-- Иконка устройства -->
            <div
              class="w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-0.5"
              :class="session.is_current ? 'bg-blue-50' : 'bg-gray-100'"
            >
              <!-- iPhone / iPad / iOS -->
              <svg
                v-if="getDeviceType(session.device_name) === 'iphone'"
                class="w-4 h-4" :class="session.is_current ? 'text-blue-500' : 'text-gray-400'"
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"/>
              </svg>

              <!-- Android -->
              <svg
                v-else-if="getDeviceType(session.device_name) === 'android'"
                class="w-4 h-4" :class="session.is_current ? 'text-blue-500' : 'text-gray-400'"
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M8 21h8a2 2 0 002-2V9a2 2 0 00-2-2H8a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                <path stroke-linecap="round" stroke-width="2"
                  d="M9 4l2 3m6-3l-2 3M6 12h.01M18 12h.01"/>
              </svg>

              <!-- macOS / MacBook -->
              <svg
                v-else-if="getDeviceType(session.device_name) === 'macos'"
                class="w-4 h-4" :class="session.is_current ? 'text-blue-500' : 'text-gray-400'"
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M4 6h16v11H4V6zm0 11h16M10 20h4"/>
                <circle cx="12" cy="11" r="1.5" fill="currentColor" stroke="none"/>
              </svg>

              <!-- Windows -->
              <svg
                v-else-if="getDeviceType(session.device_name) === 'windows'"
                class="w-4 h-4" :class="session.is_current ? 'text-blue-500' : 'text-gray-400'"
                fill="currentColor" viewBox="0 0 24 24"
              >
                <path d="M3 3h9v9H3V3zm0 10h9v9H3v-9zm10-10h9v9h-9V3zm0 10h9v9h-9v-9z"/>
              </svg>

              <!-- Linux -->
              <svg
                v-else-if="getDeviceType(session.device_name) === 'linux'"
                class="w-4 h-4" :class="session.is_current ? 'text-blue-500' : 'text-gray-400'"
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
              </svg>

              <!-- Generic mobile -->
              <svg
                v-else-if="getDeviceType(session.device_name) === 'phone'"
                class="w-4 h-4" :class="session.is_current ? 'text-blue-500' : 'text-gray-400'"
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"/>
              </svg>

              <!-- Generic desktop (fallback) -->
              <svg
                v-else
                class="w-4 h-4" :class="session.is_current ? 'text-blue-500' : 'text-gray-400'"
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
              </svg>
            </div>

            <!-- Информация о сессии -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-sm font-medium text-gray-900">{{ session.device_name }}</span>
                <span
                  v-if="session.is_current"
                  class="text-xs font-semibold text-green-700 bg-green-100 rounded-full px-2 py-0.5"
                >
                  Текущая
                </span>
              </div>
              <p class="text-xs text-gray-400 mt-0.5">{{ session.ip_address }}</p>
              <p class="text-xs text-gray-400">Вход: {{ formatDate(session.confirmed_at) }}</p>
            </div>

            <!-- Кнопка завершения (только для других сессий) -->
            <button
              v-if="!session.is_current"
              type="button"
              class="shrink-0 text-xs font-medium text-red-600 border border-red-200
                     rounded-lg px-3 py-1.5 hover:bg-red-50 transition-colors mt-0.5"
            >
              Завершить
            </button>
          </li>
        </ul>

        <!-- Завершить все другие -->
        <div v-if="otherSessions.length > 0" class="px-4 py-3 border-t border-gray-100 bg-gray-50">
          <button
            type="button"
            class="w-full py-2 px-4 text-sm font-medium text-red-600 border border-red-200
                   rounded-xl hover:bg-red-50 transition-colors"
          >
            Завершить все другие сессии ({{ otherSessions.length }})
          </button>
        </div>
      </div>

      <!-- Секция: Язык интерфейса -->
      <div class="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div class="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <h2 class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Язык интерфейса</h2>
        </div>

        <ul class="divide-y divide-gray-100">
          <li v-for="lang in languages" :key="lang.code">
            <button
              type="button"
              class="w-full flex items-center gap-3 px-4 py-3.5 transition-colors text-left"
              :class="selectedLocale === lang.code ? 'bg-blue-50' : 'hover:bg-gray-50'"
              @click="selectedLocale = lang.code"
            >
              <!-- Флаг -->
              <span class="text-2xl leading-none select-none">{{ lang.flag }}</span>

              <!-- Название -->
              <span
                class="flex-1 text-sm font-medium"
                :class="selectedLocale === lang.code ? 'text-blue-700' : 'text-gray-800'"
              >
                {{ lang.nativeName }}
              </span>

              <!-- Галочка для выбранного -->
              <svg
                v-if="selectedLocale === lang.code"
                class="w-4 h-4 text-blue-600 shrink-0"
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
              </svg>
            </button>
          </li>
        </ul>

        <!-- Кнопка сохранения -->
        <div class="px-4 py-3 border-t border-gray-100 bg-gray-50">
          <button
            type="button"
            class="w-full py-2 px-4 bg-blue-600 text-white text-sm font-medium rounded-xl
                   hover:bg-blue-700 transition-colors disabled:opacity-40"
            disabled
          >
            Сохранить язык
          </button>
        </div>
      </div>

    </main>
  </div>
</template>

