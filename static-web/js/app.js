const { BrowserRouter, Routes, Route, useLocation } = ReactRouterDOM;

// Composant principal de l'application
function App() {
    const location = useLocation();
    const [p2pManager, setP2PManager] = React.useState(null);
    const [p2pSync, setP2PSync] = React.useState(null);

    React.useEffect(() => {
        // Initialiser le P2PManager
        const manager = new P2PManager();
        manager.initialize().then(() => {
            setP2PManager(manager);
            // Initialiser P2PSync une fois que P2PManager est prêt
            const sync = new P2PSync(new ContactDB(), manager);
            setP2PSync(sync);
        });
    }, []);

    // Charger le contenu de la page courante depuis GitHub
    React.useEffect(() => {
        if (p2pSync) {
            const path = location.pathname === '/' ? 'index.html' : location.pathname.substring(1);
            p2pSync.loadCurrentPage(path);
        }
    }, [location.pathname, p2pSync]);

    return (
        <div className="app">
            <Navbar />
            <main>
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/contact" element={<Contact p2pSync={p2pSync} />} />
                    <Route path="/mentions-legales" element={<Legal />} />
                    <Route path="*" element={<NotFound />} />
                </Routes>
            </main>
            <footer>
                <p>&copy; 2024 P2P Website. Tous droits réservés.</p>
            </footer>
        </div>
    );
}

// Rendu de l'application
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
    <BrowserRouter>
        <App />
    </BrowserRouter>
); 