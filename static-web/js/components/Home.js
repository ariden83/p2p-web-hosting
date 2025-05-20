function Home() {
    return (
        <>
            <section className="hero">
                <h1>Bienvenue sur notre Site P2P</h1>
                <p>Découvrez la puissance du partage de fichiers en pair à pair</p>
            </section>

            <section className="features">
                <div className="feature-card">
                    <h2>Partage Instantané</h2>
                    <p>Partagez vos fichiers instantanément avec vos pairs</p>
                </div>
                <div className="feature-card">
                    <h2>Sécurisé</h2>
                    <p>Communication chiffrée et sécurisée</p>
                </div>
                <div className="feature-card">
                    <h2>Rapide</h2>
                    <p>Transferts de fichiers optimisés</p>
                </div>
            </section>

            <section className="stats">
                <h2>Statistiques en Temps Réel</h2>
                <div className="chart-container">
                    <canvas id="networkStats"></canvas>
                </div>
            </section>
        </>
    );
} 