<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { Picker, EmojiIndex } from 'emoji-mart-vue-fast/src'
import rawEmojiData from 'emoji-mart-vue-fast/data/all.json'
import 'emoji-mart-vue-fast/css/emoji-mart.css'
import { useAuthStore } from '@/stores/auth'
import { useChatStore } from '@/stores/chat'
import { useProfileStore } from '@/stores/profile'
import { apiClient } from '@/services/api'
import { getStatusEmoji } from '@/utils/statusConfig'
import type { Chat, Message } from '@/types/api'
import VoiceRecorder from '@/components/VoiceRecorder.vue'
import VoicePlayer from '@/components/VoicePlayer.vue'

const props = defineProps<{ chat: Chat }>()

const authStore = useAuthStore()
const chatStore = useChatStore()
const profileStore = useProfileStore()

const messageText = ref('')
const isSending = ref(false)
const sendError = ref<string | null>(null)
const messagesContainer = ref<HTMLElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)

// --- Pending file attachments ---
interface PendingFile {
  file: File
  previewUrl: string | null  // blob URL для изображений
  name: string
  sizeLabel: string
}

const pendingFiles = ref<PendingFile[]>([])

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`
}

const getAttachmentUrl = (filePath: string): string => {
  const apiUrl = (import.meta.env.VITE_API_URL as string) || 'http://localhost:8000/api/v1'
  const baseUrl = apiUrl.replace(/\/api\/v1\/?$/, '')
  return `${baseUrl}/storage/${filePath}`
}

const handleFileSelect = (e: Event) => {
  const input = e.target as HTMLInputElement
  if (!input.files?.length) return
  Array.from(input.files).forEach(file => {
    pendingFiles.value.push({
      file,
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
      name: file.name,
      sizeLabel: formatFileSize(file.size),
    })
  })
  input.value = '' // сброс — позволяет выбрать тот же файл снова
}

const removeFile = (index: number) => {
  const pf = pendingFiles.value[index]
  if (pf?.previewUrl) URL.revokeObjectURL(pf.previewUrl)
  pendingFiles.value.splice(index, 1)
}

const clearPendingFiles = () => {
  pendingFiles.value.forEach(pf => { if (pf.previewUrl) URL.revokeObjectURL(pf.previewUrl) })
  pendingFiles.value = []
}
// --- /Pending file attachments ---

// --- Emoji picker ---
const showEmojiPicker = ref(false)
const emojiPickerWrapRef = ref<HTMLElement | null>(null)
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const savedCaretPos = ref(0)

// EmojiIndex создаётся внутри компонента — не глобально (требование пакета)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const emojiIndex = new EmojiIndex(rawEmojiData as any)

const emojiI18n = {
  search: 'Поиск',
  clear: 'Очистить',
  notfound: 'Эмодзи не найдено',
  skintext: 'Выберите тон кожи',
  categories: {
    search: 'Результаты поиска',
    recent: 'Недавно использованные',
    smileys: 'Смайлики и эмоции',
    people: 'Люди и тело',
    nature: 'Животные и природа',
    foods: 'Еда и напитки',
    activity: 'Активность',
    places: 'Путешествия и места',
    objects: 'Предметы',
    symbols: 'Символы',
    flags: 'Флаги',
    custom: 'Пользовательские',
  },
  categorieslabel: 'Категории эмодзи',
  skintones: {
    1: 'Стандартный тон',
    2: 'Светлый тон',
    3: 'Светло-средний тон',
    4: 'Средний тон',
    5: 'Тёмно-средний тон',
    6: 'Тёмный тон',
  },
}

const saveCaretPos = () => {
  savedCaretPos.value = textareaRef.value?.selectionStart ?? messageText.value.length
}

const toggleEmojiPicker = () => {
  saveCaretPos()
  showEmojiPicker.value = !showEmojiPicker.value
}

const handleEmojiSelect = (emoji: { native?: string }) => {
  const symbol = emoji.native ?? ''
  if (!symbol) return

  const pos = savedCaretPos.value
  const text = messageText.value
  messageText.value = text.slice(0, pos) + symbol + text.slice(pos)

  const newPos = pos + symbol.length  // UTF-16 code units — совпадает с selectionStart
  savedCaretPos.value = newPos

  nextTick(() => {
    textareaRef.value?.focus()
    textareaRef.value?.setSelectionRange(newPos, newPos)
  })
}

const onClickOutsidePicker = (e: MouseEvent) => {
  if (emojiPickerWrapRef.value && !emojiPickerWrapRef.value.contains(e.target as Node)) {
    showEmojiPicker.value = false
  }
}

watch(showEmojiPicker, (val) => {
  if (val) {
    setTimeout(() => document.addEventListener('mousedown', onClickOutsidePicker), 0)
  } else {
    document.removeEventListener('mousedown', onClickOutsidePicker)
  }
})
// --- /Emoji picker ---

const messages = computed(() => chatStore.getMessagesForChat(props.chat.id))

const chatName = computed(() => {
  if (props.chat.type === 'private') {
    const other = props.chat.users?.find(u => u.id !== authStore.user?.id)
    return other?.name || other?.username || other?.email || 'Пользователь'
  }
  if (props.chat.type === 'favorites') return 'Избранное'
  return props.chat.name || 'Групповой чат'
})

const chatAvatar = computed(() => {
  if (props.chat.type === 'private') {
    const other = props.chat.users?.find(u => u.id !== authStore.user?.id)
    return (other?.name || '??').substring(0, 2).toUpperCase()
  }
  return (props.chat.name || 'ГЧ').substring(0, 2).toUpperCase()
})

const chatAvatarUrl = computed(() => {
  if (props.chat.type === 'private') {
    const other = props.chat.users?.find(u => u.id !== authStore.user?.id)
    return other?.avatar_url || null
  }
  return null // Для групповых чатов можно добавить групповой аватар позже
})

const otherUser = computed(() =>
  props.chat.type === 'private'
    ? props.chat.users?.find(u => u.id !== authStore.user?.id)
    : null
)

const isOnline = computed(() => otherUser.value?.status === 'online')

/**
 * Строка статуса под именем собеседника, когда он онлайн.
 * Примеры: "Готов поболтать", "В сети · Пишу код", "Готов поболтать · Пишу код"
 */
const onlineStatusLabel = computed(() => {
  const user = otherUser.value
  if (!user) return 'В сети'
  // Если есть кастомный текст — показываем только его
  const custom = user.custom_status?.trim() || null
  if (custom) return custom
  // Иначе — название статуса (или «В сети» для дефолтного)
  const moodKey = user.online_status
  if (moodKey && moodKey !== 'online') {
    return profileStore.availableStatuses[moodKey] ?? 'В сети'
  }
  return 'В сети'
})

/** Эмодзи для текущего статуса собеседника */
const onlineStatusEmoji = computed(() =>
  getStatusEmoji(otherUser.value?.online_status)
)

// Реактивное "сейчас" — обновляется каждые 30 с, чтобы "N мин. назад" не замерзало
const now = ref(Date.now())
let clockTimer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  clockTimer = setInterval(() => { now.value = Date.now() }, 30_000)
})

onUnmounted(() => {
  if (clockTimer) clearInterval(clockTimer)
})

const formatLastSeen = (dateStr: string): string => {
  const date = new Date(dateStr)
  const diffMs = now.value - date.getTime()
  const diffMins = Math.floor(diffMs / 60_000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'только что'
  if (diffMins < 60) return `${diffMins} мин. назад`
  if (diffHours < 24) return `сегодня в ${date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`
  if (diffDays === 1) return `вчера в ${date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: 'long' })
}

