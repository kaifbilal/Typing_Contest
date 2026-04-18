import { memo } from 'react'

function Status({ phase, phaseLabel, countdown, timeLabel, onNewGame, accentColor, onLobbyClick, modeLabel = 'Solo race mode' }) {
    const phaseToneClass =
        phase === 'running'
            ? 'status-card--running'
            : phase === 'ended'
                ? 'status-card--ended'
                : phase === 'countdown'
                    ? 'status-card--countdown'
                    : 'status-card--idle'


    return (
        <section className="status-root" id="solo">
            <div className="status-buttonWrap">
                {onLobbyClick ? (
                    <button type="button" className="action-button action-button--ghost" onClick={onLobbyClick}>
                        lobby
                    </button>
                ) : null}
                <button type="button" className="action-button" onClick={onNewGame}>
                    new game (Ctrl + Enter)
                </button>
            </div>

            <div className={`status-card ${phaseToneClass}`} style={{ borderColor: accentColor }}>
                <h2>{timeLabel}</h2>
                <h3>{phaseLabel}</h3>
                {phase === 'countdown' ? <p>Starting in {countdown} seconds</p> : <p>{modeLabel}</p>}
            </div>
        </section>
    )
}

export default memo(Status)
