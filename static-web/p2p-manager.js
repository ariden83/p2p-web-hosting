class P2PManager {
    constructor() {
        this.peer = null;
        this.connections = new Map();
        this.config = {
            maxPeers: 5,
            githubRepo: 'p2p-website',
            githubOwner: 'votre-username',
            githubBranch: 'main'
        };
    }


