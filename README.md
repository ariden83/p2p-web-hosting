# P2P Website

Un site web décentralisé utilisant IPFS et WebRTC pour le partage de contenu en pair à pair.

## Structure du Projet

```
p2p-website/
├── ipfs/                  # Dossier à envoyer sur IPFS
│   ├── index.html        # Point d'entrée minimal
│   └── p2p-manager.js    # Gestionnaire P2P
└── static-web/           # Contenu du site (chargé depuis GitHub)
    ├── css/             # Styles
    ├── js/              # Scripts et composants React
    └── ...
```

## Fonctionnement

1. **Démarrage Initial**
   - Le site est accessible via un nom de domaine configuré avec IPFS
   - Le navigateur charge `index.html` et `p2p-manager.js` depuis IPFS
   - Ces fichiers sont les seuls nécessaires pour démarrer l'application

2. **Chargement Dynamique**
   - `p2p-manager.js` charge les dépendances React depuis CDN
   - Il charge ensuite les fichiers du site depuis GitHub
   - L'application React est initialisée

3. **Réseau P2P**
   - Les pairs se connectent via WebRTC
   - Le contenu est partagé entre les pairs
   - Les serveurs de signalement gèrent les connexions

## Déploiement

1. **Préparation**
   ```bash
   # Vérifier que le dossier ipfs contient les fichiers essentiels
   ls ipfs/
   # Devrait afficher : index.html p2p-manager.js
   ```

2. **Déploiement sur IPFS**
   ```bash
   # Ajouter le dossier ipfs à IPFS
   ipfs add -r ipfs/
   # Notez le hash du dossier (Qm...)
   ```

3. **Configuration du Nom de Domaine**
   - Option 1 : DNSLink
     ```
     _dnslink.votre-domaine.com. IN TXT "dnslink=/ipfs/Qm..."
     ```
   - Option 2 : Cloudflare
     - Activer IPFS Gateway
     - Configurer le nom de domaine pour pointer vers le hash IPFS

4. **Accès au Site**
   Pour accéder au site, vous avez plusieurs options :

   a) **Via un Gateway IPFS (Recommandé)**
   - Utiliser Cloudflare IPFS Gateway (https://cloudflare-ipfs.com/ipfs/Qm...)
   - Utiliser d'autres gateways publics (ipfs.io, dweb.link, etc.)
   - Le site sera accessible via HTTPS standard

   b) **Via un Navigateur avec Extension IPFS**
   - Installer l'extension IPFS Companion
   - Accéder directement via le protocole ipfs://
   - Nécessite une configuration supplémentaire

   c) **Via un Nœud IPFS Local**
   - Installer IPFS Desktop ou ipfs daemon
   - Accéder via http://localhost:8080/ipfs/Qm...
   - Pour les développeurs et utilisateurs avancés

   > **Note importante** : La plupart des utilisateurs accéderont au site via un gateway IPFS, car les navigateurs ne supportent pas nativement le protocole IPFS. Cloudflare IPFS Gateway est recommandé pour une meilleure performance et fiabilité.

## Cloudflare IPFS Gateway

Cloudflare IPFS Gateway est un service qui permet d'accéder au contenu IPFS via HTTPS standard. Voici ses avantages :

1. **Accessibilité**
   - Permet d'accéder au contenu IPFS via HTTPS standard
   - Fonctionne avec tous les navigateurs modernes
   - Pas besoin d'extension ou de configuration spéciale

2. **Performance**
   - Réseau de CDN mondial de Cloudflare
   - Mise en cache intelligente
   - Temps de chargement optimisés

3. **Configuration**
   ```bash
   # 1. Créer un compte Cloudflare (gratuit)
   # 2. Ajouter votre domaine
   # 3. Activer IPFS Gateway dans les paramètres
   # 4. Configurer le DNS pour pointer vers le hash IPFS
   ```

4. **URLs**
   - Format standard : `https://cloudflare-ipfs.com/ipfs/Qm...`
   - Format personnalisé : `https://votre-domaine.com/ipfs/Qm...`
   - Les deux formats sont supportés

5. **Sécurité**
   - HTTPS par défaut
   - Protection DDoS incluse
   - Certificats SSL automatiques

6. **Coûts**
   - Service IPFS Gateway : **Gratuit**
   - Protection DDoS : **Gratuit**
   - Certificats SSL : **Gratuit**
   - CDN : **Gratuit**
   - Seul coût : votre nom de domaine (environ 10-15€/an)

7. **Guide de Configuration Pas à Pas**
   ```bash
   # 1. Ajouter votre site sur IPFS
   ipfs add -r ipfs/
   # Notez le hash du dossier (Qm...)

   # 2. Sur Cloudflare
   a) Créer un compte Cloudflare
   b) Ajouter votre domaine
   c) Suivre les instructions pour changer les serveurs DNS
   d) Dans le dashboard Cloudflare :
      - Aller dans "Websites"
      - Sélectionner votre domaine
      - Aller dans "DNS"
      - Ajouter un enregistrement CNAME :
        * Nom : @
        * Cible : cloudflare-ipfs.com
      - Aller dans "SSL/TLS"
      - Activer "Full" ou "Full (Strict)"
      - Aller dans "IPFS"
      - Activer IPFS Gateway
      - Configurer le hash IPFS de votre dossier
   ```

> **Note** : Cloudflare propose ce service gratuitement dans le cadre de sa mission de rendre Internet plus rapide et plus sécurisé. Il n'y a pas de limitations significatives pour un usage personnel ou de petite entreprise.

> **Important** : Une fois configuré, votre site sera accessible via :
> - `https://votre-domaine.com` (format personnalisé)
> - `https://cloudflare-ipfs.com/ipfs/Qm...` (format standard)
> Les deux URLs pointeront vers le même contenu.

## Développement

1. **Configuration Locale**
   ```bash
   # Cloner le repository
   git clone https://github.com/votre-username/p2p-website.git
   cd p2p-website
   ```

2. **Modification du Contenu**
   - Modifier les fichiers dans `static-web/`
   - Tester localement en ouvrant `ipfs/index.html`
   - Les fichiers seront chargés depuis GitHub

3. **Mise à Jour**
   - Commiter les changements sur GitHub
   - Le site se mettra à jour automatiquement pour les nouveaux visiteurs

## Configuration

Le fichier `p2p-manager.js` contient les configurations importantes :
```javascript
this.config = {
    maxPeers: 5,                    // Nombre maximum de pairs
    githubRepo: 'p2p-website',      // Nom du repository GitHub
    githubOwner: 'votre-username',  // Propriétaire du repository
    githubBranch: 'main'           // Branche à utiliser
};
```

## Sécurité

- Les connexions WebRTC sont chiffrées
- Le contenu est vérifié avant d'être affiché
- Les pairs sont authentifiés via leur ID

## Contribution

1. Fork le projet
2. Créer une branche pour votre fonctionnalité
3. Commiter vos changements
4. Pousser vers la branche
5. Créer une Pull Request

## Licence

Ce projet est sous licence MIT. Voir le fichier `LICENSE` pour plus de détails.


## Remerciements

- Inspiré par les projets open source de la communauté
