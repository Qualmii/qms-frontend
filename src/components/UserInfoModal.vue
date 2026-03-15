<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import type { User } from '@/types/api'
import { getStatusEmoji } from '@/utils/statusConfig'

interface Props {
  user: User | null
  show: boolean
}

interface Emits {
  (e: 'close'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const avatarUrl = computed(() => {
  if (!props.user?.avatar_url) return null
  // Если URL уже полный (начинается с http), используем его как есть
  if (props.user.avatar_url.startsWith('http')) {
    return props.user.avatar_url
  }
  // Иначе добавляем базовый URL
  const base = import.meta.env.VITE_API_URL.replace(/\/api\/v1\/?$/, '')
  return `${base}${props.user.avatar_url}`
})

const displayName = computed(() => {
  if (!props.user) return ''
  return props.user.name || props.user.username || props.user.email || 'Пользователь'
})

const avatarInitials = computed(() => {
  if (!props.user) return '?'
  const name = displayName.value
  const words = name.split(' ').filter(w => w.length > 0)
  if (words.length === 0) return '?'
  if (words.length === 1) return (words[0] ?? '?').charAt(0).toUpperCase()
  return ((words[0] ?? '').charAt(0) + (words[words.length - 1] ?? '').charAt(0)).toUpperCase()
})

const isOnline = computed(() => props.user?.status === 'online')

const statusEmoji = computed(() => {
  if (!props.user?.online_status) return ''
  return getStatusEmoji(props.user.online_status)
})

const formatLastSeen = (timestamp: string) => {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'только что'
  if (minutes < 60) return `${minutes} мин. назад`
  if (hours < 24) return `${hours} ч. назад`
  if (days === 1) return 'вчера'
  if (days < 7) return `${days} дн. назад`

  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

const handleClose = () => {
  emit('close')
}

const handleBackdropClick = (e: MouseEvent) => {
  if (e.target === e.currentTarget) {
    handleClose()
  }
}

// Лайтбокс для аватара
const showAvatarLightbox = ref(false)

const openAvatarLightbox = () => {
  if (avatarUrl.value) {
    showAvatarLightbox.value = true
  }
}

const closeAvatarLightbox = () => {
  showAvatarLightbox.value = false
}

const handleLightboxBackdrop = (e: MouseEvent) => {
  if (e.target === e.currentTarget) {
    closeAvatarLightbox()
  }
}

// Закрытие лайтбокса по Escape
const onKeydownEscape = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    closeAvatarLightbox()
  }
}

watch(showAvatarLightbox, (val) => {
  if (val) {
    document.addEventListener('keydown', onKeydownEscape)
  } else {
    document.removeEventListener('keydown', onKeydownEscape)
  }
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydownEscape)
})
</script>

<template>
  <Transition name="modal">
    <div
      v-if="show && user"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      @click="handleBackdropClick"
    >
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <!-- Header -->
        <div class="relative bg-gradient-to-br from-blue-500 to-purple-600 px-6 py-8">
          <button
            @click="handleClose"
            class="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm flex items-center justify-center text-white transition-colors"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <!-- Avatar -->
          <div class="flex justify-center mb-4">
            <div class="relative">
              <div
                class="w-24 h-24 rounded-full overflow-hidden ring-4 ring-white/30 shadow-lg transition-all"
                :class="avatarUrl ? 'cursor-pointer hover:ring-white/50 hover:scale-105' : ''"
                @click="openAvatarLightbox"
              >
                <img
                  v-if="avatarUrl"
                  :src="avatarUrl"
                  :alt="displayName"
                  class="w-full h-full object-cover"
                />
                <div
                  v-else
                  class="w-full h-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white font-bold text-3xl"
                >
                  {{ avatarInitials }}
                </div>
              </div>
              <!-- Иконка увеличения при наведении -->
              <div
                v-if="avatarUrl"
                class="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer bg-black/20 rounded-full"
                @click="openAvatarLightbox"
              >
                <svg class="w-8 h-8 text-white drop-shadow-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                </svg>
              </div>
              <!-- Online indicator -->
              <span
                class="absolute bottom-1 right-1 w-6 h-6 rounded-full border-4 border-white/50 transition-colors"
                :class="isOnline ? 'bg-green-400' : 'bg-gray-400'"
              />
            </div>
          </div>

          <!-- Name -->
          <h2 class="text-center text-white font-bold text-2xl">
            {{ displayName }}
          </h2>
        </div>

        <!-- Info -->
        <div class="p-6 space-y-4">
          <!-- Username -->
          <div v-if="user.username" class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
              <svg class="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-xs text-gray-500 dark:text-gray-400">Имя пользователя</p>
              <p class="text-sm font-medium text-gray-900 dark:text-white truncate">@{{ user.username }}</p>
            </div>
          </div>

          <!-- UIN -->
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
              <svg class="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
              </svg>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-xs text-gray-500 dark:text-gray-400">UIN</p>
              <p class="text-sm font-medium text-gray-900 dark:text-white font-mono">{{ user.uin }}</p>
            </div>
          </div>

          <!-- Status -->
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
              <span class="text-xl">{{ statusEmoji || '📡' }}</span>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-xs text-gray-500 dark:text-gray-400">Статус</p>
              <p
                class="text-sm font-medium truncate"
                :class="isOnline ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'"
              >
                <template v-if="isOnline">
                  {{ user.custom_status || 'В сети' }}
                </template>
                <template v-else-if="user.last_seen_at">
                  был(а) {{ formatLastSeen(user.last_seen_at) }}
                </template>
                <template v-else>
                  Не в сети
                </template>
              </p>
            </div>
          </div>

          <!-- Email (optional) -->
          <div v-if="user.email" class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
              <svg class="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-xs text-gray-500 dark:text-gray-400">Email</p>
              <p class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ user.email }}</p>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="px-6 pb-6">
          <button
            @click="handleClose"
            class="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-medium rounded-xl transition-colors"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  </Transition>

  <!-- Lightbox для аватара -->
  <Transition name="modal">
    <div
      v-if="showAvatarLightbox && avatarUrl"
      class="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-sm"
      @click="handleLightboxBackdrop"
    >
      <!-- Close button -->
      <button
        @click="closeAvatarLightbox"
        class="absolute top-4 right-4 w-12 h-12 flex items-center justify-center text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors z-10"
        title="Закрыть (Esc)"
      >
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>

      <!-- Avatar Image -->
      <img
        :src="avatarUrl"
        :alt="displayName"
        class="max-w-[90vw] max-h-[90vh] object-contain rounded-2xl shadow-2xl"
        @click.stop
      />

      <!-- User info overlay -->
      <div class="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-3 px-6 py-3 bg-white/10 backdrop-blur-md rounded-full">
        <span class="text-white font-semibold text-lg">{{ displayName }}</span>
        <span
          class="w-3 h-3 rounded-full"
          :class="isOnline ? 'bg-green-400' : 'bg-gray-400'"
        />
      </div>

      <!-- Open in new tab -->
      <a
        :href="avatarUrl"
        target="_blank"
        rel="noopener"
        class="absolute bottom-8 right-8 flex items-center gap-2 px-4 py-2 text-sm text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
        </svg>
        Открыть оригинал
      </a>
    </div>
  </Transition>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-active .bg-white,
.modal-leave-active .bg-white {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .bg-white,
.modal-leave-to .bg-white {
  transform: scale(0.9);
  opacity: 0;
}
</style>

