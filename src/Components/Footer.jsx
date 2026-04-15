import { memo } from 'react'

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
                        <a href="#">Quick Play</a>
                        <a href="#solo">Solo Play</a>
                        <a href="#">Custom Play</a>
                    </div>

                </div>
            </div>
        </footer>
    )
}

export default memo(Footer)