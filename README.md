# Mister Pneu - Backend API

API REST pour la plateforme e-commerce Mister Pneu avec intégration Gateway ISB-IT et paiements Stripe sécurisés.

## 🚀 Installation

### Prérequis

- Node.js 18+ et npm
- MongoDB (local ou MongoDB Atlas)
- Compte Stripe (clés de test ou production)
- Accès Gateway ISB-IT

### Configuration

1. **Installer les dépendances**

```bash
cd backend
npm install
```

2. **Configurer les variables d'environnement**

Copier `.env.example` vers `.env` et remplir les valeurs :

```bash
cp .env.example .env
```

Remplir les valeurs dans `.env` :

```env
# Database
MONGODB_URI=mongodb://localhost:27017/mister-pneu

# Stripe (obtenir sur https://dashboard.stripe.com/test/apikeys)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Gateway ISB-IT (déjà configuré)
GATEWAY_API_URL=http://test-001.inter-sprint.nl/scripts/cgirpc32.dll/ww0800
GATEWAY_USERNAME=58949
GATEWAY_PASSWORD=znw9r7
```

3. **Démarrer MongoDB**

```bash
# Sur macOS avec Homebrew
brew services start mongodb-community

# Ou avec Docker
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

4. **Démarrer le serveur**

```bash
# Mode développement (avec auto-reload)
npm run dev

# Mode production
npm start
```

Le serveur démarre sur `http://localhost:5000`

## 📚 Endpoints API

### Produits

- `GET /api/products/search/dimensions?width=205&height=55&diameter=16` - Recherche par dimensions
- `GET /api/products/search/vehicle?brand=peugeot&model=208` - Recherche par véhicule
- `GET /api/products/search/plate?plate=AB-123-CD` - Recherche par plaque
- `GET /api/products/:id` - Détails d'un produit avec stock en temps réel
- `POST /api/products/check-stock` - Vérifier le stock de plusieurs produits
- `GET /api/products/brands/list` - Liste des marques disponibles

### Commandes

- `POST /api/orders/create` - Créer une nouvelle commande
- `GET /api/orders/:orderId` - Détails d'une commande
- `POST /api/orders/payment/create` - Créer un paiement Stripe
- `POST /api/orders/payment/confirm` - Confirmer un paiement
- `POST /api/orders/webhook/stripe` - Webhook Stripe (à configurer)

### Santé

- `GET /health` - Vérifier l'état du serveur
- `GET /` - Informations sur l'API

## 🔧 Configuration Stripe

1. **Créer un compte Stripe**
   - Aller sur https://stripe.com
   - Créer un compte gratuit

2. **Obtenir les clés API**
   - Dashboard > Developers > API Keys
   - Copier "Publishable key" et "Secret key"
   - Mode Test pour le développement

3. **Configurer le webhook**
   - Dashboard > Developers > Webhooks
   - Ajouter un endpoint : `https://votre-domaine.com/api/orders/webhook/stripe`
   - Événements à écouter :
     - `payment_intent.succeeded`
     - `payment_intent.payment_failed`
   - Copier le "Signing secret"

4. **Test en local avec Stripe CLI**

```bash
# Installer Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Écouter les webhooks en local
stripe listen --forward-to localhost:5000/api/orders/webhook/stripe
```

## 🔐 Sécurité

- ✅ Helmet.js pour les headers de sécurité
- ✅ Rate limiting (100 requêtes/15 min)
- ✅ CORS configuré
- ✅ 3D Secure pour paiements > 30€
- ✅ Validation des données entrantes
- ✅ Variables d'environnement sécurisées

## 🎯 Fonctionnalités

### Intégration Gateway ISB-IT

- **Protocol 1** : Recherche par dimensions de pneu
- **Protocol 2** : Recherche par véhicule
- **Protocol 3** : Recherche par plaque d'immatriculation
- **Protocol 6** : Liste des marques
- **Protocol 7** : Groupes de produits
- **Protocol 8** : Vérification du stock en temps réel
- **Protocol 102** : Passage de commande
- **Protocol 103** : Statut de commande

### Pricing & Livraison

- Marge automatique de 30% sur prix nets Gateway
- Calcul automatique des délais :
  - 2 jours si en stock
  - 5 jours si hors stock
- Frais de livraison :
  - Gratuit pour commandes > 200€
  - 15€ sinon

### Paiements Stripe

- Payment Intent avec 3D Secure
- Webhooks pour confirmation automatique
- Support remboursements
- Gestion des clients récurrents

## 🧪 Tests

```bash
# Tester l'API
curl http://localhost:5000/health

# Recherche de pneus
curl "http://localhost:5000/api/products/search/dimensions?width=205&height=55&diameter=16"

# Créer une commande (exemple)
curl -X POST http://localhost:5000/api/orders/create \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{"productId": "...", "quantity": 4}],
    "shippingAddress": {
      "firstName": "Jean",
      "lastName": "Dupont",
      "email": "jean@example.com",
      "phone": "0601020304",
      "address": "123 rue Example",
      "city": "Paris",
      "postalCode": "75001"
    }
  }'
```

## 📦 Structure du projet

```
backend/
├── src/
│   ├── config/
│   │   └── database.js          # Configuration MongoDB
│   ├── controllers/
│   │   ├── productController.js # Logique produits
│   │   └── orderController.js   # Logique commandes
│   ├── models/
│   │   ├── Product.js           # Modèle produit
│   │   └── Order.js             # Modèle commande
│   ├── routes/
│   │   ├── productRoutes.js     # Routes produits
│   │   └── orderRoutes.js       # Routes commandes
│   ├── services/
│   │   ├── gatewayService.js    # Intégration Gateway ISB-IT
│   │   └── stripeService.js     # Intégration Stripe
│   └── server.js                # Point d'entrée
├── .env                         # Variables d'environnement
├── .env.example                 # Exemple de config
├── package.json
└── README.md
```

## 🚨 Troubleshooting

### MongoDB ne démarre pas

```bash
# Vérifier le statut
brew services list

# Redémarrer
brew services restart mongodb-community
```

### Erreur Gateway ISB-IT

- Vérifier les credentials dans `.env`
- Vérifier la connexion réseau
- Tester l'URL manuellement

### Stripe webhook ne fonctionne pas

- Vérifier le signing secret
- Utiliser Stripe CLI pour tester en local
- Vérifier les logs du serveur

## 📄 Licence

Propriétaire - Mister Pneu © 2024
