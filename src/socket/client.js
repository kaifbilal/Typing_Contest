import { io } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:3000'
const GLOBAL_SOCKET_KEY = '__typingContestSharedSocket__'

let sharedSocket

function resolveGlobalScope() {
  if (typeof window !== 'undefined') {
    return window
  }

  if (typeof globalThis !== 'undefined') {
    return globalThis
  }

  return null
}

function createSocket() {
  return io(SOCKET_URL, {
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 12,
    reconnectionDelay: 400,
    reconnectionDelayMax: 2200,
  })
}

export function getGameSocket() {
  if (!sharedSocket) {
    const globalScope = resolveGlobalScope()
    const existingGlobalSocket = globalScope?.[GLOBAL_SOCKET_KEY]

    sharedSocket = existingGlobalSocket || createSocket()

    if (globalScope && !existingGlobalSocket) {
      // Keep one socket instance during Vite fast-refresh/module reload cycles.
      globalScope[GLOBAL_SOCKET_KEY] = sharedSocket
    }
  }

  return sharedSocket
}

export function textToSnippetModel(text) {
  const normalizedText = typeof text === 'string' ? text.trim() : ''
  const words = normalizedText
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean)

  return {
    id: `live-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: 'Live Snippet',
    difficulty: 'random',
    addedLabel: 'Live',
    source: 'Socket Server',
    words: words.length > 0 ? words : ['No', 'snippet', 'available.'],
  }
}
