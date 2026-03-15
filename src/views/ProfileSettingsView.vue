<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useProfileStore } from '@/stores/profile'
import { apiClient } from '@/services/api'
import { STATUS_CONFIG } from '@/utils/statusConfig'
import type { Session } from '@/types/api'


const router = useRouter()
const authStore = useAuthStore()
const profileStore = useProfileStore()

const user = computed(() => authStore.user)

// ─── Аватар ───────────────────────────────────────────────────────────────
const avatarInitials = computed(() => {
  const name = user.value?.name ?? ''
  return name.substring(0, 2).toUpperCase()
})

const currentStatusConfig = computed(() =>
  STATUS_CONFIG[user.value?.online_status ?? 'online'] ?? STATUS_CONFIG['online']!
)

const showAvatarMenu   = ref(false)
const avatarMenuRef    = ref<HTMLElement | null>(null)
const galleryInputRef  = ref<HTMLInputElement | null>(null)
const cameraInputRef   = ref<HTMLInputElement | null>(null)
const isUploadingAvatar = ref(false)
const isDeletingAvatar  = ref(false)
const avatarError       = ref<string | null>(null)
const showDeleteConfirm = ref(false)
const showCameraCapture = ref(false)
const videoRef         = ref<HTMLVideoElement | null>(null)
const canvasRef        = ref<HTMLCanvasElement | null>(null)
let mediaStream: MediaStream | null = null

const isMobileDevice = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
}

const onAvatarOutsideClick = (e: MouseEvent) => {
  if (avatarMenuRef.value && !avatarMenuRef.value.contains(e.target as Node)) {
    showAvatarMenu.value = false
  }
}
onMounted(() => document.addEventListener('mousedown', onAvatarOutsideClick))
onUnmounted(() => {
  document.removeEventListener('mousedown', onAvatarOutsideClick)
  stopCamera()
})

const handleAvatarFile = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  ;(e.target as HTMLInputElement).value = ''   // сбросить input для повторного выбора

  isUploadingAvatar.value = true
  avatarError.value = null
  showAvatarMenu.value = false
  try {
    const res = await apiClient.uploadAvatar(file)
    if (authStore.user) {
      authStore.user.avatar_url = res.data.avatar_url
      localStorage.setItem('user', JSON.stringify(authStore.user))
    }
  } catch {
    avatarError.value = 'Не удалось загрузить фото'
    setTimeout(() => { avatarError.value = null }, 3000)
  } finally {
    isUploadingAvatar.value = false
  }
}

const openCamera = async () => {
  showAvatarMenu.value = false

  // На мобильных устройствах используем input с capture
  if (isMobileDevice()) {
    cameraInputRef.value?.click()
    return
  }

  // На desktop используем MediaDevices API
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    })

    showCameraCapture.value = true

    // Ждём следующий тик для рендера video элемента
    await new Promise(resolve => setTimeout(resolve, 100))

    if (videoRef.value) {
      videoRef.value.srcObject = mediaStream
      await videoRef.value.play()
    }
  } catch (err) {
    console.error('Ошибка доступа к камере:', err)
    avatarError.value = 'Не удалось получить доступ к камере'
    setTimeout(() => { avatarError.value = null }, 3000)
  }
}

const capturePhoto = async () => {
  if (!videoRef.value || !canvasRef.value) return

  const video = videoRef.value
  const canvas = canvasRef.value

  // Устанавливаем размеры canvas равными видео
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight

  // Рисуем текущий кадр видео на canvas
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

  // Конвертируем canvas в blob
  canvas.toBlob(async (blob) => {
    if (!blob) return

    stopCamera()

    // Создаём File из blob
    const file = new File([blob], 'avatar.jpg', { type: 'image/jpeg' })

    // Загружаем
    isUploadingAvatar.value = true
    avatarError.value = null
    try {
      const res = await apiClient.uploadAvatar(file)
      if (authStore.user) {
        authStore.user.avatar_url = res.data.avatar_url
        localStorage.setItem('user', JSON.stringify(authStore.user))
      }
    } catch {
      avatarError.value = 'Не удалось загрузить фото'
      setTimeout(() => { avatarError.value = null }, 3000)
    } finally {
      isUploadingAvatar.value = false
    }
  }, 'image/jpeg', 0.9)
}

