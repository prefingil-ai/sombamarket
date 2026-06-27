# Backend Paiement — Bolingo + QI Congo

Backend Node.js qui gère les paiements YaBeTooPay (flux intention en 2 étapes) pour les deux sites.

## Déploiement sur Render

1. Mets ces 3 fichiers (`server.js`, `package.json`, ce README) dans un dépôt GitHub
2. Sur Render → **New** → **Web Service** → connecte ce dépôt
3. Réglages :
   - **Runtime** : Node
   - **Build Command** : `npm install`
   - **Start Command** : `npm start`
4. Dans **Environment** (variables d'environnement), ajoute :
   - `YABETOO_SECRET_KEY` = ta clé secrète YaBeTooPay (commence par `sk_live_` en production, `sk_test_` en sandbox)
   - `YABETOO_BASE_URL` = `https://pay.api.yabetoopay.com` (production) ou `https://pay.sandbox.yabetoopay.com` (test)
5. Déploie. Render te donne une URL type `https://backend-quiz-xxxx.onrender.com`

## Test

Ouvre `https://ton-backend.onrender.com/` dans le navigateur → tu dois voir `{"status":"ok",...}`

## Branchement côté site

Dans Bolingo et QI Congo, l'appel `fetch` pointe vers :
`https://ton-backend.onrender.com/api/pay`

avec le corps : `{ "product": "bolingo-lien", "phone": "06XXXXXXX", "operator": "mtn" }`

Le montant n'est JAMAIS envoyé par le client — il est fixé côté serveur (sécurité anti-triche).

## Produits gérés
- `bolingo-lien` : 130 FCFA
- `qicongo-resultat` : 133 FCFA
