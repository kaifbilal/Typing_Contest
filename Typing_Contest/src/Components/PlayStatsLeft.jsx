import { memo } from 'react'

function PlayStatsLeft({ phase, profile, elapsedClock, metrics, accentColor, contextLabel = 'Solo queue' }) {
    return (
        <aside className="stats-root">
            <article className="stats-playerCard">
                <div className="stats-grid">
                    <div>
                        <span>Errors</span>
                        <strong>{metrics.errors}</strong>
                    </div>
                    <div>
                        <span>Accuracy</span>
                        <strong>{metrics.accuracy.toFixed(1)}%</strong>
                    </div>
                    <div>
                        <span>Time</span>
                        <strong>{elapsedClock}</strong>
                    </div>
                </div>

                <div className="stats-identity" style={{ backgroundColor: accentColor }}>
                    <div className="stats-avatar">{profile.avatar}</div>
                    <div className="stats-user">
                        <h4>{profile.name}</h4>
                        <p>{phase === 'running' ? 'Locked in' : contextLabel}</p>
                    </div>

                    <div className="stats-wpm">
                        <span>{metrics.wpm.toFixed(2)}</span>
                        <small>WPM</small>
                    </div>

                    <div className="stats-rank">{profile.rank}</div>
                </div>
            </article>
        </aside>
    )
}

export default memo(PlayStatsLeft)
