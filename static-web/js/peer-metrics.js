class PeerMetrics {
    constructor(maxPeers = 5) {
        this.maxPeers = maxPeers;
        this.peers = new Map(); // Map<peerId, {bandwidth: number, lastUpdate: Date, latency: number}>
        this.measurements = new Map(); // Map<peerId, Array<{timestamp: Date, bytes: number}>>
    }

    // Mesurer la bande passante pour un pair
    async measureBandwidth(peerId, dataChannel) {
        const startTime = Date.now();
        const testData = new ArrayBuffer(1024 * 1024); // 1MB de données de test
        let bytesReceived = 0;
        let measurementTimeout;

        return new Promise((resolve, reject) => {
            // Timeout après 5 secondes
            measurementTimeout = setTimeout(() => {
                dataChannel.removeEventListener('message', onMessage);
                reject(new Error('Timeout lors de la mesure de la bande passante'));
            }, 5000);

            const onMessage = (event) => {
                bytesReceived += event.data.byteLength;
                if (bytesReceived >= testData.byteLength) {
                    clearTimeout(measurementTimeout);
                    dataChannel.removeEventListener('message', onMessage);
                    const endTime = Date.now();
                    const duration = (endTime - startTime) / 1000; // en secondes
                    const bandwidth = (bytesReceived * 8) / duration; // en bits par seconde
                    
                    this.updatePeerMetrics(peerId, bandwidth, endTime - startTime);
                    resolve(bandwidth);
                }
            };

            dataChannel.addEventListener('message', onMessage);
            dataChannel.send(testData);
        });
    }

    // Mettre à jour les métriques d'un pair
    updatePeerMetrics(peerId, bandwidth, latency) {
        const now = new Date();
        const measurements = this.measurements.get(peerId) || [];
        
        // Garder seulement les 10 dernières mesures
        if (measurements.length >= 10) {
            measurements.shift();
        }
        
        measurements.push({
            timestamp: now,
            bandwidth: bandwidth,
            latency: latency
        });
        
        this.measurements.set(peerId, measurements);
        
        // Calculer la moyenne pondérée (plus de poids aux mesures récentes)
        const weightedAvg = this.calculateWeightedAverage(measurements);
        
        this.peers.set(peerId, {
            bandwidth: weightedAvg.bandwidth,
            latency: weightedAvg.latency,
            lastUpdate: now
        });
    }

    // Calculer la moyenne pondérée des mesures
    calculateWeightedAverage(measurements) {
        if (measurements.length === 0) return { bandwidth: 0, latency: 0 };

        let totalWeight = 0;
        let weightedBandwidth = 0;
        let weightedLatency = 0;

        measurements.forEach((measurement, index) => {
            const weight = Math.pow(2, index); // Plus de poids aux mesures récentes
            totalWeight += weight;
            weightedBandwidth += measurement.bandwidth * weight;
            weightedLatency += measurement.latency * weight;
        });

        return {
            bandwidth: weightedBandwidth / totalWeight,
            latency: weightedLatency / totalWeight
        };
    }

    // Obtenir les meilleurs pairs
    getBestPeers() {
        const peersArray = Array.from(this.peers.entries())
            .map(([peerId, metrics]) => ({
                peerId,
                ...metrics
            }))
            .sort((a, b) => b.bandwidth - a.bandwidth)
            .slice(0, this.maxPeers);

        return peersArray;
    }

    // Supprimer un pair
    removePeer(peerId) {
        this.peers.delete(peerId);
        this.measurements.delete(peerId);
    }

    // Obtenir les métriques d'un pair spécifique
    getPeerMetrics(peerId) {
        return this.peers.get(peerId);
    }

    // Vérifier si un pair est dans les meilleurs
    isPeerInTop(peerId) {
        const bestPeers = this.getBestPeers();
        return bestPeers.some(peer => peer.peerId === peerId);
    }
} 