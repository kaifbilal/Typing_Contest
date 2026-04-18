import { memo, useEffect, useRef } from 'react'

function PlayEditor({ phase, value, onValueChange, onNewGame, onConfirmWord }) {
    const inputRef = useRef(null)

    useEffect(() => {
        if (phase === 'running') {
            inputRef.current?.focus()
        }
    }, [phase])

    const placeholder =
        phase === 'running'
            ? (value.length === 0 ? 'Press Space only after correct word' : '')
            : phase === 'countdown'
                ? 'Countdown in progress'
                : phase === 'ended'
                    ? 'Round finished. Ctrl + Enter for a fresh run.'
                    : 'Press Space to start your run'

    return (
        <section className="editor-root">
            <div className="editor-shell">
                <input
                    ref={inputRef}
                    className="editor-input"
                    value={value}
                    placeholder={placeholder}
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck="false"
                    autoComplete="off"
                    readOnly={phase !== 'running'}
                    onChange={(event) => onValueChange(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.ctrlKey && event.key === 'Enter') {
                            event.preventDefault()
                            onNewGame()
                            return
                        }

                        if (phase === 'idle' && event.code === 'Space') {
                            event.preventDefault()
                            onNewGame()
                        }

                        if (phase === 'running' && event.key === ' ') {
                            event.preventDefault()
                            onConfirmWord()
                        }

                    }}
                />
            </div>
        </section>
    )
}

export default memo(PlayEditor)
