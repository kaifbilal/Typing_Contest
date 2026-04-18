import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { fetchSnippetHiscores } from './api'
import GameBoard from './Components/GameBoard'
import PlayEditor from './Components/PlayEditor'
import PlayStatsLeft from './Components/PlayStatsLeft'
import Status from './Components/Status'
import { useWordRace } from './hooks/useWordRace'
import { getGameSocket, textToSnippetModel } from './socket/client'

function formatClockWithCentiseconds(ms) {
  const safeMs = Math.max(0, ms)
  const minutes = Math.floor(safeMs / 60000)
  const seconds = Math.floor((safeMs % 60000) / 1000)
  const centiseconds = Math.floor((safeMs % 1000) / 10)
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`
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

function sortPlayersByProgress(players) {
  return [...players].sort((left, right) => {
    if (right.wi !== left.wi) {
      return right.wi - left.wi
    }

    const leftWpm = Array.isArray(left.m) ? left.m[0] : 0
    const rightWpm = Array.isArray(right.m) ? right.m[0] : 0
    return rightWpm - leftWpm
  })
}

function mergeHeartbeatIntoPlayers(previousPlayers, heartbeatPlayers) {
  const map = new Map(previousPlayers.map((player) => [player.id, player]))

  heartbeatPlayers.forEach((update) => {
    const current = map.get(update.i)
    if (!current) {
      return
    }

    map.set(update.i, {
      ...current,
      wi: Number.isFinite(update.wi) ? update.wi : current.wi,
      m: Array.isArray(update.m) ? update.m : current.m,
      d: update.d ?? current.d,
    })
  })

  return Array.from(map.values())
}

function ClientStatusCards({ players, racePhase, myPlayerId, adminId }) {
  const sortedPlayers = useMemo(() => sortPlayersByProgress(players), [players])

  return (
    <section className="quick-clients">
      {sortedPlayers.map((player, index) => (
        <article key={player.id} className="quick-clientCard">
          <div className="quick-clientStats">
            <span>
              <small>Errors</small>
              {Array.isArray(player.m) ? player.m[2] : 0}
            </span>
            <span>
              <small>Accuracy</small>
              {Array.isArray(player.m) ? player.m[1] : 100}%
            </span>
            <span>
              <small>Time</small>
              {racePhase === 'ended' ? 'done' : '--:--'}
            </span>
          </div>

          <div className="quick-clientIdentity" style={{ backgroundColor: player.color }}>
            <span>
              <strong>{player.emoji}</strong> {player.name}
              {player.id === adminId ? <small className="quick-badge">admin</small> : null}
              {player.id === myPlayerId ? <small className="quick-badge">you</small> : null}
            </span>
            <div>
              {Array.isArray(player.m) ? player.m[0] : 0} <small>WPM</small>
            </div>
          </div>

          <small className="quick-rank">#{index + 1}</small>
        </article>
      ))}
    </section>
  )
}

function QuickPlayPage({ profile, onAssignRoundColor }) {
  const [searchParams] = useSearchParams()

  const [snippets, setSnippets] = useState([])
  const [hiscores, setHiscores] = useState([])
  const [roomId, setRoomId] = useState('')
  const [roomKind, setRoomKind] = useState('quick')
  const [roomPhase, setRoomPhase] = useState('idle')
  const [players, setPlayers] = useState([])
  const [adminId, setAdminId] = useState(null)
  const [matchQueue, setMatchQueue] = useState(null)
  const [serverClock, setServerClock] = useState(0)
  const [systemMessage, setSystemMessage] = useState('Waiting for room assignment...')
  const [mySocketId, setMySocketId] = useState('')
  const [pendingRoundOptions, setPendingRoundOptions] = useState(null)
  const [finalRanking, setFinalRanking] = useState([])
  const joinAttemptRef = useRef('')
  const navigate = useNavigate()
  const customRoomCode = useMemo(() => (searchParams.get('room') || '').trim().toUpperCase(), [searchParams])
  const isCustomMode = customRoomCode.length > 0

  useEffect(() => {
    let isMounted = true

    fetchSnippetHiscores().then((hiscoreData) => {
      if (!isMounted) {
        return
      }

      setHiscores(hiscoreData)
    })

    return () => {
      isMounted = false
    }
  }, [])

  const race = useWordRace({ snippets, onRoundStart: onAssignRoundColor })

  useEffect(() => {
    if (!pendingRoundOptions || snippets.length === 0) {
      return
    }

    race.startNewRound(pendingRoundOptions)
    setPendingRoundOptions(null)
  }, [pendingRoundOptions, race, snippets.length])

  useEffect(() => {
    const socket = getGameSocket()

    const handleConnect = () => {
      const socketId = socket.id
      if (!socketId) {
        return
      }

      setMySocketId(socketId)
      setSystemMessage('Connected to realtime server.')

      const actionKey = isCustomMode ? `custom:${customRoomCode}:${socketId}` : `quick:${socketId}`
      if (joinAttemptRef.current === actionKey) {
        return
      }

      joinAttemptRef.current = actionKey

      if (isCustomMode) {
        socket.emit(
          'custom:join',
          {
            r: customRoomCode,
            p: { n: profile.name, e: profile.emoji, c: profile.color },
          },
          (response) => {
            if (!response?.ok) {
              joinAttemptRef.current = ''
              setSystemMessage(response?.m || 'Unable to join custom room.')
              return
            }

            setRoomId(response.r)
            setRoomKind('custom')
          },
        )
        return
      }

      socket.emit('quick:join', {
        n: profile.name,
        e: profile.emoji,
        c: profile.color,
      })
      setSystemMessage('Searching for a quick-play room...')
    }

    const handleDisconnect = () => {
      joinAttemptRef.current = ''
      setSystemMessage('Disconnected. Trying to reconnect...')
    }

    const handleQuickQueued = (payload) => {
      const queueSize = payload?.q ?? 1
      const targetSize = payload?.t ?? 5
      setMatchQueue({ queueSize, targetSize })
      setRoomPhase('queue')
      setSystemMessage(`Quick queue: ${queueSize}/${targetSize}`)
    }

    const handleRoomAssigned = (payload) => {
      if (!payload?.r) {
        return
      }

      setRoomId(payload.r)
      setRoomKind(payload.k || 'quick')
      setRoomPhase('lobby')
      setMatchQueue(null)
      setSystemMessage(`Joined room ${payload.r}.`)
    }

    const handleRoomSnapshot = (payload) => {
      if (!payload?.r) {
        return
      }

      if (isCustomMode && payload.r !== customRoomCode) {
        return
      }

      setRoomId(payload.r)
      setRoomKind(payload.k || 'quick')
      setRoomPhase(payload.ph || 'lobby')
      setAdminId(payload.a || null)

      const mappedPlayers = (payload.p || []).map((player) => ({
        id: player.i,
        name: player.n,
        emoji: player.e,
        color: player.c,
        wi: Number.isFinite(player.wi) ? player.wi : 0,
        m: Array.isArray(player.m) ? player.m : [0, 100, 0],
      }))
      setPlayers(mappedPlayers)

      if (Array.isArray(payload.msg) && payload.msg.length > 0) {
        setSystemMessage(payload.msg[payload.msg.length - 1].t)
      }
    }

    const handleRoomStart = (payload) => {
      if (!payload?.r) {
        return
      }

      if (isCustomMode && payload.r !== customRoomCode) {
        return
      }

      const snippet = textToSnippetModel(payload.s)
      setSnippets([snippet])
      setFinalRanking([])
      setPendingRoundOptions({
        countdownSeconds: payload.cd ?? 3,
        gameDurationMs: (payload.d ?? 120) * 1000,
      })
      setRoomPhase('countdown')
      setSystemMessage(`Round starts in ${payload.cd ?? 3} seconds.`)
    }

    const handleRoomGo = () => {
      setRoomPhase('running')
      setSystemMessage('Race is live.')
    }

    const handleRoomHeartbeat = (payload) => {
      if (!payload?.r) {
        return
      }

      if (isCustomMode && payload.r !== customRoomCode) {
        return
      }

      setRoomPhase(payload.ph || 'running')
      setServerClock(payload.t ?? 0)

      if (Array.isArray(payload.p)) {
        setPlayers((previous) => mergeHeartbeatIntoPlayers(previous, payload.p))
      }
    }

    const handleRoomEnd = (payload) => {
      if (!payload?.r) {
        return
      }

      if (isCustomMode && payload.r !== customRoomCode) {
        return
      }

      setRoomPhase('ended')
      setFinalRanking(payload.rank || [])
      setSystemMessage('Round finished. Final ranking ready.')
    }

    const handleRoomMessage = (payload) => {
      if (payload?.t) {
        setSystemMessage(payload.t)
      }
    }

    const handleRoomError = (payload) => {
      setSystemMessage(payload?.m || 'Room error occurred.')
    }

    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)
    socket.on('quick:queued', handleQuickQueued)
    socket.on('room:assigned', handleRoomAssigned)
    socket.on('room:snap', handleRoomSnapshot)
    socket.on('room:start', handleRoomStart)
    socket.on('room:go', handleRoomGo)
    socket.on('room:hb', handleRoomHeartbeat)
    socket.on('room:end', handleRoomEnd)
    socket.on('room:msg', handleRoomMessage)
    socket.on('room:error', handleRoomError)

    if (socket.connected) {
      handleConnect()
    }

    return () => {
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
      socket.off('quick:queued', handleQuickQueued)
      socket.off('room:assigned', handleRoomAssigned)
      socket.off('room:snap', handleRoomSnapshot)
      socket.off('room:start', handleRoomStart)
      socket.off('room:go', handleRoomGo)
      socket.off('room:hb', handleRoomHeartbeat)
      socket.off('room:end', handleRoomEnd)
      socket.off('room:msg', handleRoomMessage)
      socket.off('room:error', handleRoomError)
    }
  }, [customRoomCode, isCustomMode, profile.color, profile.emoji, profile.name])

  useEffect(() => {
    if (!roomId) {
      return undefined
    }

    if (race.state.phase !== 'running' && race.state.phase !== 'ended') {
      return undefined
    }

    const socket = getGameSocket()

    const heartbeatInterval = setInterval(() => {
      socket.emit('room:hb', {
        r: roomId,
        wi: race.state.currentWordIndex,
        m: [Math.round(race.metrics.wpm), Math.round(race.metrics.accuracy), race.metrics.errors],
        done: race.isCompleted ? 1 : 0,
      })
    }, 260)

    return () => clearInterval(heartbeatInterval)
  }, [race.isCompleted, race.metrics.accuracy, race.metrics.errors, race.metrics.wpm, race.state.currentWordIndex, race.state.phase, roomId])

  const playersWithLocalStats = useMemo(() => {
    return players.map((player) => {
      if (player.id !== mySocketId) {
        return player
      }

      return {
        ...player,
        wi: race.state.currentWordIndex,
        m: [Math.round(race.metrics.wpm), Math.round(race.metrics.accuracy), race.metrics.errors],
      }
    })
  }, [mySocketId, players, race.metrics.accuracy, race.metrics.errors, race.metrics.wpm, race.state.currentWordIndex])

  const myLiveRank = useMemo(() => {
    if (!mySocketId) {
      return '-'
    }

    const sortedPlayers = sortPlayersByProgress(playersWithLocalStats)
    const myIndex = sortedPlayers.findIndex((player) => player.id === mySocketId)
    if (myIndex < 0) {
      return '-'
    }

    return `${myIndex + 1}`
  }, [mySocketId, playersWithLocalStats])

  const markerPlayers = useMemo(
    () =>
      playersWithLocalStats.map((player) => ({
        id: player.id,
        emoji: player.emoji,
        wordIndex: player.wi,
        color: player.color,
      })),
    [playersWithLocalStats],
  )

  const startRoundFromServer = useCallback(() => {
    if (!roomId) {
      return
    }

    if (roomKind === 'custom' && adminId !== mySocketId) {
      return
    }

    getGameSocket().emit('room:start', { r: roomId })
  }, [adminId, mySocketId, roomId, roomKind])

  const statusModeLabel = useMemo(() => {
    if (isCustomMode) {
      return `Custom room ${roomId || customRoomCode || ''}`.trim()
    }

    if (matchQueue) {
      return `Quick play queue ${matchQueue.queueSize}/${matchQueue.targetSize}`
    }

    return roomId ? `Quick room ${roomId}` : 'Quick matchmaking'
  }, [customRoomCode, isCustomMode, matchQueue, roomId])

  const statusClock = race.state.phase === 'running' || race.state.phase === 'ended' ? race.statusTimeLabel : `00:${String(serverClock).padStart(2, '0')}`

  const localPlayerStats = useMemo(
    () => ({
      phase: race.state.phase,
      profile: {
        avatar: profile.emoji,
        name: profile.name,
        rank: race.state.phase === 'ended' ? myLiveRank : '-',
      },
      elapsedClock: race.isCompleted ? formatClockWithCentiseconds(race.metrics.elapsedMs) : '--:--',
      metrics: race.metrics,
      accentColor: profile.color,
    }),
    [myLiveRank, profile.color, profile.emoji, profile.name, race.isCompleted, race.metrics, race.state.phase],
  )

  const topFinalSummary = useMemo(() => {
    if (!Array.isArray(finalRanking) || finalRanking.length === 0) {
      return null
    }

    const top = finalRanking[0]
    return `${top.e} ${top.n} wins (${top.m?.[0] ?? 0} WPM)`
  }, [finalRanking])

  const isWaitingForRoom = roomPhase === 'idle' || roomPhase === 'queue' || roomPhase === 'lobby'

  if (!snippets.length && !isWaitingForRoom) {
    return (
      <main className="play-root">
        <section className="loading-card">Preparing multiplayer round...</section>
      </main>
    )
  }

  return (
    <main className="play-root">
      <ClientStatusCards players={playersWithLocalStats} racePhase={race.state.phase} myPlayerId={mySocketId} adminId={adminId} />

      <section className="play-grid">
        <Status
          phase={race.state.phase === 'idle' ? roomPhase : race.state.phase}
          phaseLabel={topFinalSummary || race.phaseLabel}
          countdown={race.state.countdown || serverClock}
          timeLabel={statusClock}
          onNewGame={startRoundFromServer}
          accentColor={profile.color}
          onLobbyClick={() => navigate(isCustomMode ? `/lobby?room=${roomId || customRoomCode}` : '/lobby')}
          modeLabel={`${statusModeLabel} • ${systemMessage}`}
        />

        <GameBoard
          snippet={race.activeSnippet || textToSnippetModel('Waiting for the round to start.')}
          words={race.snippetWords || []}
          currentInput={race.state.currentInput}
          currentWordIndex={race.state.currentWordIndex}
          phase={race.state.phase}
          progress={race.metrics.progress}
          accentColor={profile.color}
          playerMarkers={markerPlayers}
        />

        <SnippetHighscore hiscores={hiscores} />

        <PlayStatsLeft
          phase={localPlayerStats.phase}
          profile={localPlayerStats.profile}
          elapsedClock={localPlayerStats.elapsedClock}
          metrics={localPlayerStats.metrics}
          accentColor={localPlayerStats.accentColor}
          contextLabel="Quick play"
        />

        <PlayEditor
          phase={race.state.phase}
          value={race.state.currentInput}
          onValueChange={race.handleInputChange}
          onConfirmWord={race.confirmCurrentWord}
          onNewGame={startRoundFromServer}
        />
      </section>
    </main>
  )
}

export default QuickPlayPage
