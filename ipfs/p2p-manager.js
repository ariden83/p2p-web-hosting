class P2PManager {
    constructor(forcedPeerId = null) {
        this.peer = null;
        this.connections = new Map();
        this.imageCache = new Map();
        this.isInitialized = false;
        this.forcedPeerId = forcedPeerId;
        this.statusElement = document.getElementById('status');
        this.connectionsElement = document.getElementById('connections');
        
        // Liste des IDs de peering prédéfinis avec des UUIDs
        this.predefinedPeerIds = [
            '550e8400-e29b-41d4-a716-446655440000', // UUID v4
            '6ba7b810-9dad-11d1-80b4-00c04fd430c8', // UUID v4
            '6ba7b810-9dad-11d1-80b4-00c04fd430c9', // UUID v4
            '6ba7b810-9dad-11d1-80b4-00c04fd430ca', // UUID v4
            '6ba7b810-9dad-11d1-80b4-00c04fd430cb'  // UUID v4
        ];

        // Ajout des éléments pour le chargement de fichiers
        this.setupFileLoadingUI();
    }

    setupFileLoadingUI() {
        const container = document.createElement('div');
        container.innerHTML = `
            <h2>Chargement de fichiers GitHub</h2>
            <div class="github-loader">
                <input type="text" id="githubRepo" placeholder="owner/repo" />
                <input type="text" id="githubPath" placeholder="chemin/vers/fichier" />
                <button id="loadGithubFile">Charger</button>
            </div>
            <div id="filePreview"></div>
        `;
        document.body.appendChild(container);

        // Ajout des styles
        const style = document.createElement('style');
        style.textContent = `
            .github-loader {
                margin: 20px 0;
                padding: 15px;
                background: #f5f5f5;
                border-radius: 4px;
            }
            .github-loader input {
                margin: 5px;
                padding: 8px;
                width: 200px;
            }
            .github-loader button {
                padding: 8px 15px;
                background: #2ea44f;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
            }
            .github-loader button:hover {
                background: #2c974b;
            }
            #filePreview {
                margin-top: 20px;
                padding: 15px;
                border: 1px solid #ddd;
                border-radius: 4px;
                max-height: 400px;
                overflow: auto;
            }
        `;
        document.head.appendChild(style);

        // Ajout des événements
        document.getElementById('loadGithubFile').addEventListener('click', () => this.loadGithubFile());
    }

    async loadGithubFile() {
        const repo = document.getElementById('githubRepo').value;
        const path = document.getElementById('githubPath').value;
        const preview = document.getElementById('filePreview');

        if (!repo || !path) {
            preview.innerHTML = '<p style="color: red;">Veuillez remplir tous les champs</p>';
            return;
        }

        try {
            const url = `https://raw.githubusercontent.com/${repo}/main/${path}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }

            const content = await response.text();
            const fileExtension = path.split('.').pop().toLowerCase();

            // Traitement selon le type de fichier
            switch (fileExtension) {
                case 'html':
                    preview.innerHTML = content;
                    break;
                case 'css':
                    const style = document.createElement('style');
                    style.textContent = content;
                    document.head.appendChild(style);
                    preview.innerHTML = '<p>CSS chargé et appliqué</p>';
                    break;
                case 'js':
                    try {
                        const script = document.createElement('script');
                        script.textContent = content;
                        document.body.appendChild(script);
                        preview.innerHTML = '<p>JavaScript chargé et exécuté</p>';
                    } catch (error) {
                        preview.innerHTML = `<p style="color: red;">Erreur d'exécution JavaScript: ${error.message}</p>`;
                    }
                    break;
                default:
                    preview.innerHTML = `<pre>${content}</pre>`;
            }

            // Partage du fichier avec les pairs connectés
            this.shareFileWithPeers({
                type: fileExtension,
                content: content,
                path: path
            });

        } catch (error) {
            preview.innerHTML = `<p style="color: red;">Erreur: ${error.message}</p>`;
        }
    }

    shareFileWithPeers(fileData) {
        this.connections.forEach((conn, peerId) => {
            conn.send({
                type: 'file',
                data: fileData
            });
        });
    }

    async initialize() {
        if (this.isInitialized) return;

        // Si un ID forcé est fourni, on l'utilise
        if (this.forcedPeerId) {
            await this.initializeWithId(this.forcedPeerId);
            return;
        }

        // Sinon, on essaie de s'assigner un ID prédéfini
        for (const peerId of this.predefinedPeerIds) {
            try {
                await this.initializeWithId(peerId);
                this.updateStatus(`Connecté en tant que serveur de signalement (ID: ${peerId})`);
                return;
            } catch (error) {
                console.log(`ID ${peerId} non disponible, tentative suivante...`);
            }
        }

        // Si aucun ID prédéfini n'est disponible, on en crée un nouveau
        const newPeerId = crypto.randomUUID();
        await this.initializeWithId(newPeerId);
        this.updateStatus(`Connecté avec un nouvel ID: ${newPeerId}`);
        
        // On essaie de se connecter à un des pairs prédéfinis
        await this.connectToPredefinedPeers();
    }

    async initializeWithId(peerId) {
        return new Promise((resolve, reject) => {
            this.peer = new Peer(peerId, {
                debug: 2,
                config: {
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' }
                    ]
                }
            });

            this.peer.on('open', (id) => {
                console.log('Mon ID P2P:', id);
                this.isInitialized = true;
                this.setupEventListeners();
                resolve(id);
            });

            this.peer.on('error', (err) => {
                console.error('Erreur P2P:', err);
                reject(err);
            });
        });
    }

    setupEventListeners() {
        this.peer.on('connection', (conn) => {
            this.handleNewConnection(conn);
        });

        this.peer.on('disconnected', () => {
            this.updateStatus('Déconnecté', false);
        });

        this.peer.on('close', () => {
            this.updateStatus('Connexion fermée', false);
        });
    }

    async connectToPredefinedPeers() {
        for (const peerId of this.predefinedPeerIds) {
            try {
                const conn = this.peer.connect(peerId);
                await this.handleNewConnection(conn);
                console.log(`Connecté avec succès à ${peerId}`);
                break;
            } catch (error) {
                console.log(`Impossible de se connecter à ${peerId}`);
            }
        }
    }

    handleNewConnection(conn) {
        return new Promise((resolve) => {
            conn.on('open', () => {
                console.log(`Nouvelle connexion établie avec ${conn.peer}`);
                this.connections.set(conn.peer, conn);
                this.updateConnectionsList();

                conn.on('data', (data) => {
                    console.log('Données reçues:', data);
                    if (data.type === 'file') {
                        this.handleReceivedFile(data.data);
                    }
                });

                conn.on('close', () => {
                    console.log(`Connexion fermée avec ${conn.peer}`);
                    this.connections.delete(conn.peer);
                    this.updateConnectionsList();
                });

                resolve(conn);
            });
        });
    }

    handleReceivedFile(fileData) {
        const preview = document.getElementById('filePreview');
        preview.innerHTML = `<h3>Fichier reçu: ${fileData.path}</h3>`;

        switch (fileData.type) {
            case 'html':
                preview.innerHTML += fileData.content;
                break;
            case 'css':
                const style = document.createElement('style');
                style.textContent = fileData.content;
                document.head.appendChild(style);
                preview.innerHTML += '<p>CSS reçu et appliqué</p>';
                break;
            case 'js':
                try {
                    const script = document.createElement('script');
                    script.textContent = fileData.content;
                    document.body.appendChild(script);
                    preview.innerHTML += '<p>JavaScript reçu et exécuté</p>';
                } catch (error) {
                    preview.innerHTML += `<p style="color: red;">Erreur d'exécution JavaScript: ${error.message}</p>`;
                }
                break;
            default:
                preview.innerHTML += `<pre>${fileData.content}</pre>`;
        }
    }

    updateStatus(message, isConnected = true) {
        this.statusElement.textContent = message;
        this.statusElement.className = isConnected ? 'connected' : 'disconnected';
    }

    updateConnectionsList() {
        this.connectionsElement.innerHTML = '<h2>Connexions actives:</h2>';
        if (this.connections.size === 0) {
            this.connectionsElement.innerHTML += '<p>Aucune connexion active</p>';
            return;
        }

        const list = document.createElement('ul');
        this.connections.forEach((conn, peerId) => {
            const item = document.createElement('li');
            item.textContent = `Peer ID: ${peerId}`;
            list.appendChild(item);
        });
        this.connectionsElement.appendChild(list);
    }
}

// Initialisation du P2P Manager
const p2pManager = new P2PManager();
p2pManager.initialize().catch(error => {
    console.error('Erreur lors de l\'initialisation:', error);
}); 