/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_WS_URL: string
  readonly VITE_API_TIMEOUT?: string
  readonly VITE_WS_RECONNECTION_ATTEMPTS?: string
  readonly VITE_WS_RECONNECTION_DELAY?: string
  readonly VITE_REVERB_APP_KEY: string
  readonly VITE_REVERB_HOST: string
  readonly VITE_REVERB_WS_PORT?: string
  readonly VITE_REVERB_WSS_PORT?: string
  readonly VITE_REVERB_SCHEME?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// Module declarations for external packages
declare module 'simple-peer' {
  export interface SimplePeerOptions {
    initiator?: boolean
    trickleIce?: boolean
    streams?: MediaStream[]
    config?: any
  }

  export default class SimplePeer {
    constructor(opts: SimplePeerOptions)
    signal(data: any): void
    on(event: string, callback: (...args: any[]) => void): void
    send(data: any): void
    destroy(): void
    _pc: RTCPeerConnection
  }
}

declare module '@heroicons/vue/24/outline';

declare module 'emoji-mart-vue-fast' {
  import type { DefineComponent } from 'vue'

  export interface EmojiObject {
    id: string
    name: string
    native: string
    unified: string
    colons: string
    skin?: number | null
  }

  export const Picker: DefineComponent<{
    data: InstanceType<typeof EmojiIndex>
    set?: string
    title?: string
    emoji?: string
    color?: string
    showPreview?: boolean
    showSkinTones?: boolean
    i18n?: object
  }>

  export class EmojiIndex {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(data: any)
    search(query: string): EmojiObject[]
    findEmoji(id: string): EmojiObject | null
  }
}

declare module 'emoji-mart-vue-fast/src' {
  export * from 'emoji-mart-vue-fast'
}

declare module 'emoji-mart-vue-fast/data/all.json' {
  const value: object
  export default value
}

