import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'

import './App.css'

import PlayStatsLeft from './Components/PlayStatsLeft.jsx'
import Status from './Components/Status.jsx'
import NavBar from './Components/NavBar.jsx'
import GameBoard from './Components/GameBoard.jsx'
import Footer from './Components/Footer.jsx'
import PlayEditor from './Components/PlayEditor.jsx'

const GAME_DURATION_MS = 5 * 60 * 1000
const COUNTDOWN_SECONDS = 3

const SNIPPETS = [
  {
    id: 'good-will-hunting',
    title: 'Good Will Hunting',
    difficulty: 'easy',
    addedLabel: 'Added 5 years ago',
    source: 'Movie Dialogue',
    accent: '#0ea5a3',
    text: "I've got to get up in the morning and spend some more money on my overpriced education.",
  },
  {
    id: 'silent-patient',
    title: 'The Silent Patient',
    difficulty: 'medium',
    addedLabel: 'Added 2 months ago',
    source: 'Novel Excerpt',
    accent: '#f59e0b',
    text: 'We become what we repeatedly tell ourselves, even when the story no longer fits who we are.',
  },
  {
    id: 'interstellar',
    title: 'Interstellar',
    difficulty: 'hard',
    addedLabel: 'Added 11 months ago',
    source: 'Movie Dialogue',
    accent: '#fb7185',
    text: 'Love is the one thing we are capable of perceiving that transcends dimensions of time and space.',
  },
  {
    id: 'stoic-lines',
    title: 'Meditations',
    difficulty: 'easy',
    addedLabel: 'Added 6 days ago',
    source: 'Public Domain',
    accent: '#14b8a6',
    text: 'The soul becomes dyed with the color of its thoughts, so choose your words as if they shape your world.',
  },
]

const HISCORES = [
  { name: 'Googas', wpm: 199.25, when: '1 year ago' },
  { name: 'Halokankaku', wpm: 178.98, when: '2 weeks ago' },
  { name: 'Tahoonga', wpm: 176.0, when: '7 months ago' },
  { name: 'Quads', wpm: 155.29, when: '1 year ago' },
  { name: 'Arctetical', wpm: 150.86, when: '11 months ago' },
]

const initialState = {
  phase: 'idle',
  countdown: COUNTDOWN_SECONDS,
  snippetIndex: 0,
  input: '',
  startedAt: null,
  endsAt: null,
  remainingMs: GAME_DURATION_MS,
}

function normalizeText(value) {
  return value.replace(/\s+/g, ' ').trim()
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
      return {
        ...state,
        phase: 'countdown',
        countdown: COUNTDOWN_SECONDS,
        snippetIndex: action.snippetIndex,
        input: '',
        startedAt: null,
        endsAt: null,
        remainingMs: GAME_DURATION_MS,
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
          endsAt: startAt + GAME_DURATION_MS,
          remainingMs: GAME_DURATION_MS,
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

      return {
        ...state,
        input: action.value,
      }
    }

    case 'RACE_TICK': {
      if (state.phase !== 'running' || !state.endsAt) {
        return state
      }

      const nextRemaining = Math.max(0, state.endsAt - action.now)
      if (nextRemaining === 0) {
        return {
          ...state,
          phase: 'ended',
          remainingMs: 0,
        }
      }

      return {
        ...state,
        remainingMs: nextRemaining,
      }
    }

    case 'COMPLETE_RACE': {
      if (state.phase !== 'running') {
        return state
      }

      const remaining = state.endsAt ? Math.max(0, state.endsAt - action.now) : state.remainingMs
      return {
        ...state,
        phase: 'ended',
        remainingMs: remaining,
      }
    }

    default:
      return state
  }
}

