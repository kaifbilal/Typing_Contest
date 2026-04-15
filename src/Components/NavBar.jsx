import { memo } from 'react'

function NavBar({ theme, onToggleTheme }) {
    return (
        <header className="nav-root">
            <div className="nav-container">
                <a className="nav-logo" href="#home">
                    TYPE<span>CONTEST</span>
                </a>

                <nav className="nav-links" aria-label="Primary navigation">
                    <a href="#home">Play</a>
                    <a href="#solo">Solo</a>
                    <a href="#leaderboard">Hiscores</a>
                </nav>

                <button type="button" className="nav-themeButton" onClick={onToggleTheme}>
                    {theme === 'dark' ? 'Light' : 'Dark'}
                </button>
            </div>
        </header>
    )
}

export default memo(NavBar)