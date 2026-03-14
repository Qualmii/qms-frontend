<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import fixWebmDuration from 'fix-webm-duration'

const emit = defineEmits<{
  send: [file: File]
  cancel: []
}>()

// ─── State ────────────────────────────────────────────────────────────────────
type RecState = 'recording' | 'paused' | 'stopped'
const state     = ref<RecState>('recording')
const duration  = ref(0)
const previewUrl = ref<string | null>(null)
const errorMsg  = ref<string | null>(null)

let mediaRecorder: MediaRecorder | null = null
let audioChunks: Blob[] = []
let stream: MediaStream | null = null
let timerInterval: ReturnType<typeof setInterval> | null = null
let mimeType = 'audio/webm'

// Точный трекинг длительности в миллисекундах (для fixWebmDuration)
let recordStartTimestamp: number | null = null
let accumulatedMs = 0
let fixedBlob: Blob | null = null

const getTotalDurationMs = () =>
  accumulatedMs + (recordStartTimestamp != null ? Date.now() - recordStartTimestamp : 0)

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formattedDuration = computed(() => {
  const m = Math.floor(duration.value / 60)
  const s = duration.value % 60
  return `${m}:${String(s).padStart(2, '0')}`
})

const startTimer = () => {
  timerInterval = setInterval(() => duration.value++, 1000)
}
const stopTimer = () => {
  if (timerInterval !== null) { clearInterval(timerInterval); timerInterval = null }
}
const revokePreview = () => {
  if (previewUrl.value) { URL.revokeObjectURL(previewUrl.value); previewUrl.value = null }
}

/** Строим превью-блоб, при необходимости исправляя duration-метаданные WebM */
const buildPreview = async (durationMs?: number) => {
  revokePreview()
  let blob = new Blob(audioChunks, { type: mimeType })
  if (blob.size === 0) return
  if (durationMs !== undefined && mimeType.includes('webm')) {
    blob = await fixWebmDuration(blob, durationMs, { logger: false })
  }
  fixedBlob = blob
  previewUrl.value = URL.createObjectURL(blob)
}

const stopStream = () => stream?.getTracks().forEach(t => t.stop())

// ─── Core recording ops ───────────────────────────────────────────────────────
const stopRecorderAsync = (): Promise<void> => {
  // Фиксируем длительность прямо сейчас, до остановки рекордера
  const durationMs = getTotalDurationMs()
  recordStartTimestamp = null

  if (!mediaRecorder || mediaRecorder.state === 'inactive') {
    return buildPreview(durationMs).then(() => { state.value = 'stopped' })
  }
  return new Promise((resolve) => {
    mediaRecorder!.addEventListener('stop', async () => {
      await buildPreview(durationMs)
      state.value = 'stopped'
      stopStream()
      resolve()
    }, { once: true })
    try { mediaRecorder!.requestData() } catch { /* ignore */ }
    mediaRecorder!.stop()
  })
}

// ─── Public actions ───────────────────────────────────────────────────────────
const pause = () => {
  if (mediaRecorder?.state !== 'recording') return
  try { mediaRecorder.requestData() } catch { /* ignore */ }
  mediaRecorder.pause()
  state.value = 'paused'
  stopTimer()
  // Накапливаем прошедшие мс перед паузой
  if (recordStartTimestamp != null) {
    accumulatedMs += Date.now() - recordStartTimestamp
    recordStartTimestamp = null
  }
  buildPreview(accumulatedMs) // fire-and-forget: обновляем превью с правильной длиной
}

const resume = () => {
  if (mediaRecorder?.state !== 'paused') return
  revokePreview()
  fixedBlob = null
  mediaRecorder.resume()
  state.value = 'recording'
  recordStartTimestamp = Date.now() // возобновляем отсчёт
  startTimer()
}

const stop = async () => {
  stopTimer()
  await stopRecorderAsync()
}

const cancel = () => {
  stopTimer()
  recordStartTimestamp = null
  accumulatedMs = 0
  fixedBlob = null
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.onstop = null
    try { mediaRecorder.stop() } catch { /* ignore */ }
  }
  stopStream()
  revokePreview()
  audioChunks = []
  emit('cancel')
}

