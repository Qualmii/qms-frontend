export interface StatusConfig {
  iconPath: string
  dotColor: string
  bgHover: string
}

export const STATUS_CONFIG: Record<string, StatusConfig> = {
  online: {
    iconPath: '/src/assets/images/statuses/online.webp',
    dotColor: 'bg-green-500',
    bgHover: 'hover:bg-green-50',
  },
  chatty: {
    iconPath: '/src/assets/images/statuses/chatty.webp',
    dotColor: 'bg-green-400',
    bgHover: 'hover:bg-green-50',
  },
  away: {
    iconPath: '/src/assets/images/statuses/away.webp',
    dotColor: 'bg-yellow-400',
    bgHover: 'hover:bg-yellow-50',
  },
  home: {
    iconPath: '/src/assets/images/statuses/home.webp',
    dotColor: 'bg-blue-400',
    bgHover: 'hover:bg-blue-50',
  },
  work: {
    iconPath: '/src/assets/images/statuses/work.webp',
    dotColor: 'bg-blue-600',
    bgHover: 'hover:bg-blue-50',
  },
  eating: {
    iconPath: '/src/assets/images/statuses/eating.webp',
    dotColor: 'bg-orange-400',
    bgHover: 'hover:bg-orange-50',
  },
  angry: {
    iconPath: '/src/assets/images/statuses/angry.webp',
    dotColor: 'bg-red-500',
    bgHover: 'hover:bg-red-50',
  },
  depressed: {
    iconPath: '/src/assets/images/statuses/depressed.webp',
    dotColor: 'bg-purple-400',
    bgHover: 'hover:bg-purple-50',
  },
  busy: {
    iconPath: '/src/assets/images/statuses/busy.webp',
    dotColor: 'bg-red-600',
    bgHover: 'hover:bg-red-50',
  },
  unavailable: {
    iconPath: '/src/assets/images/statuses/unavailable.webp',
    dotColor: 'bg-gray-400',
    bgHover: 'hover:bg-gray-100',
  },
  do_not_disturb: {
    iconPath: '/src/assets/images/statuses/do_not_diturb.webp',
    dotColor: 'bg-gray-600',
    bgHover: 'hover:bg-gray-100',
  },
}

/** Возвращает путь к иконке для ключа статуса. Fallback — chatty */
export function getStatusIconPath(key: string | undefined | null): string {
  return STATUS_CONFIG[key ?? 'online']?.iconPath ?? '/src/assets/images/statuses/chatty.webp'
}

/** @deprecated Используйте getStatusIconPath. Алиас для обратной совместимости */
export function getStatusEmoji(key: string | undefined | null): string {
  return getStatusIconPath(key)
}

/** Возвращает цвет точки для ключа статуса. Fallback — bg-green-500 */
export function getStatusDotColor(key: string | undefined | null): string {
  return STATUS_CONFIG[key ?? 'online']?.dotColor ?? 'bg-green-500'
}

