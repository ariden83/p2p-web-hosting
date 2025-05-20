class P2PSync {
    constructor(db, p2pManager) {
        this.db = db;
        this.p2pManager = p2pManager;
        this.peers = new Map();
        this.connections = new Map();
        this.metrics = new PeerMetrics(p2pManager.config.maxPeers || 5);
        this.signalingServers = new Map(); // Map<serverId, {metrics: PeerMetrics, lastUpdate: Date}>
        this.contentPeer = null; // Pair pour le chargement du contenu
        this.setupEventListeners();
        this.loadCurrentPage();
    }

    setupEventListeners() {
        // Écouter les changements de la base de données
        this.db.addEventListener('contactAdded', (contact) => {
            this.broadcastUpdate('contactAdded', contact);
        });

        this.db.addEventListener('contactDeleted', (id) => {
            this.broadcastUpdate('contactDeleted', id);
        });

        // Écouter les messages de signalement du P2PManager
        this.p2pManager.on('signaling', (message) => {
            this.handleSignalingMessage(message);
        });

        // Écouter les connexions de nouveaux pairs
        this.p2pManager.on('peerConnected', (peerId) => {
            this.connectToPeer(peerId);
        });

        // Écouter les déconnexions
        this.p2pManager.on('peerDisconnected', (peerId) => {
            this.handlePeerDisconnection(peerId);
        });

        // Écouter les changements de statut de serveur de signalement
        this.p2pManager.on('signalingServerStatus', (isServer) => {
            if (isServer) {
                this.startSignalingServerSync();
            }
        });

        // Écouter les changements de la liste des meilleurs pairs
        this.p2pManager.on('bestPeersUpdated', (bestPeers) => {
            this.connectToContentPeer(bestPeers);
        });
    }

    // Démarrer la synchronisation entre serveurs de signalement
    startSignalingServerSync() {
        // Synchroniser toutes les 30 secondes
        setInterval(() => {
            this.syncWithSignalingServers();
        }, 30000);
    }

    // Synchroniser avec les autres serveurs de signalement
    async syncWithSignalingServers() {
        if (!this.p2pManager.isSignalingServer) return;

        const myMetrics = this.metrics.getBestPeers();
        const message = {
            type: 'signalingServerSync',
            serverId: this.p2pManager.peerId,
            metrics: myMetrics,
            timestamp: Date.now()
        };

        // Envoyer nos métriques à tous les autres serveurs de signalement
        this.p2pManager.getSignalingServers().forEach(serverId => {
            if (serverId !== this.p2pManager.peerId) {
                this.broadcastUpdate('signalingServerSync', message, serverId);
            }
        });
    }

    async connectToPeer(peerId) {
        try {
            console.log(`Tentative de connexion au pair ${peerId}`);
            
            // Configuration WebRTC avec plusieurs serveurs STUN
            const configuration = {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:stun2.l.google.com:19302' },
                    { urls: 'stun:stun3.l.google.com:19302' },
                    { urls: 'stun:stun4.l.google.com:19302' },
                    { urls: 'stun:stun.stunprotocol.org:3478' },
                    { urls: 'stun:stun.voiparound.com:3478' },
                    { urls: 'stun:stun.voipbuster.com:3478' },
                    { urls: 'stun:stun.voipstunt.com:3478' },
                    { urls: 'stun:stun.voxgratia.org:3478' }
                ],
                iceCandidatePoolSize: 10,
                iceTransportPolicy: 'all',
                bundlePolicy: 'max-bundle',
                rtcpMuxPolicy: 'require'
            };

            console.log('Création de la connexion RTCPeerConnection');
            const connection = new RTCPeerConnection(configuration);
            this.connections.set(peerId, connection);

            // Gérer les candidats ICE
            connection.onicecandidate = (event) => {
                if (event.candidate) {
                    console.log(`Nouveau candidat ICE pour ${peerId}:`, event.candidate);
                    this.p2pManager.sendSignalingMessage({
                        type: 'ice-candidate',
                        candidate: event.candidate,
                        peerId: peerId
                    });
                } else {
                    console.log(`Fin de la collecte des candidats ICE pour ${peerId}`);
                }
            };

            // Ajouter des gestionnaires d'événements pour le suivi de la connexion
            connection.oniceconnectionstatechange = () => {
                console.log(`État de la connexion ICE avec ${peerId}: ${connection.iceConnectionState}`);
                if (connection.iceConnectionState === 'failed') {
                    console.error(`Échec de la connexion ICE avec ${peerId}`);
                    this.handleConnectionFailure(peerId);
                }
            };

            connection.onicegatheringstatechange = () => {
                console.log(`État de la collecte ICE avec ${peerId}: ${connection.iceGatheringState}`);
            };

            connection.onsignalingstatechange = () => {
                console.log(`État du signalement avec ${peerId}: ${connection.signalingState}`);
            };

            connection.onconnectionstatechange = () => {
                console.log(`État de la connexion avec ${peerId}: ${connection.connectionState}`);
                if (connection.connectionState === 'failed') {
                    console.error(`Échec de la connexion avec ${peerId}`);
                    this.handleConnectionFailure(peerId);
                }
            };

            // Créer le canal de données
            console.log(`Création du canal de données pour ${peerId}`);
            const dataChannel = connection.createDataChannel('sync', {
                ordered: true,
                maxRetransmits: 3
            });
            this.setupDataChannel(dataChannel, peerId);

            // Créer et envoyer l'offre
            console.log(`Création de l'offre pour ${peerId}`);
            const offer = await connection.createOffer({
                offerToReceiveAudio: false,
                offerToReceiveVideo: false,
                iceRestart: true
            });
            
            console.log(`Configuration de la description locale pour ${peerId}`);
            await connection.setLocalDescription(offer);

            // Envoyer l'offre via le P2PManager
            console.log(`Envoi de l'offre à ${peerId}`);
            this.p2pManager.sendSignalingMessage({
                type: 'offer',
                offer: offer,
                peerId: peerId
            });

        } catch (error) {
            console.error('Erreur lors de la connexion P2P:', error);
            this.handleConnectionFailure(peerId);
            throw error;
        }
    }

    handleConnectionFailure(peerId) {
        console.log(`Gestion de l'échec de connexion pour ${peerId}`);
        const connection = this.connections.get(peerId);
        if (connection) {
            connection.close();
            this.connections.delete(peerId);
        }
        // Notifier le P2PManager de l'échec
        this.p2pManager.handleConnectionFailure(peerId);
    }

    setupDataChannel(channel, peerId) {
        channel.onmessage = async (event) => {
            const message = JSON.parse(event.data);
            await this.handleSyncMessage(message, peerId);
        };

        channel.onopen = async () => {
            console.log(`Canal de données P2P ouvert avec le pair ${peerId}`);
            
            // Mesurer la bande passante
            try {
                await this.metrics.measureBandwidth(peerId, channel);
                console.log(`Métriques mises à jour pour le pair ${peerId}`);
                
                // Si nous sommes un serveur de signalement, mettre à jour notre liste
                if (this.p2pManager.isSignalingServer) {
                    this.updateBestPeers();
                    // Synchroniser avec les autres serveurs
                    this.syncWithSignalingServers();
                }
            } catch (error) {
                console.error(`Erreur lors de la mesure de la bande passante pour ${peerId}:`, error);
            }

            // Demander une synchronisation complète
            this.broadcastUpdate('syncRequest', this.p2pManager.peerId, peerId);
        };

        channel.onclose = () => {
            console.log(`Canal de données P2P fermé avec le pair ${peerId}`);
            this.handlePeerDisconnection(peerId);
        };
    }

    handlePeerDisconnection(peerId) {
        this.connections.delete(peerId);
        this.metrics.removePeer(peerId);
        
        // Si nous sommes un serveur de signalement
        if (this.p2pManager.isSignalingServer) {
            this.updateBestPeers();
            // Synchroniser avec les autres serveurs
            this.syncWithSignalingServers();
        }
    }

    updateBestPeers() {
        const bestPeers = this.metrics.getBestPeers();
        this.p2pManager.updateBestPeers(bestPeers.map(peer => peer.peerId));
    }

    async handleSyncMessage(message, peerId) {
        switch (message.type) {
            case 'contactAdded':
                await this.db.addContact(message.data);
                break;
            case 'contactDeleted':
                await this.db.deleteContact(message.data);
                break;
            case 'syncRequest':
                await this.sendFullSync(peerId);
                break;
            case 'fullSync':
                for (const contact of message.data) {
                    await this.db.addContact(contact);
                }
                break;
            case 'signalingServerSync':
                await this.handleSignalingServerSync(message);
                break;
            case 'requestSignalingRole':
                await this.handleSignalingRoleRequest(message);
                break;
            case 'requestPage':
                await this.handlePageRequest(message, peerId);
                break;
            case 'pageContent':
                await this.handlePageContent(message);
                break;
        }
    }

    async handleSignalingServerSync(message) {
        if (!this.p2pManager.isSignalingServer) return;

        const { serverId, metrics, timestamp } = message;
        
        // Mettre à jour les métriques du serveur
        this.signalingServers.set(serverId, {
            metrics: metrics,
            lastUpdate: new Date(timestamp)
        });

        // Nettoyer les serveurs inactifs (plus de 2 minutes sans mise à jour)
        const now = Date.now();
        for (const [id, data] of this.signalingServers.entries()) {
            if (now - data.lastUpdate.getTime() > 120000) {
                this.signalingServers.delete(id);
            }
        }

        // Calculer la liste consolidée des meilleurs pairs (en excluant les serveurs de signalement)
        const allPeers = new Map();
        
        // Ajouter nos propres métriques (en excluant les serveurs de signalement)
        this.metrics.getBestPeers().forEach(peer => {
            if (!this.p2pManager.isSignalingServerId(peer.peerId)) {
                allPeers.set(peer.peerId, peer);
            }
        });

        // Ajouter les métriques des autres serveurs (en excluant les serveurs de signalement)
        this.signalingServers.forEach(serverData => {
            serverData.metrics.forEach(peer => {
                if (!this.p2pManager.isSignalingServerId(peer.peerId)) {
                    if (!allPeers.has(peer.peerId) || peer.bandwidth > allPeers.get(peer.peerId).bandwidth) {
                        allPeers.set(peer.peerId, peer);
                    }
                }
            });
        });

        // Trier et limiter à maxPeers
        const consolidatedPeers = Array.from(allPeers.values())
            .sort((a, b) => b.bandwidth - a.bandwidth)
            .slice(0, this.metrics.maxPeers);

        // Mettre à jour notre liste de meilleurs pairs
        this.p2pManager.updateBestPeers(consolidatedPeers.map(peer => peer.peerId));

        // Vérifier si nous devons changer de rôle
        await this.checkSignalingServerRole(consolidatedPeers);
    }

    async checkSignalingServerRole(bestPeers) {
        if (!this.p2pManager.isSignalingServer) return;

        // Obtenir notre bande passante actuelle
        const myMetrics = this.metrics.getPeerMetrics(this.p2pManager.peerId);
        if (!myMetrics) return;

        // Si nous sommes le dernier serveur de signalement, on reste
        if (this.signalingServers.size === 0) return;

        // Trouver le pair avec la plus faible bande passante dans la liste des meilleurs pairs
        const lowestBandwidthPeer = bestPeers[bestPeers.length - 1];
        if (!lowestBandwidthPeer) return;

        // Si notre bande passante est inférieure à celle du pair le plus faible
        if (myMetrics.bandwidth < lowestBandwidthPeer.bandwidth) {
            console.log('Bande passante trop faible, changement de rôle nécessaire');
            
            // Sélectionner un pair aléatoire parmi les meilleurs pairs
            const randomIndex = Math.floor(Math.random() * bestPeers.length);
            const newSignalingServer = bestPeers[randomIndex];

            // Demander au pair sélectionné de devenir serveur de signalement
            await this.requestSignalingServerRole(newSignalingServer.peerId);
        }
    }

    async requestSignalingServerRole(newServerId) {
        try {
            // Envoyer la demande de changement de rôle
            this.broadcastUpdate('requestSignalingRole', {
                currentServerId: this.p2pManager.peerId,
                newServerId: newServerId
            }, newServerId);

            // Attendre la confirmation
            const response = await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Timeout lors de la demande de changement de rôle'));
                }, 10000);

                const handler = (message) => {
                    if (message.type === 'signalingRoleResponse' && 
                        message.currentServerId === this.p2pManager.peerId) {
                        clearTimeout(timeout);
                        this.p2pManager.removeEventListener('signaling', handler);
                        resolve(message);
                    }
                };

                this.p2pManager.addEventListener('signaling', handler);
            });

            if (response.accepted) {
                // Changer notre ID de pair
                await this.p2pManager.changePeerId(response.newPeerId);
                // Mettre à jour notre statut
                this.p2pManager.setSignalingServerStatus(false);
            }
        } catch (error) {
            console.error('Erreur lors de la demande de changement de rôle:', error);
        }
    }

    async handleSignalingRoleRequest(message) {
        const { currentServerId, newServerId } = message;
        
        // Vérifier si nous sommes le pair ciblé
        if (newServerId !== this.p2pManager.peerId) return;

        try {
            // Générer un nouvel ID de pair pour l'ancien serveur
            const newPeerId = await this.p2pManager.generateNewPeerId();
            
            // Accepter le changement de rôle
            this.broadcastUpdate('signalingRoleResponse', {
                currentServerId: currentServerId,
                newServerId: newServerId,
                newPeerId: newPeerId,
                accepted: true
            }, currentServerId);

            // Changer notre ID de pair pour prendre celui du serveur
            await this.p2pManager.changePeerId(currentServerId);
            // Mettre à jour notre statut
            this.p2pManager.setSignalingServerStatus(true);
        } catch (error) {
            console.error('Erreur lors du changement de rôle:', error);
            // Refuser le changement de rôle
            this.broadcastUpdate('signalingRoleResponse', {
                currentServerId: currentServerId,
                newServerId: newServerId,
                accepted: false
            }, currentServerId);
        }
    }

    broadcastUpdate(type, data, targetPeerId = null) {
        if (targetPeerId) {
            // Envoyer à un pair spécifique
            const connection = this.connections.get(targetPeerId);
            if (connection && connection.dataChannel && connection.dataChannel.readyState === 'open') {
                connection.dataChannel.send(JSON.stringify({
                    type: type,
                    data: data
                }));
            }
        } else {
            // Diffuser à tous les pairs connectés
            this.connections.forEach((connection, peerId) => {
                if (connection.dataChannel && connection.dataChannel.readyState === 'open') {
                    connection.dataChannel.send(JSON.stringify({
                        type: type,
                        data: data
                    }));
                }
            });
        }
    }

    async sendFullSync(peerId) {
        const contacts = await this.db.getAllContacts();
        this.broadcastUpdate('fullSync', contacts, peerId);
    }

    async handleSignalingMessage(message) {
        switch (message.type) {
            case 'offer':
                await this.handleOffer(message);
                break;
            case 'answer':
                await this.handleAnswer(message);
                break;
            case 'ice-candidate':
                await this.handleIceCandidate(message);
                break;
        }
    }

    async handleOffer(message) {
        console.log(`Réception d'une offre de ${message.peerId}`);
        let connection = this.connections.get(message.peerId);
        if (!connection) {
            console.log(`Création d'une nouvelle connexion pour ${message.peerId}`);
            connection = new RTCPeerConnection({
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:stun2.l.google.com:19302' },
                    { urls: 'stun:stun3.l.google.com:19302' },
                    { urls: 'stun:stun4.l.google.com:19302' },
                    { urls: 'stun:stun.stunprotocol.org:3478' },
                    { urls: 'stun:stun.voiparound.com:3478' },
                    { urls: 'stun:stun.voipbuster.com:3478' },
                    { urls: 'stun:stun.voipstunt.com:3478' },
                    { urls: 'stun:stun.voxgratia.org:3478' }
                ],
                iceCandidatePoolSize: 10,
                iceTransportPolicy: 'all',
                bundlePolicy: 'max-bundle',
                rtcpMuxPolicy: 'require'
            });
            this.connections.set(message.peerId, connection);
            
            // Gérer les candidats ICE
            connection.onicecandidate = (event) => {
                if (event.candidate) {
                    console.log(`Nouveau candidat ICE pour ${message.peerId}:`, event.candidate);
                    this.p2pManager.sendSignalingMessage({
                        type: 'ice-candidate',
                        candidate: event.candidate,
                        peerId: message.peerId
                    });
                }
            };

            // Écouter le canal de données créé par le pair distant
            connection.ondatachannel = (event) => {
                console.log(`Réception du canal de données de ${message.peerId}`);
                this.setupDataChannel(event.channel, message.peerId);
            };
        }

        try {
            console.log(`Configuration de la description distante pour ${message.peerId}`);
            await connection.setRemoteDescription(new RTCSessionDescription(message.offer));
            
            console.log(`Création de la réponse pour ${message.peerId}`);
            const answer = await connection.createAnswer();
            
            console.log(`Configuration de la description locale pour ${message.peerId}`);
            await connection.setLocalDescription(answer);

            // Envoyer la réponse via le P2PManager
            console.log(`Envoi de la réponse à ${message.peerId}`);
            this.p2pManager.sendSignalingMessage({
                type: 'answer',
                answer: answer,
                peerId: message.peerId
            });
        } catch (error) {
            console.error(`Erreur lors du traitement de l'offre de ${message.peerId}:`, error);
            this.handleConnectionFailure(message.peerId);
            throw error;
        }
    }

    async handleAnswer(message) {
        const connection = this.connections.get(message.peerId);
        if (connection) {
            await connection.setRemoteDescription(new RTCSessionDescription(message.answer));
        }
    }

    async handleIceCandidate(message) {
        const connection = this.connections.get(message.peerId);
        if (connection) {
            await connection.addIceCandidate(new RTCIceCandidate(message.candidate));
        }
    }

    async loadCurrentPage() {
        const path = window.location.pathname;
        const pagePath = path === '/' ? 'index.html' : path.substring(1);
        
        // Si nous avons déjà un pair de contenu, on lui demande la page
        if (this.contentPeer) {
            await this.requestPageFromPeer(this.contentPeer, pagePath);
        }
    }

    async connectToContentPeer(bestPeers) {
        // Filtrer les pairs qui ne sont pas des serveurs de signalement
        const contentPeers = bestPeers.filter(peerId => !this.p2pManager.isSignalingServerId(peerId));
        
        if (contentPeers.length === 0) return;

        // Sélectionner un pair aléatoire parmi les meilleurs
        const randomIndex = Math.floor(Math.random() * contentPeers.length);
        const selectedPeerId = contentPeers[randomIndex];

        try {
            console.log(`Tentative de connexion au pair de contenu ${selectedPeerId}`);
            await this.connectToPeer(selectedPeerId);
            this.contentPeer = selectedPeerId;
            
            // Charger la page courante
            await this.loadCurrentPage();
        } catch (error) {
            console.error(`Erreur lors de la connexion au pair de contenu:`, error);
        }
    }

    async requestPageFromPeer(peerId, pagePath) {
        const message = {
            type: 'requestPage',
            path: pagePath,
            repo: 'ariden83/p2p-web-hosting',
            branch: 'main'
        };

        this.broadcastUpdate('requestPage', message, peerId);
    }

    async handlePageRequest(message, peerId) {
        const { path, repo, branch } = message;
        try {
            const url = `https://raw.githubusercontent.com/${repo}/${branch}/static-web/${path}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }

            const content = await response.text();
            
            // Envoyer le contenu au pair qui l'a demandé
            this.broadcastUpdate('pageContent', {
                path: path,
                content: content
            }, peerId);
        } catch (error) {
            console.error(`Erreur lors du chargement de la page ${path}:`, error);
        }
    }

    async handlePageContent(message) {
        const { path, content } = message;
        
        // Si c'est la page courante, on la charge
        const currentPath = window.location.pathname;
        const currentPage = currentPath === '/' ? 'index.html' : currentPath.substring(1);
        
        if (path === currentPage) {
            // Créer un élément temporaire pour parser le HTML
            const temp = document.createElement('div');
            temp.innerHTML = content;
            
            // Remplacer le contenu de la page
            document.body.innerHTML = content;
            
            // Réexécuter les scripts
            const scripts = document.getElementsByTagName('script');
            for (const script of scripts) {
                const newScript = document.createElement('script');
                if (script.src) {
                    newScript.src = script.src;
                } else {
                    newScript.textContent = script.textContent;
                }
                document.body.appendChild(newScript);
            }
        }
    }
} 