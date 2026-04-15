import { memo, useEffect, useRef } from 'react'

function PlayEditor({ phase, value, onValueChange, onNewGame }) {
    const inputRef = useRef(null)

    useEffect(() => {
        if (phase === 'running') {
            inputRef.current?.focus()
        }
    }, [phase])

    const placeholder =
        phase === 'running'
            ? 'Type here with rhythm...'
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

                        if (phase === 'ended' && event.key === 'Enter') {
                            event.preventDefault()
                            onNewGame()
                        }
                    }}
                />
            </div>
        </section>
    )
}

export default memo(PlayEditor)