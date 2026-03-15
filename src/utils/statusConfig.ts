export interface StatusConfig {
  emoji: string
  dotColor: string
  bgHover: string
}

export const STATUS_CONFIG: Record<string, StatusConfig> = {
  online:         { emoji: '🟢', dotColor: 'bg-green-500',  bgHover: 'hover:bg-green-50' },
  chatty:         { emoji: '💬', dotColor: 'bg-green-400',  bgHover: 'hover:bg-green-50' },
  away:           { emoji: '🌙', dotColor: 'bg-yellow-400', bgHover: 'hover:bg-yellow-50' },
  home:           { emoji: '🏠', dotColor: 'bg-blue-400',   bgHover: 'hover:bg-blue-50' },
  work:           { emoji: '💼', dotColor: 'bg-blue-600',   bgHover: 'hover:bg-blue-50' },
  eating:         { emoji: '🍽️', dotColor: 'bg-orange-400', bgHover: 'hover:bg-orange-50' },
  angry:          { emoji: '😠', dotColor: 'bg-red-500',    bgHover: 'hover:bg-red-50' },
  depressed:      { emoji: '😔', dotColor: 'bg-purple-400', bgHover: 'hover:bg-purple-50' },
  busy:           { emoji: '🔴', dotColor: 'bg-red-600',    bgHover: 'hover:bg-red-50' },
  unavailable:    { emoji: '⛔', dotColor: 'bg-gray-400',   bgHover: 'hover:bg-gray-100' },
  do_not_disturb: { emoji: '🔕', dotColor: 'bg-gray-600',   bgHover: 'hover:bg-gray-100' },
}

/** Возвращает эмодзи для ключа статуса. Fallback — 🟢 */
export function getStatusEmoji(key: string | undefined | null): string {
  return STATUS_CONFIG[key ?? 'online']?.emoji ?? '🟢'
}

/** Возвращает цвет точки для ключа статуса. Fallback — bg-green-500 */
export function getStatusDotColor(key: string | undefined | null): string {
  return STATUS_CONFIG[key ?? 'online']?.dotColor ?? 'bg-green-500'
}

