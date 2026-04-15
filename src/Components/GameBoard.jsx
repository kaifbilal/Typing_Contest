import { memo, useMemo } from 'react'

function buildWordRenderModel(text, input) {
    const words = text.split(' ')
    const typedWords = input.split(' ')
    const activeWordIndex = input.length === 0 ? 0 : typedWords.length - 1

    return words.map((word, wordIndex) => {
        const typedWord = typedWords[wordIndex] ?? ''
        const letters = []

        for (let letterIndex = 0; letterIndex < word.length; letterIndex += 1) {
            const expectedLetter = word[letterIndex]
            const typedLetter = typedWord[letterIndex]

            let tone = 'base'
            if (typedLetter != null) {
                tone = typedLetter === expectedLetter ? 'correct' : 'wrong'
            }

            letters.push({
                id: `${wordIndex}-${letterIndex}`,
                value: expectedLetter,
                tone,
            })
        }

        if (typedWord.length > word.length) {
            const overflow = typedWord.slice(word.length).split('')
            overflow.forEach((char, index) => {
                letters.push({
                    id: `${wordIndex}-overflow-${index}`,
                    value: char,
                    tone: 'wrong',
                })
            })
        }

        return {
            id: `${word}-${wordIndex}`,
            letters,
            isActive: wordIndex === activeWordIndex,
        }
    })
}

function GameBoard({ snippet, input, phase, progress }) {
    const words = useMemo(() => buildWordRenderModel(snippet.text, input), [snippet.text, input])

    return (
        <section className="board-root">
            <header className="board-header">
                <h3>Snippet</h3>
                <div className="board-presence">
                    <span>you are focused</span>
                    <span className="presence-dot" style={{ backgroundColor: snippet.accent }} />
                </div>
            </header>

            <div className="board-progressTrack">
                <div className="board-progressFill" style={{ width: `${progress}%` }} />
            </div>

            <div className="board-textWrap" aria-live="polite">
                {words.map((word) => (
                    <span key={word.id} className={`board-word ${word.isActive && phase === 'running' ? 'board-word--active' : ''}`}>
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