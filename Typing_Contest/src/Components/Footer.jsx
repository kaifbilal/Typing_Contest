import { memo } from 'react'
import { Link } from 'react-router-dom'

function Footer() {
    return (
        <footer className="footer-root">
            <div className="footer-inner">
                <div className="footer-credit">
                    <span>© 2026 TypeForge</span>
                    <p>
                        crafted by <strong>Mohd Kaif</strong>
                    </p>
                </div>

                <div className="footer-columns">
                    <div>
                        <h4>Races</h4>
                        <Link to="/play">Quick Play</Link>
                        <Link to="/solo">Solo Play</Link>
                        <Link to="/lobby">Group Play</Link>
                    </div>

                </div>
            </div>
        </footer>
    )
}

export default memo(Footer)
