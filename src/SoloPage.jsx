import { useCallback, useEffect, useState } from 'react'

import { fetchSnippetHiscores, fetchSnippets } from './api'
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

function SoloPage({ profile, onAssignRoundColor }) {
	const [snippets, setSnippets] = useState([])
	const [fallbackSnippets, setFallbackSnippets] = useState([])
	const [hiscores, setHiscores] = useState([])
	const [socketConnected, setSocketConnected] = useState(false)
	const [pendingRoundStart, setPendingRoundStart] = useState(false)

	useEffect(() => {
		let isMounted = true

		Promise.all([fetchSnippets(), fetchSnippetHiscores()]).then(([snippetData, hiscoreData]) => {
			if (!isMounted) {
				return
			}

			setFallbackSnippets(snippetData)
			setSnippets(snippetData.slice(0, 1))
			setHiscores(hiscoreData)
		})

		return () => {
			isMounted = false
		}
	}, [])

	useEffect(() => {
		const socket = getGameSocket()

		const handleConnect = () => setSocketConnected(true)
		const handleDisconnect = () => setSocketConnected(false)

		setSocketConnected(socket.connected)
		socket.on('connect', handleConnect)
		socket.on('disconnect', handleDisconnect)

		return () => {
			socket.off('connect', handleConnect)
			socket.off('disconnect', handleDisconnect)
		}
	}, [])

	const race = useWordRace({ snippets, onRoundStart: onAssignRoundColor })

	useEffect(() => {
		if (!pendingRoundStart || snippets.length === 0) {
			return
		}

		race.startNewRound()
		setPendingRoundStart(false)
	}, [pendingRoundStart, race, snippets.length])

	const requestLiveSnippet = useCallback(() => {
		const socket = getGameSocket()

		return new Promise((resolve) => {
			socket.timeout(1400).emit('solo:next', (error, response) => {
				if (error || !response?.ok || typeof response.s !== 'string') {
					resolve(null)
					return
				}

				resolve(response.s)
			})
		})
	}, [])

	const startLiveRound = useCallback(async () => {
		const liveSnippet = await requestLiveSnippet()

		if (liveSnippet) {
			setSnippets([textToSnippetModel(liveSnippet)])
			setPendingRoundStart(true)
			return
		}

		const fallbackIndex = Math.floor(Math.random() * Math.max(1, fallbackSnippets.length))
		const fallbackSnippet = fallbackSnippets[fallbackIndex] ?? textToSnippetModel('Practice keeps progress steady every day.')

		setSnippets([fallbackSnippet])
		setPendingRoundStart(true)
	}, [fallbackSnippets, requestLiveSnippet])

	if (!snippets.length) {
		return (
			<main className="play-root">
				<section className="loading-card">Loading snippets...</section>
			</main>
		)
	}

	return (
		<main className="play-root">
			<section className="play-grid">
				<Status
					phase={race.state.phase}
					phaseLabel={race.phaseLabel}
					countdown={race.state.countdown}
					timeLabel={race.statusTimeLabel}
					onNewGame={startLiveRound}
					accentColor={profile.color}
					modeLabel={socketConnected ? 'Solo race mode • live websocket snippets' : 'Solo race mode • local fallback'}
				/>

				<GameBoard
					snippet={race.activeSnippet}
					words={race.snippetWords}
					currentInput={race.state.currentInput}
					currentWordIndex={race.state.currentWordIndex}
					phase={race.state.phase}
					progress={race.metrics.progress}
					accentColor={profile.color}
				/>

				<SnippetHighscore hiscores={hiscores} />

				<PlayStatsLeft
					phase={race.state.phase}
					profile={{
						avatar: profile.emoji,
						name: profile.name,
						rank: race.state.phase === 'ended' ? '1st' : '-',
					}}
					elapsedClock={race.isCompleted ? formatClockWithCentiseconds(race.metrics.elapsedMs) : '--:--'}
					metrics={race.metrics}
					accentColor={profile.color}
					contextLabel="Solo queue"
				/>

				<PlayEditor
					phase={race.state.phase}
					value={race.state.currentInput}
					onValueChange={race.handleInputChange}
					onConfirmWord={race.confirmCurrentWord}
					onNewGame={startLiveRound}
				/>
			</section>
		</main>
	)
}

export default SoloPage
