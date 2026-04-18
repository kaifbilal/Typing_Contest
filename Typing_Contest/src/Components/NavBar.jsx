import { memo } from 'react'
import { NavLink } from 'react-router-dom'

function NavBar({ theme, onToggleTheme }) {
    return (
        <header className="nav-root">
            <div className="nav-container">
                <NavLink className="nav-logo" to="/">
                    TYPE<span>CONTEST</span>
                </NavLink>

                <nav className="nav-links" aria-label="Primary navigation">
                    <NavLink to="/">Home</NavLink>
                    <NavLink to="/play">Quick Play</NavLink>
                    <NavLink to="/solo">Solo</NavLink>
                    <NavLink to="/lobby">Group</NavLink>
                </nav>

                <button type="button" className="nav-themeButton" onClick={onToggleTheme}>
                    {theme === 'dark' ? 'Light' : 'Dark'}
                </button>
            </div>
        </header>
    )
}

export default memo(NavBar)
