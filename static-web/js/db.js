class ContactDB {
    constructor() {
        this.dbName = 'P2PWebsiteDB';
        this.dbVersion = 1;
        this.storeName = 'contacts';
        this.db = null;
        this.eventListeners = new Map();
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => {
                reject('Erreur lors de l\'ouverture de la base de données');
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const store = db.createObjectStore(this.storeName, { keyPath: 'id', autoIncrement: true });
                    store.createIndex('email', 'email', { unique: false });
                    store.createIndex('date', 'date', { unique: false });
                    store.createIndex('name', 'name', { unique: false });
                }
            };
        });
    }

    // Ajouter un écouteur d'événements
    addEventListener(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, new Set());
        }
        this.eventListeners.get(event).add(callback);
    }

    // Supprimer un écouteur d'événements
    removeEventListener(event, callback) {
        if (this.eventListeners.has(event)) {
            this.eventListeners.get(event).delete(callback);
        }
    }

    // Émettre un événement
    emit(event, data) {
        if (this.eventListeners.has(event)) {
            this.eventListeners.get(event).forEach(callback => callback(data));
        }
    }

    async addContact(contact) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            
            const contactWithDate = {
                ...contact,
                date: new Date().toISOString()
            };

            const request = store.add(contactWithDate);

            request.onsuccess = () => {
                this.emit('contactAdded', contactWithDate);
                resolve(request.result);
            };

            request.onerror = () => {
                reject('Erreur lors de l\'ajout du contact');
            };
        });
    }

    async getAllContacts() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.getAll();

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject('Erreur lors de la récupération des contacts');
            };
        });
    }

    async searchContacts(query) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.getAll();

            request.onsuccess = () => {
                const contacts = request.result;
                const searchResults = contacts.filter(contact => 
                    contact.name.toLowerCase().includes(query.toLowerCase()) ||
                    contact.email.toLowerCase().includes(query.toLowerCase()) ||
                    contact.message.toLowerCase().includes(query.toLowerCase())
                );
                resolve(searchResults);
            };

            request.onerror = () => {
                reject('Erreur lors de la recherche des contacts');
            };
        });
    }

    async filterByDateRange(startDate, endDate) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.getAll();

            request.onsuccess = () => {
                const contacts = request.result;
                const filteredResults = contacts.filter(contact => {
                    const contactDate = new Date(contact.date);
                    return contactDate >= startDate && contactDate <= endDate;
                });
                resolve(filteredResults);
            };

            request.onerror = () => {
                reject('Erreur lors du filtrage des contacts');
            };
        });
    }

    async exportContacts() {
        const contacts = await this.getAllContacts();
        const blob = new Blob([JSON.stringify(contacts, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `contacts_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    async syncWithPeer(peerData) {
        return new Promise(async (resolve, reject) => {
            try {
                const transaction = this.db.transaction([this.storeName], 'readwrite');
                const store = transaction.objectStore(this.storeName);
                
                // Récupérer tous les contacts existants
                const existingContacts = await this.getAllContacts();
                const existingIds = new Set(existingContacts.map(c => c.id));

                // Ajouter les nouveaux contacts
                for (const contact of peerData) {
                    if (!existingIds.has(contact.id)) {
                        await store.add(contact);
                    }
                }

                resolve();
            } catch (error) {
                reject('Erreur lors de la synchronisation : ' + error);
            }
        });
    }

    async deleteContact(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.delete(id);

            request.onsuccess = () => {
                this.emit('contactDeleted', id);
                resolve();
            };

            request.onerror = () => {
                reject('Erreur lors de la suppression du contact');
            };
        });
    }
} 