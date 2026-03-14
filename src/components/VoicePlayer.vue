<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  /** URL аудиофайла (HTTP или blob:) */
  src: string
  /**
   * 'dark'  — плеер внутри синего пузыря (своё сообщение)
   * 'light' — плеер внутри белого пузыря (входящее)
   */
  variant?: 'dark' | 'light'
}>()

// ─── State ────────────────────────────────────────────────────────────────────
const isLoading = ref(true)
const hasError  = ref(false)
const isPlaying = ref(false)
const currentTime   = ref(0)
const audioDuration = ref(0)

let audioEl: HTMLAudioElement | null = null

// ─── Computed ─────────────────────────────────────────────────────────────────
const progress = computed(() => {
  if (!audioDuration.value || !isFinite(audioDuration.value)) return 0
  return Math.min(100, (currentTime.value / audioDuration.value) * 100)
})

const fmt = (s: number): string => {
  if (!isFinite(s) || isNaN(s) || s < 0) return '0:00'
  const m   = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${String(sec).padStart(2, '0')}`
}

const displayTime = computed(() => {
  if (isLoading.value) return '–:––'
  if (isPlaying.value || currentTime.value > 0) return fmt(currentTime.value)
  return fmt(audioDuration.value)
})

// ─── Load — напрямую через Audio, без fetch (нет CORS-ограничений для медиа) ──
const loadAudio = () => {
  audioEl = new Audio()

  audioEl.addEventListener('loadedmetadata', () => {
    audioDuration.value = audioEl!.duration
    isLoading.value = false
  })
  audioEl.addEventListener('timeupdate', () => {
    currentTime.value = audioEl!.currentTime
  })
  audioEl.addEventListener('ended', () => {
    isPlaying.value  = false
    currentTime.value = 0
  })
  audioEl.addEventListener('error', () => {
    hasError.value  = true
    isLoading.value = false
  })

  // Присваиваем src после подписки на события — браузер начнёт загрузку
  audioEl.src = props.src
  audioEl.load()
}

// ─── Controls ─────────────────────────────────────────────────────────────────
const togglePlay = async () => {
  if (!audioEl || isLoading.value || hasError.value) return
  if (isPlaying.value) {
    audioEl.pause()
    isPlaying.value = false
  } else {
    try {
      await audioEl.play()
      isPlaying.value = true
    } catch {
      isPlaying.value = false
    }
  }
}

const onSeek = (e: MouseEvent) => {
  if (!audioEl || !audioDuration.value || !isFinite(audioDuration.value)) return
  const bar   = e.currentTarget as HTMLElement
  const rect  = bar.getBoundingClientRect()
  const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  audioEl.currentTime = ratio * audioDuration.value
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────
onMounted(loadAudio)
onUnmounted(() => {
  audioEl?.pause()
  audioEl = null
})
</script>

<template>
  <div class="flex items-center gap-2 min-w-[200px] py-0.5 select-none">

    <!-- Play / Pause / Loading / Error -->
    <button
      @click="togglePlay"
      :disabled="isLoading || hasError"
      class="w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all active:scale-90 disabled:cursor-not-allowed"
      :class="variant === 'dark'
        ? 'bg-white/20 hover:bg-white/30 text-white disabled:opacity-40'
        : 'bg-blue-500 hover:bg-blue-600 text-white shadow-sm disabled:opacity-40'"
      type="button"
    >
      <!-- Spinner -->
      <svg v-if="isLoading" class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-30" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"/>
        <path class="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
      </svg>
      <!-- Ошибка -->
      <svg v-else-if="hasError" class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
      <!-- Пауза -->
      <svg v-else-if="isPlaying" class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M6 4h4v16H6zm8 0h4v16h-4z"/>
      </svg>
      <!-- Плей -->
      <svg v-else class="w-3.5 h-3.5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M8 5v14l11-7z"/>
      </svg>
    </button>

    <!-- Прогресс + время -->
    <div class="flex-1 flex flex-col gap-1.5">

      <!-- Прогресс-бар с перемоткой -->
      <div
        class="relative h-1.5 rounded-full overflow-visible cursor-pointer group"
        :class="variant === 'dark' ? 'bg-white/25' : 'bg-gray-200'"
        @click="onSeek"
      >
        <!-- Заполнение -->
        <div
          class="absolute inset-y-0 left-0 rounded-full"
          :class="variant === 'dark' ? 'bg-white' : 'bg-blue-500'"
          :style="{ width: `${progress}%` }"
        />
        <!-- Ползунок (появляется при hover) -->
        <div
          class="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full -ml-1.5
                 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
          :class="variant === 'dark' ? 'bg-white' : 'bg-blue-600'"
          :style="{ left: `${progress}%` }"
        />
      </div>

      <!-- Время -->
      <span
        class="text-[11px] tabular-nums leading-none"
        :class="variant === 'dark' ? 'text-white/70' : 'text-gray-400'"
      >{{ displayTime }}</span>

    </div>
  </div>
</template>