function buildMetrics(targetText, input, elapsedMs) {
  const typedChars = input.length
  let correctChars = 0

  for (let index = 0; index < input.length; index += 1) {
    if (input[index] === targetText[index]) {
      correctChars += 1
    }
  }

  const errors = Math.max(0, typedChars - correctChars)
  const accuracy = typedChars === 0 ? 100 : (correctChars / typedChars) * 100
  const elapsedMinutes = Math.max(elapsedMs, 1) / 60000
  const wpm = (correctChars / 5) / elapsedMinutes
  const progress = Math.min((correctChars / targetText.length) * 100, 100)

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

function formatClock(ms) {
  const safeMs = Math.max(0, ms)
  const minutes = Math.floor(safeMs / 60000)
  const seconds = Math.floor((safeMs % 60000) / 1000)
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function formatClockWithCentiseconds(ms) {
  const safeMs = Math.max(0, ms)
  const minutes = Math.floor(safeMs / 60000)
  const seconds = Math.floor((safeMs % 60000) / 1000)
  const centiseconds = Math.floor((safeMs % 1000) / 10)
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`
}

function useTypingRace(snippets) {
  const [state, dispatch] = useReducer(raceReducer, initialState)

  const activeSnippet = snippets[state.snippetIndex]

  const startNewRound = useCallback(() => {
    dispatch({
      type: 'NEW_ROUND',
      snippetIndex: randomSnippetIndex(snippets.length, state.snippetIndex),
    })
  }, [snippets.length, state.snippetIndex])

  const updateInput = useCallback((value) => {
    dispatch({ type: 'SET_INPUT', value })
  }, [])

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

  const normalizedTarget = useMemo(() => normalizeText(activeSnippet.text), [activeSnippet.text])

  useEffect(() => {
    if (state.phase !== 'running') {
      return
    }

    if (normalizeText(state.input) === normalizedTarget && state.input.trim().length > 0) {
      dispatch({ type: 'COMPLETE_RACE', now: Date.now() })
    }
  }, [state.phase, state.input, normalizedTarget])

  const elapsedMs = GAME_DURATION_MS - state.remainingMs
  const metrics = useMemo(
    () => buildMetrics(activeSnippet.text, state.input, elapsedMs),
    [activeSnippet.text, state.input, elapsedMs],
  )

  return {
    state,
    activeSnippet,
    metrics,
    startNewRound,
    updateInput,
  }
}

function SnippetHighscore({ hiscores }) {
  return (
    <aside className="highscore-root" id="leaderboard">
      <header className="highscore-header">
        <h3>Snippet Hiscores</h3>
        <span>all time</span>
      </header>

      <ol className="highscore-list">
        {hiscores.map((entry, index) => (
          <li key={`${entry.name}-${entry.when}`}>
            <div>
              <strong>{index + 1}.</strong>
              <div>
                <p>{entry.name}</p>
                <small>{entry.when}</small>
              </div>
            </div>

            <span>{entry.wpm.toFixed(2)} WPM</span>
          </li>
        ))}
      </ol>
    </aside>
  )
}

function App() {
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') {
      return 'dark'
    }

    return window.localStorage.getItem('typing-theme') ?? 'dark'
  })

  const { state, activeSnippet, metrics, startNewRound, updateInput } = useTypingRace(SNIPPETS)

  useEffect(() => {
    window.localStorage.setItem('typing-theme', theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
  }, [])

  const profile = useMemo(
    () => ({
      avatar: '⚡',
      name: 'Mohd Kaif',
      rank: state.phase === 'ended' ? '1st' : '--',
    }),
    [state.phase],
  )

  const phaseLabel = useMemo(() => {
    if (state.phase === 'idle') {
      return 'Ready to Launch'
    }
    if (state.phase === 'countdown') {
      return `Countdown: ${state.countdown}`
    }
    if (state.phase === 'running') {
      return 'Typing in Progress'
    }
    return 'Game has Ended'
  }, [state.phase, state.countdown])

  const raceClock = state.phase === 'countdown' ? `00:0${state.countdown}` : formatClock(state.remainingMs)
  const elapsedClock = formatClockWithCentiseconds(metrics.elapsedMs)

  return (
    <div className={`app-shell theme-${theme}`}>
      <NavBar theme={theme} onToggleTheme={toggleTheme} />

      <main className="play-root">
        <section className="play-grid">
          <Status
            phase={state.phase}
            phaseLabel={phaseLabel}
            countdown={state.countdown}
            timeLabel={raceClock}
            onNewGame={startNewRound}
          />

          <GameBoard
            snippet={activeSnippet}
            input={state.input}
            phase={state.phase}
            progress={metrics.progress}
          />

          <SnippetHighscore hiscores={HISCORES} />

          <PlayStatsLeft
            phase={state.phase}
            profile={profile}
            elapsedClock={elapsedClock}
            metrics={metrics}
          />

          <PlayEditor
            phase={state.phase}
            value={state.input}
            onValueChange={updateInput}
            onNewGame={startNewRound}
          />
        </section>
      </main>

      <Footer />
    </div>
  )
}

export default App
