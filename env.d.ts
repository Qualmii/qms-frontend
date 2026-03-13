/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_WS_URL: string
  readonly VITE_API_TIMEOUT?: string
  readonly VITE_WS_RECONNECTION_ATTEMPTS?: string
  readonly VITE_WS_RECONNECTION_DELAY?: string
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
