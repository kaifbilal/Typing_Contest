import { memo, useMemo } from 'react'

function buildWordRenderModel(words, currentInput, currentWordIndex) {
    return words.map((word, wordIndex) => {
        const isCompleted = wordIndex < currentWordIndex
        const isActive = wordIndex === currentWordIndex

        const letters = word.split('').map((letter, letterIndex) => {
            if (isCompleted) {
                return {
                    id: `${wordIndex}-${letterIndex}`,
                    value: letter,
                    tone: 'correct',
                }
            }

            if (isActive) {
                const typedLetter = currentInput[letterIndex]
                if (typedLetter == null) {
                    return {
                        id: `${wordIndex}-${letterIndex}`,
                        value: letter,
                        tone: 'base',
                    }
                }

                return {
                    id: `${wordIndex}-${letterIndex}`,
                    value: letter,
                    tone: typedLetter === letter ? 'correct' : 'wrong',
                }
            }

            return {
                id: `${wordIndex}-${letterIndex}`,
                value: letter,
                tone: 'base',
            }
        })

        return {
            id: `${word}-${wordIndex}`,
            letters,
            isActive,
        }
    })
}

function buildMarkerMap(playerMarkers, wordsLength) {
    const markerMap = new Map()

    playerMarkers.forEach((marker) => {
        if (!Number.isFinite(marker.wordIndex)) {
            return
        }

        const safeIndex = Math.max(0, Math.min(wordsLength > 0 ? wordsLength - 1 : 0, Math.round(marker.wordIndex)))
        const existing = markerMap.get(safeIndex) || []
        existing.push(marker)
        markerMap.set(safeIndex, existing)
    })

    return markerMap
}

function GameBoard({ snippet, words, currentInput, currentWordIndex, phase, progress, accentColor, playerMarkers = [] }) {
    const renderWords = useMemo(
        () => buildWordRenderModel(words, currentInput, currentWordIndex),
        [words, currentInput, currentWordIndex],
    )

    const markersByWord = useMemo(
        () => buildMarkerMap(playerMarkers, words.length),
        [playerMarkers, words.length],
    )

    return (
        <section className="board-root">
            <header className="board-header">
                <h3>Snippet</h3>
                <div className="board-presence">
                    <span>you are focused</span>
                    <span className="presence-dot" style={{ backgroundColor: accentColor }} />
                </div>
            </header>

            <div className="board-progressTrack">
                <div className="board-progressFill" style={{ width: `${progress}%` }} />
            </div>

            <div className="board-textWrap" aria-live="polite">
                {renderWords.map((word, wordIndex) => (
                    <span key={word.id} className={`board-word ${word.isActive && phase === 'running' ? 'board-word--active' : ''}`}>
                        {(markersByWord.get(wordIndex) || []).map((marker) => (
                            <span key={`${marker.id}-${wordIndex}`} className="board-marker" title={marker.id} style={{ borderColor: marker.color }}>
                                {marker.emoji}
                            </span>
                        ))}
                        {word.letters.map((letter) => (
                            <span key={letter.id} className={`board-letter board-letter--${letter.tone}`}>
                                {letter.value}
                            </span>
                        ))}
                    </span>
                ))}
            </div>

            <footer className="board-meta">
                <h4>
                    {snippet.title}
                    <span className={`difficulty-pill difficulty-pill--${snippet.difficulty}`}>{snippet.difficulty}</span>
                </h4>
                <p>
                    {snippet.source} • {snippet.addedLabel}
                </p>
            </footer>
        </section>
    )
}

export default memo(GameBoard)
