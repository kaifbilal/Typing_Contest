import { useCallback, useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

import { fetchHomeHiscores } from './api'
import './App.css'
import Footer from './Components/Footer'
import NavBar from './Components/NavBar'
import HomePage from './HomePage'
import LobbyPage from './LobbyPage'
import QuickPlayPage from './QuickPlayPage'
import SoloPage from './SoloPage'
import { useProfile } from './hooks/useProfile'

const HISCORE_FALLBACK = {
  daily: [],
  weekly: [],
  monthly: [],
}

function App() {
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') {
      return 'dark'
    }

    return window.localStorage.getItem('typing-theme') ?? 'dark'
  })

  const [hiscoresByPeriod, setHiscoresByPeriod] = useState(HISCORE_FALLBACK)
  const { profile, saveProfile, assignRandomColor, emojiPool } = useProfile()

  useEffect(() => {
    let isMounted = true

    fetchHomeHiscores().then((data) => {
      if (!isMounted) {
        return
      }

      setHiscoresByPeriod(data)
    })

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    window.localStorage.setItem('typing-theme', theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
  }, [])

  return (
    <div className={`app-shell theme-${theme}`}>
      <NavBar theme={theme} onToggleTheme={toggleTheme} />

      <Routes>
        <Route
          path="/"
          element={
            <HomePage
              profile={profile}
              emojiPool={emojiPool}
              hiscoresByPeriod={hiscoresByPeriod}
              onSaveProfile={saveProfile}
            />
          }
        />
        <Route path="/solo" element={<SoloPage profile={profile} onAssignRoundColor={assignRandomColor} />} />
        <Route path="/play" element={<QuickPlayPage profile={profile} onAssignRoundColor={assignRandomColor} />} />
        <Route path="/lobby" element={<LobbyPage profile={profile} emojiPool={emojiPool} onSaveProfile={saveProfile} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <Footer />
    </div>
  )
}

export default App
