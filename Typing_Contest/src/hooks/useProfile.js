import { useCallback, useMemo, useState } from 'react'

const STORAGE_KEY = 'typing-profile-v1'

const EMOJI_POOL = ['🤡', '👹', '👺', '👻', '👽', '👾', '🤖', '🧞', '🐌', '🦋', '🐛', '🐜', '🐑', '🐐', '💗', '🧠', '🤞']
const COLOR_POOL = ['#993500', '#5e4b8b', '#355c7d', '#7f5a3a', '#4b6b5b', '#7d4d5f', '#5a5f7d']

function createUserId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }

  return `u-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function createDefaultProfile() {
  return {
    id: createUserId(),
    name: 'Mohd Kaif',
    emoji: '🤞',
    color: COLOR_POOL[0],
  }
}

function readStoredProfile() {
  if (typeof window === 'undefined') {
    return createDefaultProfile()
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return createDefaultProfile()
    }

    const parsed = JSON.parse(raw)
    if (!parsed?.id) {
      return createDefaultProfile()
    }

    return {
      id: parsed.id,
      name: typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name.slice(0, 20) : 'Mohd Kaif',
      emoji: EMOJI_POOL.includes(parsed.emoji) ? parsed.emoji : '🤞',
      color: COLOR_POOL.includes(parsed.color) ? parsed.color : COLOR_POOL[0],
    }
  } catch {
    return createDefaultProfile()
  }
}

export function useProfile() {
  const [profile, setProfile] = useState(readStoredProfile)

  const saveProfile = useCallback((nextProfile) => {
    setProfile(nextProfile)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextProfile))
    }
  }, [])

  const updateProfile = useCallback(
    (patch) => {
      setProfile((previous) => {
        const next = {
          ...previous,
          ...patch,
        }

        if (typeof window !== 'undefined') {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
        }

        return next
      })
    },
    [],
  )

  const assignRandomColor = useCallback(() => {
    setProfile((previous) => {
      const options = COLOR_POOL.filter((color) => color !== previous.color)
      const nextColor = options[Math.floor(Math.random() * options.length)] ?? COLOR_POOL[0]
      const next = { ...previous, color: nextColor }
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      }
      return next
    })
  }, [])

  return {
    profile,
    saveProfile,
    updateProfile,
    assignRandomColor,
    emojiPool: useMemo(() => EMOJI_POOL, []),
    colorPool: useMemo(() => COLOR_POOL, []),
  }
}