const stopCamera = () => {
  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop())
    mediaStream = null
  }
  if (videoRef.value) {
    videoRef.value.srcObject = null
  }
  showCameraCapture.value = false
}

const requestDeleteAvatar = () => {
  showAvatarMenu.value = false
  showDeleteConfirm.value = true
}

const confirmDeleteAvatar = async () => {
  showDeleteConfirm.value = false
  isDeletingAvatar.value = true
  avatarError.value = null
  try {
    await apiClient.deleteAvatar()
    if (authStore.user) {
      authStore.user.avatar_url = null
      localStorage.setItem('user', JSON.stringify(authStore.user))
    }
  } catch {
    avatarError.value = 'Не удалось удалить фото'
    setTimeout(() => { avatarError.value = null }, 3000)
  } finally {
    isDeletingAvatar.value = false
  }
}

const cancelDeleteAvatar = () => {
  showDeleteConfirm.value = false
}

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
  } catch (err: unknown) {
    const e = err as { response?: { data?: { message?: string; error?: string } } }
    usernameApiError.value = e?.response?.data?.message
      ?? e?.response?.data?.error
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
  } catch (err: unknown) {
    const e = err as { response?: { data?: { message?: string; error?: string } } }
    usernameApiError.value = e?.response?.data?.message
      ?? e?.response?.data?.error
      ?? 'Не удалось удалить ник'
  } finally {
    isDeletingUsername.value = false
  }
}

// ─── Сессии ───────────────────────────────────────────────────────────────
const sessions          = ref<Session[]>([])
const isLoadingSessions = ref(false)
const sessionsError     = ref<string | null>(null)
const endingSessionId   = ref<number | null>(null)
const isEndingAll       = ref(false)

// Модальное окно подтверждения
const confirm = ref<{
  visible: boolean
  title: string
  message: string
  action: (() => Promise<void>) | null
}>({
  visible: false,
  title: '',
  message: '',
  action: null,
})

const closeConfirm = () => {
  confirm.value.visible = false
  confirm.value.action = null
}

const runConfirm = async () => {
  if (!confirm.value.action) return
  const action = confirm.value.action
  closeConfirm()
  await action()
}

const otherSessions = computed(() => sessions.value.filter(s => !s.is_current))

const loadSessions = async () => {
  isLoadingSessions.value = true
  sessionsError.value = null
  try {
    const res = await apiClient.getSessions()
    sessions.value = res.data
  } catch {
    sessionsError.value = 'Не удалось загрузить сессии'
  } finally {
    isLoadingSessions.value = false
  }
}

const doEndSession = async (sessionId: number) => {
  if (endingSessionId.value !== null || isEndingAll.value) return
  endingSessionId.value = sessionId
  try {
    await apiClient.endSession(sessionId)
    sessions.value = sessions.value.filter(s => s.id !== sessionId)
  } catch {
    sessionsError.value = 'Не удалось завершить сессию'
    setTimeout(() => { sessionsError.value = null }, 3000)
  } finally {
    endingSessionId.value = null
  }
}

const doEndAllOtherSessions = async () => {
  if (isEndingAll.value || endingSessionId.value !== null) return
  isEndingAll.value = true
  try {
    await apiClient.endOtherSessions()
    sessions.value = sessions.value.filter(s => s.is_current)
  } catch {
    sessionsError.value = 'Не удалось завершить сессии'
    setTimeout(() => { sessionsError.value = null }, 3000)
  } finally {
    isEndingAll.value = false
  }
}

// Запросить подтверждение перед завершением одной сессии
const askEndSession = (session: Session) => {
  confirm.value = {
    visible: true,
    title: 'Завершить сессию?',
    message: `Устройство «${session.device_name}» (${session.ip_address}) будет отключено.`,
    action: () => doEndSession(session.id),
  }
}

