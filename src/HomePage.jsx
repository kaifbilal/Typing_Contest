import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

const EMOJI_PAGE_SIZE = 8

function HomePage({ profile, emojiPool, hiscoresByPeriod, onSaveProfile }) {
  const [nickname, setNickname] = useState(profile.name)
  const [selectedEmoji, setSelectedEmoji] = useState(profile.emoji)
  const [emojiPage, setEmojiPage] = useState(0)
  const [period, setPeriod] = useState('daily')

  useEffect(() => {
    setNickname(profile.name)
    setSelectedEmoji(profile.emoji)
  }, [profile.emoji, profile.name])

  const emojiPages = useMemo(() => Math.ceil(emojiPool.length / EMOJI_PAGE_SIZE), [emojiPool.length])
  const pagedEmojis = useMemo(() => {
    const start = emojiPage * EMOJI_PAGE_SIZE
    return emojiPool.slice(start, start + EMOJI_PAGE_SIZE)
  }, [emojiPage, emojiPool])

  const currentHiscores = hiscoresByPeriod[period] ?? []

  return (
    <section className="home-root">
      <section className="home-centerColumn">
        <div className="paper-root">
          <div className="banner-root">
            <h3>You</h3>
          </div>

          <div className="paper-container">
            <div className="profile-wrapper">
              <div className="profile-header">
                <div className="profile-portrait">{selectedEmoji}</div>
                <input
                  id="nicknameInput"
                  className="profile-input"
                  maxLength={20}
                  placeholder="Enter nickname"
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                />
              </div>

              <div className="profile-content">
                <div className="profile-emojis">
                  {pagedEmojis.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      className={`profile-emoji ${selectedEmoji === emoji ? 'profile-emoji--selected' : ''}`}
                      onClick={() => setSelectedEmoji(emoji)}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>

                <div className="paginate-pagination">
                  <button className="paginate-pageButton" type="button" onClick={() => setEmojiPage(0)}>
                    1
                  </button>
                  <button
                    className="paginate-pageButton"
                    type="button"
                    onClick={() => setEmojiPage((current) => Math.max(0, current - 1))}
                  >
                    &lt;
                  </button>
                  <span>{emojiPage + 1}</span>
                  <button
                    className="paginate-pageButton"
                    type="button"
                    onClick={() => setEmojiPage((current) => Math.min(emojiPages - 1, current + 1))}
                  >
                    &gt;
                  </button>
                  <button
                    className="paginate-pageButton"
                    type="button"
                    onClick={() => setEmojiPage(Math.max(0, emojiPages - 1))}
                  >
                    {emojiPages}
                  </button>
                </div>
              </div>

              <div className="profile-buttonWrapper">
                <button
                  type="button"
                  className="action-button"
                  onClick={() =>
                    onSaveProfile({
                      ...profile,
                      name: nickname.trim() || 'Player',
                      emoji: selectedEmoji,
                    })
                  }
                >
                  Save
                </button>
              </div>

              <small className="profile-id">User ID: {profile.id}</small>
            </div>
          </div>
        </div>

        <div className="home-menu">
          <Link className="home-card home-card--blue" to="/play">
            Quick Play
            <span>Play against others</span>
          </Link>
          <Link className="home-card home-card--green" to="/solo">
            Solo Play
            <span>Play on your own</span>
          </Link>
          <Link className="home-card home-card--pink" to="/lobby">
            Group Play
            <span>Play against friends</span>
          </Link>
        </div>

        <section className="hiscores-root">
          <div className="paper-root">
            <div className="banner-root">
              <h3>Hiscores</h3>
            </div>

            <div className="paper-container">
              <div className="filter-root">
                {['daily', 'weekly', 'monthly'].map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={`filter-item ${item === period ? 'filter-selected' : ''}`}
                    onClick={() => setPeriod(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>

              <div className="hiscores-header">
                <div>#</div>
                <div>Name</div>
                <div>Accuracy</div>
                <div>WPM</div>
              </div>

              <div className="hiscores-wrapper">
                {currentHiscores.map((entry) => (
                  <div key={`${entry.name}-${entry.rank}`} className="hiscores-entry">
                    <div>{entry.rank}.</div>
                    <div>
                      <strong>{entry.name}</strong>
                      <small>
                        {entry.difficulty}, {entry.when}
                      </small>
                    </div>
                    <div>{entry.accuracy}%</div>
                    <div>{entry.wpm}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </section>
    </section>
  )
}

export default HomePage
