import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { getGameSocket } from './socket/client'

const DIFFICULTIES = ['easy', 'medium', 'hard', 'random', 'custom']
const MAX_PLAYERS = [5, 10, 15, 20, 25, 30, 35, 75]

function LobbyPage({ profile, emojiPool, onSaveProfile }) {
  const [searchParams] = useSearchParams()
  const requestedRoomCode = useMemo(() => (searchParams.get('room') || '').trim().toUpperCase(), [searchParams])

  const [players, setPlayers] = useState([])
  const [difficulty, setDifficulty] = useState('random')
  const [maxPlayers, setMaxPlayers] = useState(5)
  const [startTime, setStartTime] = useState(10)
  const [duration, setDuration] = useState(120)
  const [chatMessages, setChatMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [showLink, setShowLink] = useState(false)
  const [nickname, setNickname] = useState(profile.name)
  const [selectedEmoji, setSelectedEmoji] = useState(profile.emoji)
  const [copied, setCopied] = useState(false)
  const [roomId, setRoomId] = useState('')
  const [adminId, setAdminId] = useState(null)
  const [roomPhase, setRoomPhase] = useState('lobby')
  const [mySocketId, setMySocketId] = useState('')
  const [serverNotice, setServerNotice] = useState('')
  const joinAttemptRef = useRef('')
  const navigate = useNavigate()

  const isAdmin = adminId === mySocketId

  const lobbyLink = useMemo(() => {
    const code = roomId || requestedRoomCode || 'loading'
    if (typeof window === 'undefined') {
      return `https://typer.io/lobby?room=${code}`
    }
    return `${window.location.origin}/lobby?room=${code}`
  }, [requestedRoomCode, roomId])

  useEffect(() => {
    setNickname(profile.name)
    setSelectedEmoji(profile.emoji)
  }, [profile.emoji, profile.name])

  useEffect(() => {
    const socket = getGameSocket()

    const createRoomAsAdmin = () => {
      socket.emit(
        'custom:create',
        {
          p: { n: profile.name, e: profile.emoji, c: profile.color },
          s: {
            difficulty,
            max: maxPlayers,
            countdown: startTime,
            duration,
          },
        },
        (response) => {
          if (!response?.ok) {
            joinAttemptRef.current = ''
            setServerNotice('Unable to create room.')
            return
          }

          setRoomId(response.r)
          setServerNotice(`Room ${response.r} created.`)
        },
      )
    }

    const joinExistingRoom = (roomCode) => {
      socket.emit(
        'custom:join',
        {
          r: roomCode,
          p: { n: profile.name, e: profile.emoji, c: profile.color },
        },
        (response) => {
          if (!response?.ok) {
            joinAttemptRef.current = ''
            setServerNotice(response?.m || 'Unable to join room.')
            return
          }

          setRoomId(response.r)
          setServerNotice(`Joined room ${response.r}.`)
        },
      )
    }

    const handleConnect = () => {
      const socketId = socket.id
      if (!socketId) {
        return
      }

      setMySocketId(socketId)

      const actionKey = requestedRoomCode ? `join:${requestedRoomCode}:${socketId}` : `create:${socketId}`
      if (joinAttemptRef.current === actionKey) {
        return
      }

      joinAttemptRef.current = actionKey

      if (requestedRoomCode) {
        joinExistingRoom(requestedRoomCode)
        return
      }

      createRoomAsAdmin()
    }

    const handleDisconnect = () => {
      joinAttemptRef.current = ''
      setServerNotice('Disconnected from room server. Reconnecting...')
    }

    const handleRoomSnapshot = (payload) => {
      if (!payload?.r) {
        return
      }

      if (requestedRoomCode && payload.r !== requestedRoomCode) {
        return
      }

      setRoomId(payload.r)
      setAdminId(payload.a || null)
      setRoomPhase(payload.ph || 'lobby')

      if (payload.s) {
        setDifficulty(payload.s.difficulty ?? 'random')
        setMaxPlayers(payload.s.max ?? 5)
        setStartTime(payload.s.countdown ?? 10)
        setDuration(payload.s.duration ?? 120)
      }

      setPlayers(
        (payload.p || []).map((player) => ({
          id: player.i,
          name: player.n,
          emoji: player.e,
          color: player.c,
          wi: player.wi ?? 0,
          metrics: Array.isArray(player.m) ? player.m : [0, 100, 0],
        })),
      )

      if (Array.isArray(payload.msg)) {
        setChatMessages(
          payload.msg.map((message) => ({
            id: message.id,
            text: message.t,
            system: message.sys === 1,
          })),
        )
      }
    }

    const handleRoomMessage = (payload) => {
      if (!payload?.id || !payload?.t) {
        return
      }

      setChatMessages((current) => [
        ...current,
        {
          id: payload.id,
          text: payload.t,
          system: payload.sys === 1,
        },
      ])
      setServerNotice(payload.t)
    }

    const handleRoomStart = (payload) => {
      if (!payload?.r) {
        return
      }

      navigate(`/play?room=${payload.r}`)
    }

    const handleRoomError = (payload) => {
      setServerNotice(payload?.m || 'Room error occurred.')
    }

    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)
    socket.on('room:snap', handleRoomSnapshot)
    socket.on('room:msg', handleRoomMessage)
    socket.on('room:start', handleRoomStart)
    socket.on('room:error', handleRoomError)

    if (socket.connected) {
      handleConnect()
    }

    return () => {
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
      socket.off('room:snap', handleRoomSnapshot)
      socket.off('room:msg', handleRoomMessage)
      socket.off('room:start', handleRoomStart)
      socket.off('room:error', handleRoomError)
    }
  }, [navigate, profile.color, profile.emoji, profile.name, requestedRoomCode])

  useEffect(() => {
    if (!roomId || !isAdmin || roomPhase !== 'lobby') {
      return
    }

    const socket = getGameSocket()
    socket.emit('room:settings', {
      r: roomId,
      s: {
        difficulty,
        max: maxPlayers,
        countdown: startTime,
        duration,
      },
    })
  }, [difficulty, duration, isAdmin, maxPlayers, roomId, roomPhase, startTime])

  function handleCopyLink() {
    navigator.clipboard.writeText(lobbyLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 1000)
  }

  function handleKickPlayer(playerId) {
    if (!roomId || !isAdmin) {
      return
    }

    getGameSocket().emit('room:kick', {
      r: roomId,
      i: playerId,
    })
  }

  function handleSendMessage(event) {
    event.preventDefault()
    if (!chatInput.trim()) {
      return
    }

    if (roomId) {
      getGameSocket().emit('room:chat', {
        r: roomId,
        t: chatInput.trim(),
      })
    }

    setChatInput('')
  }

  const handleStartGame = useCallback(() => {
    if (!roomId || !isAdmin) {
      return
    }

    getGameSocket().emit('room:start', { r: roomId })
  }, [isAdmin, roomId])

  const handleSaveProfile = useCallback(() => {
    const nextProfile = {
      ...profile,
      name: nickname.trim() || 'Player',
      emoji: selectedEmoji,
    }

    onSaveProfile(nextProfile)

    if (roomId) {
      getGameSocket().emit('room:profile', {
        r: roomId,
        p: {
          n: nextProfile.name,
          e: nextProfile.emoji,
          c: nextProfile.color,
        },
      })
    }
  }, [nickname, onSaveProfile, profile, roomId, selectedEmoji])

  return (
    <main className="lobby-root">
      <section className="quick-clients">
        {players.map((player) => (
          <article key={player.id} className="quick-clientCard">
            <div className="quick-clientStats">
              <span>
                <small>Errors</small>0
              </span>
              <span>
                <small>Accuracy</small>100%
              </span>
              <span>
                <small>Time</small>--:--
              </span>
            </div>
            <div className="quick-clientIdentity" style={{ backgroundColor: player.color }}>
              <span>
                <strong>{player.emoji}</strong> {player.name}
              </span>
              <div>
                {player.metrics[0]} <small>WPM</small>
              </div>
            </div>
          </article>
        ))}
      </section>

      <section className="lobby-grid">
        <article className="paper-root">
          <div className="banner-root">
            <h3>Settings</h3>
          </div>
          <div className="paper-container">
            <div className="lobby-settingsContainer">
              <h4>Difficulty</h4>
              <div className="lobby-settingWrapper">
                {DIFFICULTIES.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={`lobby-settingButton ${item === difficulty ? 'lobby-selected' : ''}`}
                    disabled={!isAdmin}
                    onClick={() => setDifficulty(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>

              <h4>Maximum Players</h4>
              <div className="lobby-settingWrapper">
                {MAX_PLAYERS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={`lobby-settingButton ${item === maxPlayers ? 'lobby-selected' : ''}`}
                    disabled={!isAdmin}
                    onClick={() => setMaxPlayers(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>

              <h4>Start Time</h4>
              <div className="lobby-settingWrapper">
                <p>The amount of seconds until the match starts (Default: 10 seconds)</p>
                <input
                  type="number"
                  className="lobby-input"
                  value={startTime}
                  min={5}
                  max={90}
                  disabled={!isAdmin}
                  onChange={(event) => setStartTime(Number(event.target.value) || 10)}
                />
              </div>

              <h4>Game Duration (seconds)</h4>
              <div className="lobby-settingWrapper">
                <input
                  type="number"
                  className="lobby-input"
                  value={duration}
                  min={20}
                  max={600}
                  disabled={!isAdmin}
                  onChange={(event) => setDuration(Number(event.target.value) || 120)}
                />
              </div>

              <h4>Kick Players</h4>
              {players
                .filter((player) => player.id !== mySocketId)
                .map((player) => (
                  <button key={player.id} type="button" className="lobby-kickButton" disabled={!isAdmin} onClick={() => handleKickPlayer(player.id)}>
                    {player.name}
                  </button>
                ))}
            </div>
          </div>
        </article>

        <article className="paper-root">
          <div className="banner-root">
            <h3>
              Lobby ( {players.length} / {maxPlayers} players )
            </h3>
          </div>
          <div className="paper-container">
            <div className="lobby-wrapper">
              <span>Share this link to invite players.</span>
              <span>Click the link to copy!</span>
              <small>{serverNotice || `Room phase: ${roomPhase}`}</small>

              <div className="lobby-linkContainer">
                <span role="button" id="lobby-link" style={{ filter: showLink ? 'none' : 'blur(3px)' }}>
                  {lobbyLink}
                </span>
                <div className="lobby-buttons">
                  <button type="button" className="action-button" onClick={handleCopyLink}>
                    {copied ? 'copied' : 'copy'}
                  </button>
                  <button type="button" className="action-button" onClick={() => setShowLink((value) => !value)}>
                    {showLink ? 'hide' : 'show'}
                  </button>
                </div>
              </div>

              <button type="button" className="action-button" disabled={!isAdmin} onClick={handleStartGame}>
                {isAdmin ? 'Start Game' : 'Waiting for admin to start'}
              </button>
            </div>
          </div>
        </article>

        <article className="paper-root">
          <div className="banner-root">
            <h3>Chat</h3>
          </div>
          <div className="paper-container">
            <div className="chat-container">
              <div className="chat-wrapper">
                {chatMessages.map((message) => (
                  <div key={message.id} className="chat-message">
                    <div className={message.system ? 'chat-messageSystem' : 'chat-messageUser'}>{message.text}</div>
                  </div>
                ))}
              </div>
            </div>

            <form className="chat-form" onSubmit={handleSendMessage}>
              <input
                className="chat-input"
                type="text"
                placeholder="Write a message..."
                maxLength={250}
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
              />
            </form>
          </div>
        </article>

        <article className="paper-root">
          <div className="banner-root">
            <h3>You</h3>
          </div>

          <div className="paper-container">
            <div className="profile-wrapper">
              <div className="profile-header">
                <div className="profile-portrait">{selectedEmoji}</div>
                <input
                  className="profile-input"
                  maxLength={20}
                  placeholder="Enter nickname"
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                />
              </div>

              <div className="profile-content">
                <div className="profile-emojis">
                  {emojiPool.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      className={`profile-emoji ${emoji === selectedEmoji ? 'profile-emoji--selected' : ''}`}
                      onClick={() => setSelectedEmoji(emoji)}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div className="profile-buttonWrapper">
                <button
                  type="button"
                  className="action-button"
                  onClick={handleSaveProfile}
                >
                  save
                </button>
              </div>
            </div>
          </div>
        </article>
      </section>
    </main>
  )
}

export default LobbyPage