const scrollToBottom = async () => {
  await nextTick()
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

// Отложенная пометка как прочитанное (debounce для избежания лишних вызовов)
let markAsReadTimeout: ReturnType<typeof setTimeout> | null = null
const markMessagesAsRead = async () => {
  if (markAsReadTimeout) clearTimeout(markAsReadTimeout)

  markAsReadTimeout = setTimeout(async () => {
    if (props.chat.unread_count && props.chat.unread_count > 0) {
      const oldCount = props.chat.unread_count
      props.chat.unread_count = 0

      try {
        await apiClient.markChatAsRead(props.chat.id)
      } catch (err) {
        console.error('Failed to mark chat as read:', err)
        props.chat.unread_count = oldCount
      }
    }
  }, 300) // 300ms задержка
}

// Следим за изменениями сообщений и автоматически помечаем как прочитанные
watch(messages, async () => {
  await scrollToBottom()
  // Помечаем сообщения как прочитанные если есть непрочитанные
  if (messages.value.length > 0) {
    markMessagesAsRead()
  }
}, { deep: true })

onMounted(() => {
  scrollToBottom()
  // При монтировании также помечаем как прочитанные если есть непрочитанные
  markMessagesAsRead()
})

const formatTime = (dateStr: string) => {
  return new Date(dateStr).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

const isOwn = (msg: Message) => (msg.sender?.id ?? msg.sender_id) === authStore.user?.id
const getSenderName = (msg: Message) => msg.sender?.name || '?'
const getSenderAvatar = (msg: Message) => (msg.sender?.name || '?').substring(0, 2).toUpperCase()
const getSenderAvatarUrl = (msg: Message) => msg.sender?.avatar_url || null

// --- Лайтбокс для изображений ---
const lightboxUrl = ref<string | null>(null)
const openImage = (url: string) => { lightboxUrl.value = url }
const closeLightbox = () => { lightboxUrl.value = null }

// Закрытие по Escape
const onKeydownLightbox = (e: KeyboardEvent) => {
  if (e.key === 'Escape') closeLightbox()
}
watch(lightboxUrl, (val) => {
  if (val) document.addEventListener('keydown', onKeydownLightbox)
  else document.removeEventListener('keydown', onKeydownLightbox)
})
// --- /Лайтбокс ---

const handleSend = async () => {
  const text = messageText.value.trim()
  const hasFiles = pendingFiles.value.length > 0
  if ((!text && !hasFiles) || isSending.value) return

  sendError.value = null
  isSending.value = true

  const savedText = text
  if (text) messageText.value = ''
  const filesToSend = pendingFiles.value.length > 0 ? [...pendingFiles.value] : []
  if (filesToSend.length) clearPendingFiles()

  try {
    if (savedText) await chatStore.sendMessage(props.chat.id, savedText)
    for (const pf of filesToSend) {
      await chatStore.sendFileMessage(props.chat.id, pf.file)
    }
  } catch (err) {
    sendError.value = 'Не удалось отправить сообщение'
    if (savedText && !messageText.value) messageText.value = savedText
    console.error('Send failed:', err)
  } finally {
    isSending.value = false
  }
}

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    if (messageText.value.trim() || pendingFiles.value.length > 0) handleSend()
  }
}

