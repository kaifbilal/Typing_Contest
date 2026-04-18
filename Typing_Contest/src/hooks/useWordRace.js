import { useCallback, useEffect, useMemo, useReducer } from 'react'

const DEFAULT_GAME_DURATION_MS = 5 * 60 * 1000
const DEFAULT_COUNTDOWN_SECONDS = 3

function createInitialState(countdownSeconds, gameDurationMs) {
  return {
    phase: 'idle',
    countdown: countdownSeconds,
    snippetIndex: 0,
    currentWordIndex: 0,
    currentInput: '',
    committedWords: [],
    errorCount: 0,
    startedAt: null,
    endedAt: null,
    remainingMs: gameDurationMs,
    countdownSeconds,
    gameDurationMs,
  }
}

const initialState = createInitialState(DEFAULT_COUNTDOWN_SECONDS, DEFAULT_GAME_DURATION_MS)

function clampInt(value, min, max, fallback) {
  if (!Number.isFinite(value)) {
    return fallback
  }

  return Math.max(min, Math.min(max, Math.round(value)))
}

function randomSnippetIndex(total, previousIndex) {
  if (total <= 1) {
    return 0
  }

  let nextIndex = previousIndex
  while (nextIndex === previousIndex) {
    nextIndex = Math.floor(Math.random() * total)
  }
  return nextIndex
}

function raceReducer(state, action) {
  switch (action.type) {
    case 'NEW_ROUND': {
      const countdownSeconds = clampInt(action.countdownSeconds, 1, 30, DEFAULT_COUNTDOWN_SECONDS)
      const gameDurationMs = clampInt(action.gameDurationMs, 10000, 3600000, DEFAULT_GAME_DURATION_MS)

      return {
        ...state,
        phase: 'countdown',
        countdown: countdownSeconds,
        snippetIndex: action.snippetIndex,
        currentWordIndex: 0,
        currentInput: '',
        committedWords: [],
        errorCount: 0,
        startedAt: null,
        endedAt: null,
        remainingMs: gameDurationMs,
        countdownSeconds,
        gameDurationMs,
      }
    }

    case 'COUNTDOWN_TICK': {
      if (state.phase !== 'countdown') {
        return state
      }

      if (state.countdown <= 1) {
        const startAt = action.now
        return {
          ...state,
          phase: 'running',
          countdown: 0,
          startedAt: startAt,
          remainingMs: state.gameDurationMs,
        }
      }

      return {
        ...state,
        countdown: state.countdown - 1,
      }
    }

    case 'SET_INPUT': {
      if (state.phase !== 'running') {
        return state
      }

      let addedErrors = 0
      if (action.value.length > state.currentInput.length) {
        const previousLength = state.currentInput.length
        for (let index = previousLength; index < action.value.length; index += 1) {
          if (action.value[index] !== action.expectedWord[index]) {
            addedErrors += 1
          }
        }
      }

      return {
        ...state,
        currentInput: action.value,
        errorCount: state.errorCount + addedErrors,
      }
    }

    case 'CONFIRM_WORD': {
      if (state.phase !== 'running') {
        return state
      }

      if (!action.isCorrect) {
        return state
      }

      const nextCommittedWords = [...state.committedWords, state.currentInput]
      const isFinalWord = state.currentWordIndex + 1 >= action.totalWords

      if (isFinalWord) {
        const elapsedMs = state.startedAt ? action.now - state.startedAt : 0
        const remainingMs = Math.max(0, state.gameDurationMs - elapsedMs)
        return {
          ...state,
          phase: 'ended',
          currentWordIndex: state.currentWordIndex + 1,
          committedWords: nextCommittedWords,
          currentInput: '',
          endedAt: action.now,
          remainingMs,
        }
      }

      return {
        ...state,
        currentWordIndex: state.currentWordIndex + 1,
        committedWords: nextCommittedWords,
        currentInput: '',
      }
    }

    case 'RACE_TICK': {
      if (state.phase !== 'running' || !state.startedAt) {
        return state
      }

      const elapsedMs = action.now - state.startedAt
      const remainingMs = Math.max(0, state.gameDurationMs - elapsedMs)

      if (remainingMs === 0) {
        return {
          ...state,
          phase: 'ended',
          remainingMs: 0,
          endedAt: action.now,
        }
      }

      return {
        ...state,
        remainingMs,
      }
    }

    default:
      return state
  }
}