const send = async () => {
  if (state.value === 'recording' || state.value === 'paused') {
    stopTimer()
    await stopRecorderAsync()
  }

  // Используем уже исправленный блоб (fixWebmDuration применён в buildPreview)
  const blob = fixedBlob ?? new Blob(audioChunks, { type: mimeType })
  if (blob.size === 0) { cancel(); return }

  const ext = mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mp4') ? 'm4a' : 'webm'
  const file = new File([blob], `voice_${Date.now()}.${ext}`, { type: mimeType })

  revokePreview()
  fixedBlob = null
  audioChunks = []
  emit('send', file)
}

// ─── Init (auto-start on mount) ───────────────────────────────────────────────
const init = async () => {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true })

    const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']
    mimeType = candidates.find(t => MediaRecorder.isTypeSupported(t)) ?? 'audio/webm'

    audioChunks = []
    duration.value = 0
    state.value = 'recording'
    errorMsg.value = null
    accumulatedMs = 0
    fixedBlob = null

    mediaRecorder = new MediaRecorder(stream, { mimeType })
    mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.push(e.data) }
    mediaRecorder.start(100)
    recordStartTimestamp = Date.now() // начинаем точный отсчёт
    startTimer()
  } catch {
    errorMsg.value = 'Нет доступа к микрофону. Разрешите доступ и попробуйте снова.'
    emit('cancel')
  }
}

onUnmounted(() => {
  stopTimer()
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    try { mediaRecorder.stop() } catch { /* ignore */ }
  }
  stopStream()
  revokePreview()
})

init()
</script>

<template>
  <div class="w-full">
    <!-- Ошибка доступа к микрофону -->
    <div v-if="errorMsg" class="text-red-500 text-sm py-2 text-center">{{ errorMsg }}</div>

    <div v-else class="flex flex-col gap-2">

      <!-- Основная строка управления -->
      <div class="flex items-center gap-2">

        <!-- Отмена -->
        <button
          @click="cancel"
          class="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors shrink-0"
          title="Отменить запись"
          type="button"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
          </svg>
        </button>

        <!-- Индикатор + таймер -->
        <div class="flex items-center gap-2 flex-1 min-w-0">
          <span
            class="w-2.5 h-2.5 rounded-full shrink-0 transition-colors"
            :class="state === 'recording' ? 'bg-red-500 animate-pulse' : 'bg-gray-400'"
          />
          <span class="text-sm font-mono font-semibold tabular-nums text-gray-800 w-12 shrink-0">
            {{ formattedDuration }}
          </span>
          <span class="text-xs text-gray-400 truncate">
            {{ state === 'recording' ? 'Идёт запись...' : state === 'paused' ? 'Пауза' : 'Запись остановлена' }}
          </span>
        </div>

        <!-- Пауза (только при записи) -->
        <button
          v-if="state === 'recording'"
          @click="pause"
          class="p-2 text-gray-500 hover:text-blue-500 hover:bg-blue-50 rounded-full transition-colors shrink-0"
          title="Пауза"
          type="button"
        >
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 4h4v16H6zm8 0h4v16h-4z"/>
          </svg>
        </button>

        <!-- Продолжить (только на паузе) -->
        <button
          v-else-if="state === 'paused'"
          @click="resume"
          class="p-2 text-blue-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors shrink-0"
          title="Продолжить запись"
          type="button"
        >
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z"/>
          </svg>
        </button>

        <!-- Стоп (при записи или паузе) -->
        <button
          v-if="state === 'recording' || state === 'paused'"
          @click="stop"
          class="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-full transition-colors shrink-0"
          title="Остановить"
          type="button"
        >
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <rect x="4" y="4" width="16" height="16" rx="2"/>
          </svg>
        </button>

        <!-- Отправить -->
        <button
          @click="send"
          class="p-2.5 bg-blue-500 text-white rounded-full hover:bg-blue-600 active:scale-95 transition-all shadow-sm shrink-0"
          title="Отправить"
          type="button"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
          </svg>
        </button>
      </div>

      <!-- Предпросмотр (на паузе или после остановки) -->
      <div
        v-if="(state === 'paused' || state === 'stopped') && previewUrl"
        class="px-1"
      >
        <audio :src="previewUrl" controls class="w-full" style="height:36px" />
      </div>

    </div>
  </div>
</template>

<style scoped>
audio {
  border-radius: 8px;
  outline: none;
  width: 100%;
}
</style>

