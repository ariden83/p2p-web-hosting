const { NavLink } = ReactRouterDOM;

function Navbar() {
    return (
        <nav className="navbar">
            <div className="logo">P2P Website</div>
            <ul className="nav-links">
                <li>
                    <NavLink 
                        to="/" 
                        className={({ isActive }) => isActive ? 'active' : ''}
                    >
                        Accueil
                    </NavLink>
                </li>
                <li>
                    <NavLink 
                        to="/contact"
                        className={({ isActive }) => isActive ? 'active' : ''}
                    >
                        Contact
                    </NavLink>
                </li>
                <li>
                    <NavLink 
                        to="/mentions-legales"
                        className={({ isActive }) => isActive ? 'active' : ''}
                    >
                        Mentions Légales
                    </NavLink>
                </li>
            </ul>
        </nav>
    );
} 