function formatClock(ms) {
  const safeMs = Math.max(0, ms)
  const minutes = Math.floor(safeMs / 60000)
  const seconds = Math.floor((safeMs % 60000) / 1000)
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function buildMetrics(snippetWords, currentWordIndex, currentInput, committedWords, elapsedMs, errorCount) {
  const committedChars = committedWords.reduce((sum, word) => sum + word.length, 0)
  const expectedWord = snippetWords[currentWordIndex] ?? ''

  let currentCorrectChars = 0
  for (let index = 0; index < currentInput.length; index += 1) {
    if (currentInput[index] === expectedWord[index]) {
      currentCorrectChars += 1
    }
  }

  const typedChars = committedChars + currentInput.length + errorCount
  const correctChars = committedChars + currentCorrectChars
  const errors = errorCount
  const attempts = correctChars + errors
  const accuracy = attempts === 0 ? 100 : (correctChars / attempts) * 100
  const elapsedMinutes = Math.max(elapsedMs, 1) / 60000
  const wpm = (correctChars / 5) / elapsedMinutes
  const totalChars = snippetWords.reduce((sum, word) => sum + word.length, 0)
  const progress = totalChars === 0 ? 0 : Math.min((correctChars / totalChars) * 100, 100)

  return {
    typedChars,
    correctChars,
    errors,
    accuracy,
    wpm,
    progress,
    elapsedMs,
  }
}

export function useWordRace({ snippets, onRoundStart }) {
  const [state, dispatch] = useReducer(raceReducer, initialState)

  const activeSnippet = snippets[state.snippetIndex] ?? snippets[0]
  const snippetWords = activeSnippet?.words ?? []

  const startNewRound = useCallback((options = {}) => {
    const countdownSeconds = clampInt(options.countdownSeconds, 1, 30, DEFAULT_COUNTDOWN_SECONDS)
    const gameDurationMs = clampInt(options.gameDurationMs, 10000, 3600000, DEFAULT_GAME_DURATION_MS)

    dispatch({
      type: 'NEW_ROUND',
      snippetIndex: randomSnippetIndex(snippets.length, state.snippetIndex),
      countdownSeconds,
      gameDurationMs,
    })

    onRoundStart?.()
  }, [onRoundStart, snippets.length, state.snippetIndex])

  useEffect(() => {
    if (state.phase !== 'countdown') {
      return undefined
    }

    const interval = setInterval(() => {
      dispatch({ type: 'COUNTDOWN_TICK', now: Date.now() })
    }, 1000)

    return () => clearInterval(interval)
  }, [state.phase])

  useEffect(() => {
    if (state.phase !== 'running') {
      return undefined
    }

    const interval = setInterval(() => {
      dispatch({ type: 'RACE_TICK', now: Date.now() })
    }, 80)

    return () => clearInterval(interval)
  }, [state.phase])

  const handleInputChange = useCallback(
    (value) => {
      if (state.phase !== 'running') {
        return
      }

      const expectedWord = snippetWords[state.currentWordIndex] ?? ''
      const stripped = value.replace(/\s+/g, '')
      const constrained = stripped.slice(0, expectedWord.length)

      dispatch({ type: 'SET_INPUT', value: constrained, expectedWord })
    },
    [snippetWords, state.currentWordIndex, state.phase],
  )

  const confirmCurrentWord = useCallback(() => {
    if (state.phase !== 'running') {
      return false
    }

    const expectedWord = snippetWords[state.currentWordIndex] ?? ''
    const isCorrect = state.currentInput === expectedWord

    dispatch({
      type: 'CONFIRM_WORD',
      isCorrect,
      totalWords: snippetWords.length,
      now: Date.now(),
    })

    return isCorrect
  }, [snippetWords, state.currentInput, state.currentWordIndex, state.phase])

  const elapsedMs = useMemo(() => {
    if (state.phase === 'ended' && state.startedAt && state.endedAt) {
      return state.endedAt - state.startedAt
    }

    return Math.max(0, state.gameDurationMs - state.remainingMs)
  }, [state.endedAt, state.gameDurationMs, state.phase, state.remainingMs, state.startedAt])

  const metrics = useMemo(
    () => buildMetrics(snippetWords, state.currentWordIndex, state.currentInput, state.committedWords, elapsedMs, state.errorCount),
    [elapsedMs, snippetWords, state.committedWords, state.currentInput, state.currentWordIndex, state.errorCount],
  )

  const statusTimeLabel = useMemo(() => {
    if (state.phase === 'countdown') {
      const seconds = Math.max(0, state.countdown)
      return `00:${String(seconds).padStart(2, '0')}`
    }

    if (state.phase === 'running' || state.phase === 'ended') {
      return formatClock(state.remainingMs)
    }

    return '--:--'
  }, [state.countdown, state.phase, state.remainingMs])

  const isCompleted = state.phase === 'ended' && state.currentWordIndex >= snippetWords.length

  const phaseLabel = useMemo(() => {
    if (state.phase === 'idle') {
      return 'Ready to Launch'
    }
    if (state.phase === 'countdown') {
      return `Starting in ${state.countdown}`
    }
    if (state.phase === 'running') {
      return 'GO!'
    }
    return 'Finished'
  }, [state.countdown, state.phase])

  return {
    state,
    activeSnippet,
    snippetWords,
    metrics,
    phaseLabel,
    statusTimeLabel,
    isCompleted,
    startNewRound,
    handleInputChange,
    confirmCurrentWord,
  }
}
