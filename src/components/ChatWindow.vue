<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useChatStore } from '@/stores/chat'
import type { Chat, Message } from '@/types/api'

const props = defineProps<{ chat: Chat }>()

const authStore = useAuthStore()
const chatStore = useChatStore()

const messageText = ref('')
const messagesContainer = ref<HTMLElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)

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

const otherUser = computed(() =>
  props.chat.type === 'private'
    ? props.chat.users?.find(u => u.id !== authStore.user?.id)
    : null
)

const isOnline = computed(() => otherUser.value?.status === 'online')

const scrollToBottom = async () => {
  await nextTick()
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

watch(messages, () => scrollToBottom(), { deep: true })
onMounted(() => scrollToBottom())

const formatTime = (dateStr: string) => {
  return new Date(dateStr).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

const isOwn = (msg: Message) => msg.sender_id === authStore.user?.id

const getSenderName = (msg: Message) => msg.sender?.name || '?'

const getSenderAvatar = (msg: Message) =>
  (msg.sender?.name || '?').substring(0, 2).toUpperCase()

const handleSend = () => {
  // функционал будет реализован на следующем этапе
  messageText.value = ''
}

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    if (messageText.value.trim()) handleSend()
  }
}

const handleAttach = () => fileInputRef.value?.click()
const handleEmojiClick = () => { /* следующий этап */ }
const handleVoice = () => { /* следующий этап */ }
</script>

<template>
  <div class="flex flex-col h-full bg-[#f0f2f5]">

    <!-- Header -->
    <div class="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-100 shadow-sm z-10">
      <div class="relative flex-shrink-0">
        <div
          class="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm select-none"
        >
          {{ chatAvatar }}
        </div>
        <span
          v-if="chat.type === 'private'"
          class="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white transition-colors"
          :class="isOnline ? 'bg-green-400' : 'bg-gray-300'"
        />
      </div>

      <div class="flex-1 min-w-0">
        <h3 class="font-semibold text-gray-900 truncate leading-tight">{{ chatName }}</h3>
        <p class="text-xs leading-tight mt-0.5" :class="isOnline ? 'text-green-500' : 'text-gray-400'">
          <span v-if="chat.type === 'private'">{{ isOnline ? 'В сети' : 'Не в сети' }}</span>
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
            <div
              class="bg-blue-500 text-white rounded-2xl rounded-br-sm px-4 py-2 max-w-xs md:max-w-md lg:max-w-lg shadow-sm"
            >
              <p class="text-sm whitespace-pre-wrap break-words leading-relaxed">{{ msg.content }}</p>
            </div>
            <div class="flex items-center gap-1 mt-1 px-1">
              <span class="text-xs text-gray-400">{{ formatTime(msg.created_at) }}</span>
              <!-- single tick / double tick -->
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
          <div
            class="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 shadow-sm"
          >
            {{ getSenderAvatar(msg) }}
          </div>
          <div class="flex flex-col items-start max-w-xs md:max-w-md lg:max-w-lg">
            <!-- Sender name — only in group -->
            <span v-if="chat.type === 'group'" class="text-xs font-medium text-blue-500 mb-1 ml-1">
              {{ getSenderName(msg) }}
            </span>
            <div class="bg-white text-gray-900 rounded-2xl rounded-bl-sm px-4 py-2 shadow-sm border border-gray-100">
              <p class="text-sm whitespace-pre-wrap break-words leading-relaxed">{{ msg.content }}</p>
            </div>
            <span class="text-xs text-gray-400 mt-1 ml-1">{{ formatTime(msg.created_at) }}</span>
          </div>
        </div>

      </template>
    </div>

    <!-- Input area -->
    <div class="bg-white border-t border-gray-100 px-4 py-3 shadow-[0_-1px_4px_rgba(0,0,0,0.04)]">
      <div class="flex items-end gap-2">

        <!-- Left: emoji + attach -->
        <div class="flex gap-0.5 pb-1.5">
          <button
            @click="handleEmojiClick"
            class="p-2 text-gray-400 hover:text-yellow-500 hover:bg-gray-100 rounded-full transition-colors"
            title="Эмодзи"
            type="button"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
          <button
            @click="handleAttach"
            class="p-2 text-gray-400 hover:text-blue-500 hover:bg-gray-100 rounded-full transition-colors"
            title="Прикрепить файл"
            type="button"
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
            v-model="messageText"
            @keydown="handleKeydown"
            placeholder="Написать сообщение..."
            rows="1"
            class="w-full resize-none rounded-2xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-shadow max-h-36 overflow-y-auto"
            style="line-height: 1.5;"
          />
        </div>

        <!-- Right: voice + send -->
        <div class="flex gap-0.5 pb-1.5">
          <button
            v-if="!messageText.trim()"
            @click="handleVoice"
            class="p-2.5 text-gray-400 hover:text-red-500 hover:bg-gray-100 rounded-full transition-colors"
            title="Голосовое сообщение"
            type="button"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </button>

          <button
            v-if="messageText.trim()"
            @click="handleSend"
            class="p-2.5 bg-blue-500 text-white rounded-full hover:bg-blue-600 active:scale-95 transition-all shadow-sm"
            title="Отправить"
            type="button"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>

      </div>
    </div>

    <!-- Hidden file input -->
    <input ref="fileInputRef" type="file" multiple class="hidden" />
  </div>
</template>

