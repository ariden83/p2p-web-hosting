document.addEventListener('DOMContentLoaded', async function() {
    const db = new ContactDB();
    await db.init();

    // Initialiser le P2PManager
    const p2pManager = new P2PManager();
    await p2pManager.init();

    // Initialiser la synchronisation P2P avec le P2PManager
    const p2pSync = new P2PSync(db, p2pManager);

    const contactForm = document.getElementById('contactForm');
    const messagesContainer = document.getElementById('messagesContainer');
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    const startDate = document.getElementById('startDate');
    const endDate = document.getElementById('endDate');
    const filterBtn = document.getElementById('filterBtn');
    const exportBtn = document.getElementById('exportBtn');
    const syncBtn = document.getElementById('syncBtn');

    // Mettre à jour le statut de synchronisation
    function updateSyncStatus() {
        const connectedPeers = p2pManager.getConnectedPeers();
        syncBtn.textContent = `🔄 Synchronisé (${connectedPeers.length} pairs)`;
    }

    // Écouter les changements de connexion
    p2pManager.on('peerConnected', () => {
        updateSyncStatus();
    });

    p2pManager.on('peerDisconnected', () => {
        updateSyncStatus();
    });

    // Gestion du formulaire
    contactForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const formData = {
            name: document.getElementById('name').value,
            email: document.getElementById('email').value,
            message: document.getElementById('message').value
        };

        try {
            await db.addContact(formData);
            alert('Message enregistré avec succès !');
            contactForm.reset();
            await displayMessages();
        } catch (error) {
            alert('Erreur lors de l\'enregistrement du message : ' + error);
        }
    });

    // Recherche
    searchBtn.addEventListener('click', async () => {
        const query = searchInput.value.trim();
        if (query) {
            try {
                const results = await db.searchContacts(query);
                await displayMessages(results);
            } catch (error) {
                alert('Erreur lors de la recherche : ' + error);
            }
        } else {
            await displayMessages();
        }
    });

    // Filtrage par date
    filterBtn.addEventListener('click', async () => {
        const start = startDate.value ? new Date(startDate.value) : null;
        const end = endDate.value ? new Date(endDate.value) : null;

        if (start && end) {
            try {
                const results = await db.filterByDateRange(start, end);
                await displayMessages(results);
            } catch (error) {
                alert('Erreur lors du filtrage : ' + error);
            }
        } else {
            await displayMessages();
        }
    });

    // Export
    exportBtn.addEventListener('click', async () => {
        try {
            await db.exportContacts();
        } catch (error) {
            alert('Erreur lors de l\'export : ' + error);
        }
    });

    // Synchronisation
    syncBtn.addEventListener('click', async () => {
        try {
            const connectedPeers = p2pManager.getConnectedPeers();
            if (connectedPeers.length === 0) {
                alert('Aucun pair connecté. La connexion se fera automatiquement lorsqu\'un pair sera disponible.');
            } else {
                alert(`Connecté à ${connectedPeers.length} pairs. La synchronisation est automatique.`);
            }
        } catch (error) {
            alert('Erreur lors de la synchronisation : ' + error);
        }
    });

    // Fonction pour afficher les messages
    async function displayMessages(messages = null) {
        try {
            if (!messages) {
                messages = await db.getAllContacts();
            }
            messagesContainer.innerHTML = '';

            if (messages.length === 0) {
                messagesContainer.innerHTML = '<p class="no-messages">Aucun message trouvé</p>';
                return;
            }

            messages.sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(message => {
                const messageElement = document.createElement('div');
                messageElement.className = 'message-card';
                messageElement.innerHTML = `
                    <div class="message-header">
                        <h3>${message.name}</h3>
                        <span class="message-date">${new Date(message.date).toLocaleString()}</span>
                    </div>
                    <p class="message-email">${message.email}</p>
                    <p class="message-content">${message.message}</p>
                    <button class="delete-btn" data-id="${message.id}">Supprimer</button>
                `;
                messagesContainer.appendChild(messageElement);
            });

            // Ajout des événements de suppression
            document.querySelectorAll('.delete-btn').forEach(button => {
                button.addEventListener('click', async function() {
                    if (confirm('Voulez-vous vraiment supprimer ce message ?')) {
                        try {
                            await db.deleteContact(parseInt(this.dataset.id));
                            await displayMessages();
                        } catch (error) {
                            alert('Erreur lors de la suppression : ' + error);
                        }
                    }
                });
            });
        } catch (error) {
            console.error('Erreur lors de l\'affichage des messages :', error);
        }
    }

    // Fonction pour récupérer les données d'un pair
    async function getPeerData() {
        // Cette fonction devrait être implémentée en fonction de votre système P2P
        // Pour l'instant, elle retourne null
        return null;
    }

    // Affichage initial des messages
    await displayMessages();

    // Mise à jour initiale du statut
    updateSyncStatus();
}); 