const handleAttach = () => fileInputRef.value?.click()
const handleVoice = () => { showVoiceRecorder.value = true }

// ─── Voice recorder ───────────────────────────────────────────────────────────
const showVoiceRecorder = ref(false)

const handleVoiceSend = async (file: File) => {
  showVoiceRecorder.value = false
  isSending.value = true
  sendError.value = null
  try {
    await chatStore.sendFileMessage(props.chat.id, file)
  } catch (err) {
    sendError.value = 'Не удалось отправить голосовое сообщение'
    console.error('Voice send failed:', err)
  } finally {
    isSending.value = false
  }
}

const handleVoiceCancel = () => {
  showVoiceRecorder.value = false
}
// ─── /Voice recorder ──────────────────────────────────────────────────────────

onUnmounted(() => {
  if (clockTimer) clearInterval(clockTimer)
  if (markAsReadTimeout) clearTimeout(markAsReadTimeout)
  document.removeEventListener('mousedown', onClickOutsidePicker)
  document.removeEventListener('keydown', onKeydownLightbox)
  pendingFiles.value.forEach(pf => { if (pf.previewUrl) URL.revokeObjectURL(pf.previewUrl) })
})
</script>

<template>
  <div class="flex flex-col h-full bg-[#f0f2f5]">

    <!-- Header -->
    <div class="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-100 shadow-sm z-10">
      <div class="relative flex-shrink-0">
        <!-- Фото или инициалы -->
        <div class="w-10 h-10 rounded-full overflow-hidden ring-2 ring-white shadow-sm">
          <img
            v-if="chatAvatarUrl"
            :src="chatAvatarUrl"
            :alt="chatName"
            class="w-full h-full object-cover"
          />
          <div
            v-else
            class="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm select-none"
          >
            {{ chatAvatar }}
          </div>
        </div>
        <!-- Индикатор онлайн -->
        <span
          v-if="chat.type === 'private'"
          class="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white transition-colors"
          :class="isOnline ? 'bg-green-400' : 'bg-gray-300'"
        />
      </div>

      <div class="flex-1 min-w-0">
        <h3 class="font-semibold text-gray-900 truncate leading-tight">{{ chatName }}</h3>
        <p class="text-xs leading-tight mt-0.5" :class="isOnline ? 'text-green-500' : 'text-gray-400'">
          <span v-if="chat.type === 'private'">
            <template v-if="isOnline">
              <span class="flex items-center gap-1.5">
                <span class="text-sm leading-none">{{ onlineStatusEmoji }}</span>
                <span>{{ onlineStatusLabel }}</span>
              </span>
            </template>
            <template v-else-if="otherUser?.last_seen_at">
              <span class="flex items-center gap-1.5">
                <span class="text-sm leading-none">🕐</span>
                <span>был(а) {{ formatLastSeen(otherUser.last_seen_at) }}</span>
              </span>
            </template>
            <template v-else>Не в сети</template>
          </span>
          <span v-else class="text-gray-400">{{ chat.users?.length || 0 }} участников</span>
        </p>
      </div>
    </div>

    <!-- Messages -->
    <div ref="messagesContainer" class="flex-1 overflow-y-auto px-4 py-4 space-y-1">

      <!-- Empty state -->
      <div v-if="messages.length === 0" class="flex flex-col items-center justify-center h-full gap-3">
        <div class="w-16 h-16 rounded-full bg-white shadow flex items-center justify-center">
          <svg class="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <p class="text-gray-500 text-sm">Нет сообщений. Начните переписку!</p>
      </div>

      <!-- Message rows -->
      <template v-for="msg in messages" :key="msg.id">

        <!-- Own message (right) -->
        <div v-if="isOwn(msg)" class="flex justify-end items-end gap-1">
          <div class="flex flex-col items-end">
            <div class="bg-blue-500 text-white rounded-2xl rounded-br-sm px-4 py-2 max-w-xs md:max-w-md lg:max-w-lg shadow-sm">
              <!-- Image attachment -->
              <template v-if="msg.type === 'image' && msg.attachments?.length">
                <img
                  :src="getAttachmentUrl(msg.attachments[0]!.file_path)"
                  :alt="msg.attachments[0]!.name"
                  class="rounded-xl max-w-full max-h-60 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                  @click="openImage(getAttachmentUrl(msg.attachments[0]!.file_path))"
                />
              </template>
              <!-- Voice attachment -->
              <template v-else-if="msg.type === 'voice' && msg.attachments?.length">
                <div class="flex items-center gap-2 py-1">
                  <svg class="w-4 h-4 opacity-75 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3zm-1 3a1 1 0 012 0v8a1 1 0 01-2 0V4zM7 11a5 5 0 0010 0 1 1 0 012 0 7 7 0 01-6 6.93V21a1 1 0 01-2 0v-3.07A7 7 0 015 12a1 1 0 012 0z"/>
                  </svg>
                  <VoicePlayer
                    :src="getAttachmentUrl(msg.attachments[0]!.file_path)"
                    variant="dark"
                  />
                </div>
              </template>
              <!-- File attachment -->
              <template v-else-if="msg.attachments?.length">
                <a
                  :href="getAttachmentUrl(msg.attachments[0]!.file_path)"
                  :download="msg.attachments[0]!.name"
                  target="_blank"
                  class="flex items-center gap-3 py-1 text-white hover:opacity-80 transition-opacity"
                >
                  <div class="w-9 h-9 rounded-lg bg-blue-400/50 flex items-center justify-center shrink-0">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
                    </svg>
                  </div>
                  <div class="min-w-0">
                    <p class="text-sm font-medium truncate max-w-[180px]">{{ msg.attachments[0]!.name }}</p>
                    <p class="text-xs opacity-75">{{ formatFileSize(msg.attachments[0]!.size) }}</p>
                  </div>
                  <svg class="w-4 h-4 shrink-0 opacity-75" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                  </svg>
                </a>
              </template>
              <!-- Text content -->
              <p v-if="msg.content && msg.type === 'text'" class="text-sm whitespace-pre-wrap break-words leading-relaxed">{{ msg.content }}</p>
            </div>
            <div class="flex items-center gap-1 mt-1 px-1">
              <span class="text-xs text-gray-400">{{ formatTime(msg.created_at) }}</span>
              <svg v-if="msg.read_at" class="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
              </svg>
              <svg v-else class="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
        </div>

        <!-- Incoming message (left) -->
        <div v-else class="flex items-end gap-2">
          <!-- Аватар отправителя -->
          <div class="w-8 h-8 rounded-full overflow-hidden shrink-0 shadow-sm ring-2 ring-white">
            <img
              v-if="getSenderAvatarUrl(msg)"
              :src="getSenderAvatarUrl(msg)!"
              :alt="getSenderName(msg)"
              class="w-full h-full object-cover"
            />
            <div
              v-else
              class="w-full h-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-xs font-semibold"
            >
              {{ getSenderAvatar(msg) }}
            </div>
          </div>
          <div class="flex flex-col items-start max-w-xs md:max-w-md lg:max-w-lg">
            <span v-if="chat.type === 'group'" class="text-xs font-medium text-blue-500 mb-1 ml-1">
              {{ getSenderName(msg) }}
            </span>
            <div class="bg-white text-gray-900 rounded-2xl rounded-bl-sm px-4 py-2 shadow-sm border border-gray-100">
              <!-- Image attachment -->
              <template v-if="msg.type === 'image' && msg.attachments?.length">
                <img
                  :src="getAttachmentUrl(msg.attachments[0]!.file_path)"
                  :alt="msg.attachments[0]!.name"
                  class="rounded-xl max-w-full max-h-60 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                  @click="openImage(getAttachmentUrl(msg.attachments[0]!.file_path))"
                />
              </template>
              <!-- Voice attachment -->
              <template v-else-if="msg.type === 'voice' && msg.attachments?.length">
                <div class="flex items-center gap-2 py-1">
                  <svg class="w-4 h-4 text-blue-400 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3zm-1 3a1 1 0 012 0v8a1 1 0 01-2 0V4zM7 11a5 5 0 0010 0 1 1 0 012 0 7 7 0 01-6 6.93V21a1 1 0 01-2 0v-3.07A7 7 0 015 12a1 1 0 012 0z"/>
                  </svg>
                  <VoicePlayer
                    :src="getAttachmentUrl(msg.attachments[0]!.file_path)"
                    variant="light"
                  />
                </div>
              </template>
              <!-- File attachment -->
              <template v-else-if="msg.attachments?.length">
                <a
                  :href="getAttachmentUrl(msg.attachments[0]!.file_path)"
                  :download="msg.attachments[0]!.name"
                  target="_blank"
                  class="flex items-center gap-3 py-1 text-gray-700 hover:text-gray-900 transition-colors"
                >
                  <div class="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                    <svg class="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
                    </svg>
                  </div>
                  <div class="min-w-0">
                    <p class="text-sm font-medium truncate max-w-[180px]">{{ msg.attachments[0]!.name }}</p>
                    <p class="text-xs text-gray-400">{{ formatFileSize(msg.attachments[0]!.size) }}</p>
                  </div>
                  <svg class="w-4 h-4 shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                  </svg>
                </a>
              </template>
              <!-- Text content -->
              <p v-if="msg.content && msg.type === 'text'" class="text-sm whitespace-pre-wrap break-words leading-relaxed">{{ msg.content }}</p>
            </div>
            <span class="text-xs text-gray-400 mt-1 ml-1">{{ formatTime(msg.created_at) }}</span>
          </div>
        </div>

      </template>
    </div>

    <!-- Input area -->
    <div class="bg-white border-t border-gray-100 px-4 py-3 shadow-[0_-1px_4px_rgba(0,0,0,0.04)]">

      <!-- Ошибка отправки -->
      <div v-if="sendError" class="flex items-center gap-2 mb-2 px-1 text-red-500 text-xs">
        <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        {{ sendError }}
      </div>

      <!-- Режим записи голосового -->
      <VoiceRecorder
        v-if="showVoiceRecorder"
        @send="handleVoiceSend"
        @cancel="handleVoiceCancel"
      />

      <!-- Обычный режим ввода -->
      <template v-else>

        <!-- Превью выбранных файлов -->
        <div v-if="pendingFiles.length > 0" class="flex flex-wrap gap-2 mb-3">
          <div v-for="(pf, index) in pendingFiles" :key="index" class="relative group">
            <div v-if="pf.previewUrl" class="w-20 h-20 rounded-xl overflow-hidden border border-gray-200 shadow-sm">
              <img :src="pf.previewUrl" :alt="pf.name" class="w-full h-full object-cover" />
            </div>
            <div v-else class="w-20 h-20 rounded-xl bg-gray-100 border border-gray-200 flex flex-col items-center justify-center gap-1 px-2 shadow-sm">
              <svg class="w-7 h-7 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
              </svg>
              <span class="text-xs text-gray-500 truncate w-full text-center leading-tight">{{ pf.name }}</span>
              <span class="text-xs text-gray-400">{{ pf.sizeLabel }}</span>
            </div>
            <button
              @click="removeFile(index)"
              class="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gray-700 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow"
              type="button" title="Удалить"
            >
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- Строка ввода -->
        <div class="flex items-end gap-2">

          <!-- Left: emoji + attach -->
          <div class="flex gap-0.5 pb-1.5">

            <!-- Emoji button + picker -->
            <div ref="emojiPickerWrapRef" class="relative" @dblclick.stop>
              <button
                @click="toggleEmojiPicker"
                class="p-2 rounded-full transition-colors"
                :class="showEmojiPicker
                  ? 'text-yellow-500 bg-yellow-50'
                  : 'text-gray-400 hover:text-yellow-500 hover:bg-gray-100'"
                title="Эмодзи" type="button"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
              <div
                v-if="showEmojiPicker"
                class="absolute bottom-full left-0 mb-2 z-50 shadow-xl rounded-xl overflow-hidden"
              >
                <Picker
                  :data="emojiIndex"
                  :native="true"
                  :emoji-size="24"
                  :show-preview="false"
                  :show-skin-tones="false"
                  title="Эмодзи"
                  emoji="point_up"
                  color="#3b82f6"
                  :i18n="emojiI18n"
                  @select="handleEmojiSelect"
                />
              </div>
            </div>

            <!-- Attach button -->
            <button
              @click="handleAttach"
              class="p-2 text-gray-400 hover:text-blue-500 hover:bg-gray-100 rounded-full transition-colors"
              title="Прикрепить файл" type="button"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            </button>
          </div>

          <!-- Text input -->
          <div class="flex-1">
            <textarea
              ref="textareaRef"
              v-model="messageText"
              @keydown="handleKeydown"
              @click="saveCaretPos"
              @keyup="saveCaretPos"
              placeholder="Написать сообщение..."
              rows="1"
              :disabled="isSending"
              class="w-full resize-none rounded-2xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-shadow max-h-36 overflow-y-auto disabled:opacity-60"
              style="line-height: 1.5;"
            />
          </div>

          <!-- Right: voice + send -->
          <div class="flex gap-0.5 pb-1.5">
            <button
              v-if="!messageText.trim() && pendingFiles.length === 0 && !isSending"
              @click="handleVoice"
              class="p-2.5 text-gray-400 hover:text-red-500 hover:bg-gray-100 rounded-full transition-colors"
              title="Голосовое сообщение" type="button"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </button>

            <button
              v-if="messageText.trim() || pendingFiles.length > 0 || isSending"
              @click="handleSend"
              :disabled="isSending || (!messageText.trim() && pendingFiles.length === 0)"
              class="p-2.5 bg-blue-500 text-white rounded-full hover:bg-blue-600 active:scale-95 transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
              title="Отправить" type="button"
            >
              <svg v-if="isSending" class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>

        </div>

        <!-- Hidden file input -->
        <input ref="fileInputRef" type="file" multiple class="hidden" @change="handleFileSelect" />

      </template>
    </div>


    <!-- Lightbox -->
    <Teleport to="body">
      <div
        v-if="lightboxUrl"
        class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
        @click.self="closeLightbox"
      >
        <!-- Close button -->
        <button
          @click="closeLightbox"
          class="absolute top-4 right-4 w-10 h-10 flex items-center justify-center text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors"
          title="Закрыть (Esc)"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
        <!-- Image -->
        <img
          :src="lightboxUrl"
          class="max-w-[90vw] max-h-[90vh] object-contain rounded-xl shadow-2xl"
          @click.stop
        />
        <!-- Open in new tab -->
        <a
          :href="lightboxUrl"
          target="_blank"
          rel="noopener"
          class="absolute bottom-4 right-4 flex items-center gap-2 px-4 py-2 text-sm text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
          </svg>
          Открыть оригинал
        </a>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
/*
 * Когда native=true, EmojiView устанавливает font-size через inline-style (emojiSize * 0.95).
 * CSS-правило ниже — fallback на случай если inline-style не применился.
 * Без !important, чтобы inline-style имел приоритет.
 */
:deep(.emoji-mart-emoji span) {
  font-size: 22px;
  line-height: 1;
}

:deep(.emoji-mart) {
  font-family: inherit;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
}

:deep(.emoji-mart-search input) {
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  background: #f9fafb;
  font-size: 13px;
}

:deep(.emoji-mart-search input:focus) {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

:deep(.emoji-mart-category-label span) {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #9ca3af;
}

:deep(.emoji-mart-anchor-icon svg) {
  fill: #9ca3af;
}
:deep(.emoji-mart-anchor-selected .emoji-mart-anchor-icon svg) {
  fill: #3b82f6;
}
:deep(.emoji-mart-anchor-bar) {
  background-color: #3b82f6 !important;
}
</style>