// Запросить подтверждение перед завершением всех других сессий
const askEndAllOtherSessions = () => {
  const count = otherSessions.value.length
  confirm.value = {
    visible: true,
    title: 'Завершить все другие сессии?',
    message: `Будет отключено устройств: ${count}. Текущая сессия останется активной.`,
    action: doEndAllOtherSessions,
  }
}

onMounted(() => {
  loadSessions()
})

// ─── Язык ─────────────────────────────────────────────────────────────────
const selectedLocale = ref(user.value?.locale ?? 'ru')
const isSavingLocale = ref(false)
const localeError    = ref<string | null>(null)
const localeSuccess  = ref(false)

const languages = [
  { code: 'ru', flag: '🇷🇺', nativeName: 'Русский' },
  { code: 'en', flag: '🇺🇸', nativeName: 'English' },
  { code: 'de', flag: '🇩🇪', nativeName: 'Deutsch' },
]

const canSaveLocale = computed(() =>
  selectedLocale.value !== (user.value?.locale ?? 'ru')
)

const saveLocale = async () => {
  if (!canSaveLocale.value || isSavingLocale.value) return
  isSavingLocale.value = true
  localeError.value = null
  localeSuccess.value = false
  try {
    await profileStore.updateLocale(selectedLocale.value)

    // Обновляем локаль в сторе и localStorage
    if (authStore.user) {
      authStore.user.locale = selectedLocale.value
      localStorage.setItem('user', JSON.stringify(authStore.user))
    }

    // Перезапрашиваем локализованные данные — бэкенд вернёт их уже
    // в новой локали, StatusPicker обновится без перезагрузки страницы
    await profileStore.fetchAvailableStatuses()

    localeSuccess.value = true
    setTimeout(() => { localeSuccess.value = false }, 3000)
  } catch {
    localeError.value = 'Не удалось сохранить язык'
    setTimeout(() => { localeError.value = null }, 3000)
  } finally {
    isSavingLocale.value = false
  }
}

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
  <div class="min-h-screen bg-gray-100 dark:bg-gray-900">

    <!-- Шапка -->
    <header class="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div class="max-w-2xl mx-auto flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          class="p-2 -ml-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          @click="router.push('/')"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 class="text-base font-semibold text-gray-900 dark:text-white">Настройки профиля</h1>
      </div>
    </header>

    <!-- Контент -->
    <main class="max-w-2xl mx-auto px-4 py-6 space-y-4">

      <!-- Карточка профиля -->
      <div class="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700">

        <!-- Фон-баннер -->
        <div class="h-24 bg-linear-to-r from-blue-500 via-indigo-500 to-purple-500 rounded-t-2xl overflow-hidden" />

        <!-- Аватар + имя -->
        <div class="px-6 pb-6">

          <!-- Аватар с кнопкой смены -->
          <div ref="avatarMenuRef" class="relative -mt-12 mb-4 w-fit">

            <!-- Круг аватара -->
            <div
              class="relative w-24 h-24 ring-4 ring-white rounded-full cursor-pointer group"
              :class="{ 'pointer-events-none': isUploadingAvatar || isDeletingAvatar }"
              @click="!isUploadingAvatar && !isDeletingAvatar && (showAvatarMenu = !showAvatarMenu)"
            >
              <!-- Фото -->
              <img
                v-if="user?.avatar_url"
                :src="user.avatar_url"
                alt="Аватар"
                class="w-24 h-24 rounded-full object-cover transition-opacity group-hover:opacity-75"
              />
              <!-- Инициалы (нет фото) -->
              <div
                v-else
                class="w-24 h-24 rounded-full bg-linear-to-br from-blue-500 to-purple-500
                       flex items-center justify-center text-white font-bold text-2xl select-none
                       transition-opacity group-hover:opacity-75"
              >
                {{ avatarInitials }}
              </div>

              <!-- Оверлей загрузки -->
              <div
                v-if="isUploadingAvatar || isDeletingAvatar"
                class="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center"
              >
                <svg class="w-6 h-6 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
              </div>

              <!-- Иконка при наведении -->
              <div
                v-if="!isUploadingAvatar && !isDeletingAvatar"
                class="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/30
                       flex items-center justify-center transition-all duration-200"
              >
                <svg
                  class="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
              </div>
            </div>

            <!-- Индикатор статуса -->
            <span
              class="absolute bottom-1 right-1 w-5 h-5 rounded-full border-2 border-white"
              :class="currentStatusConfig.dotColor"
            />

            <!-- Выпадающее меню аватара -->
            <Transition
              enter-active-class="transition duration-150 ease-out"
              enter-from-class="opacity-0 scale-95 -translate-y-1"
              enter-to-class="opacity-100 scale-100 translate-y-0"
              leave-active-class="transition duration-100 ease-in"
              leave-from-class="opacity-100 scale-100 translate-y-0"
              leave-to-class="opacity-0 scale-95 -translate-y-1"
            >
              <div
                v-if="showAvatarMenu"
                class="absolute left-0 top-full mt-2 z-20 w-52
                       bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
              >
                <!-- Выбрать из галереи -->
                <button
                  type="button"
                  class="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  @click="galleryInputRef?.click()"
                >
                  <svg class="w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                  </svg>
                  Выбрать из галереи
                </button>

                <!-- Сфотографировать -->
                <button
                  type="button"
                  class="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-t border-gray-100 dark:border-gray-700"
                  @click="openCamera"
                >
                  <svg class="w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
                  </svg>
                  Сфотографировать
                </button>

                <!-- Удалить фото -->
                <button
                  v-if="user?.avatar_url"
                  type="button"
                  class="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors border-t border-gray-100 dark:border-gray-700"
                  @click="requestDeleteAvatar"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                  </svg>
                  Удалить фото
                </button>
              </div>
            </Transition>

            <!-- Скрытые inputs -->
            <input
              ref="galleryInputRef"
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              class="hidden"
              @change="handleAvatarFile"
            />
            <input
              ref="cameraInputRef"
              type="file"
              accept="image/*"
              capture="user"
              class="hidden"
              @change="handleAvatarFile"
            />
          </div>

          <!-- Ошибка аватара -->
          <p v-if="avatarError" class="text-xs text-red-500 mb-2 flex items-center gap-1">
            <svg class="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
            </svg>
            {{ avatarError }}
          </p>

          <!-- Имя -->
          <h2 class="text-xl font-bold text-gray-900 dark:text-white leading-tight">{{ user?.name }}</h2>

          <!-- Ник, если есть -->
          <p v-if="user?.username" class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">@{{ user.username }}</p>

        </div>
      </div>

      <!-- Секция: Информация об аккаунте -->
      <div class="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div class="px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <h2 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Аккаунт</h2>
        </div>

        <!-- Email -->
        <div class="px-4 py-4 flex items-center gap-3">
          <div class="w-9 h-9 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
            <svg class="w-4 h-4 text-blue-500 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-xs text-gray-400 dark:text-gray-500 mb-0.5">Электронная почта</p>
            <p class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ user?.email }}</p>
          </div>
          <!-- Замок: поле нередактируемое -->
          <svg class="w-4 h-4 text-gray-300 dark:text-gray-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>

        <div class="border-t border-gray-100 dark:border-gray-700" />

        <!-- UIN -->
        <div class="px-4 py-4 flex items-center gap-3">
          <div class="w-9 h-9 rounded-full bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
            <svg class="w-4 h-4 text-purple-500 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
            </svg>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-xs text-gray-400 dark:text-gray-500 mb-0.5">UIN</p>
            <p class="text-sm font-mono font-semibold text-gray-900 dark:text-white">{{ user?.uin }}</p>
          </div>
          <svg class="w-4 h-4 text-gray-300 dark:text-gray-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
      </div>

      <!-- Секция: Ник -->
      <div class="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div class="px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <h2 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Имя пользователя</h2>
        </div>

        <div class="px-4 py-4 space-y-3">
          <div>
            <label class="block text-xs text-gray-400 dark:text-gray-500 mb-1.5">Ник</label>
            <div class="flex">
              <!-- Префикс @ -->
              <div class="flex items-center px-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 border-r-0 rounded-l-lg
                          text-sm text-gray-400 dark:text-gray-500 select-none shrink-0">
                @
              </div>
              <input
                v-model="usernameInput"
                type="text"
                maxlength="20"
                placeholder="username"
                :class="[
                  'flex-1 px-3 py-2 text-sm border rounded-r-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-300 dark:placeholder-gray-600',
                  'focus:outline-none focus:ring-2 focus:border-transparent',
                  usernameValidationError
                    ? 'border-red-300 dark:border-red-700 focus:ring-red-400 dark:focus:ring-red-500'
                    : 'border-gray-200 dark:border-gray-600 focus:ring-blue-400 dark:focus:ring-blue-500'
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
            <p v-else class="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
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
                ? 'bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-600'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'"
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
                ? 'border-gray-200 dark:border-gray-600 text-gray-400 dark:text-gray-500'
                : 'border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30'"
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

      <!-- Секция: Тема интерфейса -->
      <div class="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden transition-colors">
        <div class="px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <h2 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Внешний вид</h2>
        </div>

        <div class="px-4 py-4">
          <div class="flex items-center justify-between gap-4">
            <div class="flex items-center gap-3 flex-1">
              <div class="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                   :class="profileStore.isDarkMode ? 'bg-indigo-500/10' : 'bg-amber-50'">
                <!-- Иконка солнца для светлой темы -->
                <svg v-if="!profileStore.isDarkMode" class="w-5 h-5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clip-rule="evenodd" />
                </svg>
                <!-- Иконка луны для тёмной темы -->
                <svg v-else class="w-5 h-5 text-indigo-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                </svg>
              </div>
              <div class="flex-1">
                <p class="text-sm font-medium text-gray-900 dark:text-white">
                  {{ profileStore.isDarkMode ? 'Тёмная тема' : 'Светлая тема' }}
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {{ profileStore.isDarkMode ? 'Режим для работы ночью' : 'Режим для дневной работы' }}
                </p>
              </div>
            </div>

            <!-- Toggle Switch -->
            <button
              type="button"
              @click="profileStore.toggleTheme()"
              class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
              :class="profileStore.isDarkMode ? 'bg-indigo-600' : 'bg-gray-200'"
            >
              <span
                class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm"
                :class="profileStore.isDarkMode ? 'translate-x-6' : 'translate-x-1'"
              />
            </button>
          </div>

          <!-- Подсказка -->
          <p class="text-xs text-gray-400 dark:text-gray-500 mt-3 flex items-start gap-1.5">
            <svg class="w-3.5 h-3.5 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
            </svg>
            <span>Тема сохраняется автоматически и применяется ко всем страницам</span>
          </p>
        </div>
      </div>

      <!-- Секция: Активные сессии -->
      <div class="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div class="px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex items-center justify-between">
          <h2 class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Активные сессии</h2>
          <span v-if="!isLoadingSessions" class="text-xs font-semibold text-white bg-blue-500 rounded-full px-2 py-0.5">
            {{ sessions.length }}
          </span>
        </div>

        <!-- Скелетон загрузки -->
        <ul v-if="isLoadingSessions" class="divide-y divide-gray-100">
          <li v-for="i in 2" :key="i" class="flex items-start gap-3 px-4 py-4 animate-pulse">
            <div class="w-9 h-9 rounded-full bg-gray-200 shrink-0" />
            <div class="flex-1 space-y-2 pt-1">
              <div class="h-3.5 bg-gray-200 rounded w-1/2" />
              <div class="h-3 bg-gray-100 rounded w-1/3" />
            </div>
          </li>
        </ul>

        <!-- Ошибка загрузки -->
        <div v-else-if="sessionsError && sessions.length === 0" class="px-4 py-6 text-center">
          <p class="text-sm text-red-500 mb-3">{{ sessionsError }}</p>
          <button
            type="button"
            class="text-sm text-blue-600 hover:underline"
            @click="loadSessions"
          >
            Попробовать снова
          </button>
        </div>

        <!-- Список сессий -->
        <ul v-else class="divide-y divide-gray-100 dark:divide-gray-700">
          <li
            v-for="session in sessions"
            :key="session.id"
            class="flex items-start gap-3 px-4 py-4 transition-opacity"
            :class="endingSessionId === session.id ? 'opacity-50' : 'opacity-100'"
          >
            <!-- Иконка устройства -->
            <div
              class="w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-0.5"
              :class="session.is_current ? 'bg-blue-50 dark:bg-blue-900/30' : 'bg-gray-100 dark:bg-gray-700'"
            >
              <!-- iPhone / iPad / iOS -->
              <svg v-if="getDeviceType(session.device_name) === 'iphone'"
                class="w-4 h-4" :class="session.is_current ? 'text-blue-500 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'"
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"/>
              </svg>
              <!-- Android -->
              <svg v-else-if="getDeviceType(session.device_name) === 'android'"
                class="w-4 h-4" :class="session.is_current ? 'text-blue-500 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'"
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M8 21h8a2 2 0 002-2V9a2 2 0 00-2-2H8a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                <path stroke-linecap="round" stroke-width="2" d="M9 4l2 3m6-3l-2 3M6 12h.01M18 12h.01"/>
              </svg>
              <!-- macOS -->
              <svg v-else-if="getDeviceType(session.device_name) === 'macos'"
                class="w-4 h-4" :class="session.is_current ? 'text-blue-500' : 'text-gray-400'"
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M4 6h16v11H4V6zm0 11h16M10 20h4"/>
                <circle cx="12" cy="11" r="1.5" fill="currentColor" stroke="none"/>
              </svg>
              <!-- Windows -->
              <svg v-else-if="getDeviceType(session.device_name) === 'windows'"
                class="w-4 h-4" :class="session.is_current ? 'text-blue-500' : 'text-gray-400'"
                fill="currentColor" viewBox="0 0 24 24">
                <path d="M3 3h9v9H3V3zm0 10h9v9H3v-9zm10-10h9v9h-9V3zm0 10h9v9h-9v-9z"/>
              </svg>
              <!-- Linux -->
              <svg v-else-if="getDeviceType(session.device_name) === 'linux'"
                class="w-4 h-4" :class="session.is_current ? 'text-blue-500' : 'text-gray-400'"
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
              </svg>
              <!-- Generic mobile -->
              <svg v-else-if="getDeviceType(session.device_name) === 'phone'"
                class="w-4 h-4" :class="session.is_current ? 'text-blue-500' : 'text-gray-400'"
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"/>
              </svg>
              <!-- Generic desktop (fallback) -->
              <svg v-else
                class="w-4 h-4" :class="session.is_current ? 'text-blue-500' : 'text-gray-400'"
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
              </svg>
            </div>

            <!-- Информация о сессии -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-sm font-medium text-gray-900 dark:text-white">{{ session.device_name }}</span>
                <span
                  v-if="session.is_current"
                  class="text-xs font-semibold text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30 rounded-full px-2 py-0.5"
                >
                  Текущая
                </span>
              </div>
              <p class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{{ session.ip_address }}</p>
              <p class="text-xs text-gray-400 dark:text-gray-500">Вход: {{ formatDate(session.confirmed_at) }}</p>
            </div>

            <!-- Кнопка завершения -->
            <button
              v-if="!session.is_current"
              type="button"
              class="shrink-0 text-xs font-medium rounded-lg px-3 py-1.5 mt-0.5
                     border transition-colors flex items-center gap-1.5
                     disabled:opacity-40 disabled:cursor-not-allowed"
              :class="endingSessionId === session.id
                ? 'border-gray-200 text-gray-400'
                : 'border-red-200 text-red-600 hover:bg-red-50'"
              :disabled="endingSessionId !== null || isEndingAll"
              @click="askEndSession(session)"
            >
              <svg
                v-if="endingSessionId === session.id"
                class="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"
              >
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
              {{ endingSessionId === session.id ? '…' : 'Завершить' }}
            </button>
          </li>
        </ul>

        <!-- Подвал: ошибка действия + кнопка "Завершить все" -->
        <div
          v-if="!isLoadingSessions"
          class="px-4 py-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 space-y-2"
        >
          <!-- Ошибка действия (end/end-all) -->
          <p v-if="sessionsError && sessions.length > 0" class="text-xs text-red-500 dark:text-red-400 text-center">
            {{ sessionsError }}
          </p>

          <!-- Кнопка "завершить все другие" -->
          <button
            v-if="otherSessions.length > 0"
            type="button"
            class="w-full py-2 px-4 text-sm font-medium rounded-xl border transition-colors
                   flex items-center justify-center gap-2
                   disabled:opacity-40 disabled:cursor-not-allowed"
            :class="isEndingAll
              ? 'border-gray-200 dark:border-gray-600 text-gray-400 dark:text-gray-500'
              : 'border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30'"
            :disabled="isEndingAll || endingSessionId !== null"
            @click="askEndAllOtherSessions"
          >
            <svg v-if="isEndingAll" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
            </svg>
            {{ isEndingAll ? 'Завершаем…' : `Завершить все другие сессии (${otherSessions.length})` }}
          </button>
        </div>
      </div>

      <!-- Секция: Язык интерфейса -->
      <div class="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div class="px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <h2 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Язык интерфейса</h2>
        </div>

        <ul class="divide-y divide-gray-100 dark:divide-gray-700">
          <li v-for="lang in languages" :key="lang.code">
            <button
              type="button"
              class="w-full flex items-center gap-3 px-4 py-3.5 transition-colors text-left"
              :class="selectedLocale === lang.code ? 'bg-blue-50 dark:bg-blue-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-700'"
              @click="selectedLocale = lang.code"
            >
              <!-- Флаг -->
              <span class="text-2xl leading-none select-none">{{ lang.flag }}</span>

              <!-- Название -->
              <span
                class="flex-1 text-sm font-medium"
                :class="selectedLocale === lang.code ? 'text-blue-700 dark:text-blue-400' : 'text-gray-800 dark:text-gray-200'"
              >
                {{ lang.nativeName }}
              </span>

              <!-- Галочка для выбранного -->
              <svg
                v-if="selectedLocale === lang.code"
                class="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0"
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
              </svg>
            </button>
          </li>
        </ul>

        <!-- Подвал: статус + кнопка сохранения -->
        <div class="px-4 py-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 space-y-2">

          <!-- Успех -->
          <p v-if="localeSuccess" class="text-xs text-green-600 text-center flex items-center justify-center gap-1">
            <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
            </svg>
            Язык сохранён
          </p>

          <!-- Ошибка -->
          <p v-else-if="localeError" class="text-xs text-red-500 text-center flex items-center justify-center gap-1">
            <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
            </svg>
            {{ localeError }}
          </p>

          <button
            type="button"
            class="w-full py-2 px-4 text-sm font-medium rounded-xl transition-colors
                   flex items-center justify-center gap-2
                   disabled:opacity-40 disabled:cursor-not-allowed"
            :class="canSaveLocale
              ? 'bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-600'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500'"
            :disabled="!canSaveLocale || isSavingLocale"
            @click="saveLocale"
          >
            <svg v-if="isSavingLocale" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
            </svg>
            {{ isSavingLocale ? 'Сохраняем…' : 'Сохранить язык' }}
          </button>
        </div>
      </div>

    </main>
    <!-- Модальное окно подтверждения -->
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="confirm.visible"
        class="fixed inset-0 z-50 flex items-center justify-center px-4"
      >
        <!-- Затемнение фона -->
        <div
          class="absolute inset-0 bg-black/40 backdrop-blur-sm"
          @click="closeConfirm"
        />

        <!-- Карточка -->
        <Transition
          enter-active-class="transition duration-150 ease-out"
          enter-from-class="opacity-0 scale-95"
          enter-to-class="opacity-100 scale-100"
          leave-active-class="transition duration-100 ease-in"
          leave-from-class="opacity-100 scale-100"
          leave-to-class="opacity-0 scale-95"
        >
          <div
            v-if="confirm.visible"
            class="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6"
          >
            <!-- Иконка предупреждения -->
            <div class="flex justify-center mb-4">
              <div class="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                </svg>
              </div>
            </div>

            <!-- Заголовок -->
            <h3 class="text-base font-semibold text-gray-900 text-center mb-2">
              {{ confirm.title }}
            </h3>

            <!-- Сообщение -->
            <p class="text-sm text-gray-500 text-center mb-6 leading-relaxed">
              {{ confirm.message }}
            </p>

            <!-- Кнопки -->
            <div class="flex gap-3">
              <button
                type="button"
                class="flex-1 py-2.5 px-4 text-sm font-medium text-gray-700
                       bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                @click="closeConfirm"
              >
                Отмена
              </button>
              <button
                type="button"
                class="flex-1 py-2.5 px-4 text-sm font-medium text-white
                       bg-red-600 rounded-xl hover:bg-red-700 transition-colors"
                @click="runConfirm"
              >
                Завершить
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>

    <!-- Модальное окно подтверждения удаления аватара -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="showDeleteConfirm"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
        @click.self="cancelDeleteAvatar"
      >
        <Transition
          enter-active-class="transition duration-200 ease-out"
          enter-from-class="opacity-0 scale-95 translate-y-4"
          enter-to-class="opacity-100 scale-100 translate-y-0"
          leave-active-class="transition duration-150 ease-in"
          leave-from-class="opacity-100 scale-100 translate-y-0"
          leave-to-class="opacity-0 scale-95 translate-y-4"
        >
          <div
            v-if="showDeleteConfirm"
            class="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6"
          >
            <!-- Иконка -->
            <div class="w-14 h-14 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
              <svg class="w-7 h-7 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
            </div>

            <!-- Заголовок -->
            <h3 class="text-lg font-semibold text-gray-900 text-center mb-2">
              Удалить фото профиля?
            </h3>

            <!-- Описание -->
            <p class="text-sm text-gray-500 text-center mb-6">
              Вы уверены, что хотите удалить свое фото? Вместо него будут отображаться инициалы.
            </p>

            <!-- Кнопки -->
            <div class="flex gap-3">
              <button
                type="button"
                class="flex-1 py-2.5 px-4 text-sm font-medium text-gray-700
                       bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                @click="cancelDeleteAvatar"
              >
                Отмена
              </button>
              <button
                type="button"
                class="flex-1 py-2.5 px-4 text-sm font-medium text-white
                       bg-red-600 rounded-xl hover:bg-red-700 transition-colors"
                @click="confirmDeleteAvatar"
              >
                Удалить
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>

    <!-- Модальное окно камеры -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="showCameraCapture"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black px-4"
      >
        <div class="w-full max-w-2xl">
          <!-- Видео предпросмотр -->
          <div class="relative bg-black rounded-2xl overflow-hidden shadow-2xl">
            <video
              ref="videoRef"
              autoplay
              playsinline
              class="w-full h-auto"
            ></video>

            <!-- Скрытый canvas для захвата фото -->
            <canvas ref="canvasRef" class="hidden"></canvas>

            <!-- Кнопки управления -->
            <div class="absolute bottom-0 left-0 right-0 p-6 bg-linear-to-t from-black/80 to-transparent">
              <div class="flex items-center justify-center gap-4">
                <!-- Кнопка отмены -->
                <button
                  type="button"
                  class="w-12 h-12 rounded-full bg-white/20 hover:bg-white/30
                         flex items-center justify-center transition-colors"
                  @click="stopCamera"
                >
                  <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>

                <!-- Кнопка съёмки -->
                <button
                  type="button"
                  class="w-16 h-16 rounded-full bg-white hover:bg-gray-100
                         flex items-center justify-center transition-all shadow-lg
                         ring-4 ring-white/30"
                  @click="capturePhoto"
                >
                  <svg class="w-8 h-8 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
                  </svg>
                </button>
              </div>

              <!-- Подсказка -->
              <p class="text-center text-white/80 text-sm mt-4">
                Нажмите на круглую кнопку, чтобы сделать фото
              </p>
            </div>
          </div>
        </div>
      </div>
    </Transition>

  </div>
</template>

