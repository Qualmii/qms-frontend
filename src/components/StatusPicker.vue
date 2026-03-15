<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useProfileStore } from '@/stores/profile'
import { STATUS_CONFIG } from '@/utils/statusConfig'

const router = useRouter()
const authStore = useAuthStore()
const profileStore = useProfileStore()

const isOpen = ref(false)
const customStatusInput = ref('')
const isSaving = ref(false)
const dropdownRef = ref<HTMLElement | null>(null)

// ─── Конфиг статусов вынесен в @/utils/statusConfig.ts ────────────────────

const currentKey = computed(() => authStore.user?.online_status ?? 'online')
const currentConfig = computed(() => STATUS_CONFIG[currentKey.value] ?? STATUS_CONFIG['online']!)
const currentName = computed(
  () => profileStore.availableStatuses[currentKey.value] ?? 'Онлайн'
)

/** Текст под именем: кастомный текст если есть, иначе название статуса */
const currentStatusLabel = computed(() => {
  const custom = authStore.user?.custom_status?.trim() || null
  if (custom) return custom
  return currentName.value
})

const statusList = computed(() =>
  Object.entries(profileStore.availableStatuses).map(([key, name]) => ({
    key,
    name,
    ...(STATUS_CONFIG[key] ?? STATUS_CONFIG.online),
  }))
)

// Синхронизируем custom status из user-стора
watch(
  () => authStore.user?.custom_status,
  (val) => { customStatusInput.value = val ?? '' },
  { immediate: true }
)

// ─── Загрузить статусы один раз ───────────────────────────────────────────
onMounted(async () => {
  if (Object.keys(profileStore.availableStatuses).length === 0) {
    await profileStore.fetchAvailableStatuses()
  }
})

// ─── Выбор статуса ────────────────────────────────────────────────────────
const selectStatus = async (key: string) => {
  if (isSaving.value) return
  isSaving.value = true
  try {
    await profileStore.setStatus(key, customStatusInput.value.trim() || undefined)
    // Обновляем authStore.user, чтобы UI сразу отразил изменения
    if (authStore.user) {
      authStore.user.online_status = key
      authStore.user.custom_status = customStatusInput.value.trim() || null
      localStorage.setItem('user', JSON.stringify(authStore.user))
    }
    isOpen.value = false
  } catch {
    // ошибка игнорируется — статус не изменился
  } finally {
    isSaving.value = false
  }
}

// Сохранить кастомный статус без смены ключа
const saveCustomStatus = async () => {
  await selectStatus(currentKey.value)
}

// ─── Закрытие по клику снаружи ────────────────────────────────────────────
const onOutsideClick = (e: MouseEvent) => {
  if (dropdownRef.value && !dropdownRef.value.contains(e.target as Node)) {
    isOpen.value = false
  }
}
onMounted(() => document.addEventListener('mousedown', onOutsideClick))
onUnmounted(() => document.removeEventListener('mousedown', onOutsideClick))

// ─── Переход в настройки профиля ──────────────────────────────────────────
const goToProfile = () => {
  isOpen.value = false
  router.push('/profile')
}
</script>

<template>
  <div ref="dropdownRef" class="relative">
    <!-- Триггер: аватар (→ профиль) + имя/статус (→ дропдаун) -->
    <div class="flex items-center gap-3 rounded-lg px-1 py-1 transition-colors w-full">

      <!-- Аватар — клик ведёт в настройки профиля -->
      <button
        type="button"
        class="relative shrink-0 hover:opacity-80 transition-opacity focus:outline-none"
        title="Настройки профиля"
        @click.stop="goToProfile"
      >
        <div class="relative w-10 h-10">
          <!-- Фото -->
          <img
            v-if="authStore.user?.avatar_url"
            :src="authStore.user.avatar_url"
            alt="Аватар"
            class="w-10 h-10 rounded-full object-cover"
          />
          <!-- Инициалы (нет фото) -->
          <div
            v-else
            class="w-10 h-10 rounded-full bg-linear-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold text-sm select-none"
          >
            {{ authStore.user?.name?.substring(0, 2).toUpperCase() }}
          </div>
          <!-- Точка статуса -->
          <span
            class="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white transition-colors"
            :class="currentConfig.dotColor"
          />
        </div>
      </button>

      <!-- Имя и статус — клик открывает дропдаун -->
      <button
        type="button"
        class="hidden md:block min-w-0 flex-1 text-left hover:bg-gray-100 rounded-md px-1 py-0.5 transition-colors focus:outline-none"
        @click="isOpen = !isOpen"
      >
        <div class="font-semibold text-gray-900 text-sm leading-tight truncate">
          {{ authStore.user?.name }}
        </div>
        <div class="text-xs text-gray-500 truncate leading-tight mt-0.5 flex items-center gap-1.5">
          <span class="text-sm leading-none">{{ currentConfig.emoji }}</span>
          <span>{{ currentStatusLabel }}</span>
        </div>
      </button>

    </div>

    <!-- Выпадающее меню -->
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 scale-95 -translate-y-1"
      enter-to-class="opacity-100 scale-100 translate-y-0"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100 scale-100 translate-y-0"
      leave-to-class="opacity-0 scale-95 -translate-y-1"
    >
      <div
        v-if="isOpen"
        class="absolute left-0 top-full mt-1 z-50 w-64 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden"
      >
        <!-- Заголовок -->
        <div class="px-3 py-2 bg-gray-50 border-b border-gray-100">
          <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Статус</p>
        </div>

        <!-- Список статусов -->
        <ul class="py-1 max-h-72 overflow-y-auto">
          <li
            v-for="s in statusList"
            :key="s.key"
          >
            <button
              class="w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors"
              :class="[
                s.bgHover,
                s.key === currentKey
                  ? 'bg-blue-50 font-semibold text-blue-700'
                  : 'text-gray-700'
              ]"
              :disabled="isSaving"
              @click="selectStatus(s.key)"
            >
              <!-- Цветная точка -->
              <span class="w-2.5 h-2.5 rounded-full shrink-0" :class="s.dotColor" />
              <!-- Эмодзи -->
              <span class="text-base leading-none">{{ s.emoji }}</span>
              <!-- Название -->
              <span class="flex-1 text-left">{{ s.name }}</span>
              <!-- Галочка для текущего -->
              <svg
                v-if="s.key === currentKey"
                class="w-4 h-4 text-blue-600 shrink-0"
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
              </svg>
            </button>
          </li>
        </ul>

        <!-- Кастомный статус -->
        <div class="px-3 py-2 border-t border-gray-100 bg-gray-50">
          <p class="text-xs text-gray-500 mb-1.5">Текст статуса (необязательно)</p>
          <div class="flex gap-2">
            <input
              v-model="customStatusInput"
              type="text"
              maxlength="50"
              placeholder="Что делаешь? 😊"
              class="flex-1 text-sm px-2 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
              @keydown.enter="saveCustomStatus"
            />
            <button
              class="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              :disabled="isSaving"
              @click="saveCustomStatus"
            >
              <svg v-if="isSaving" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
              <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
            </button>
          </div>
          <p class="text-xs text-gray-400 mt-1 text-right">{{ customStatusInput.length }}/50</p>
        </div>
      </div>
    </Transition>
  </div>
</template>

