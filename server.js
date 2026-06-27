// ============================================================
//  BACKEND PAIEMENT — Bolingo + QI Congo
//  Passerelle : YaBeTooPay (flux intention en 2 étapes)
//  À déployer sur Render comme "Web Service"
// ============================================================

const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// ------------------------------------------------------------
//  CONFIGURATION — via variables d'environnement sur Render
// ------------------------------------------------------------
// YABETOO_SECRET_KEY : ta clé secrète YaBeTooPay (sk_live_... ou sk_test_...)
// YABETOO_BASE_URL  : https://pay.api.yabetoopay.com (prod) ou https://pay.sandbox.yabetoopay.com (test)
const YABETOO_SECRET_KEY = process.env.YABETOO_SECRET_KEY;
const YABETOO_BASE_URL = process.env.YABETOO_BASE_URL || 'https://pay.sandbox.yabetoopay.com';

// Prix officiels (en FCFA) — côté serveur pour empêcher toute triche depuis le navigateur
const PRIX = {
  'bolingo-lien': 130,
  'qicongo-resultat': 133,
};

// ------------------------------------------------------------
//  Vérification de santé (Render ping cette route)
// ------------------------------------------------------------
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'backend-quiz', time: new Date().toISOString() });
});

// ------------------------------------------------------------
//  PAIEMENT — une seule route pour Bolingo et QI Congo
//  Le frontend envoie : { product, phone, operator }
//  product = 'bolingo-lien' ou 'qicongo-resultat'
// ------------------------------------------------------------
app.post('/api/pay', async (req, res) => {
  try {
    const { product, phone, operator } = req.body;

    // 1) Validation des entrées
    if (!product || !PRIX[product]) {
      return res.status(400).json({ status: 'error', message: 'Produit invalide.' });
    }
    if (!phone || phone.length < 8) {
      return res.status(400).json({ status: 'error', message: 'Numéro de téléphone invalide.' });
    }
    if (!operator || !['mtn', 'airtel'].includes(operator)) {
      return res.status(400).json({ status: 'error', message: 'Opérateur invalide.' });
    }
    if (!YABETOO_SECRET_KEY) {
      return res.status(500).json({ status: 'error', message: 'Clé YaBeTooPay non configurée sur le serveur.' });
    }

    const amount = PRIX[product]; // montant fixé côté serveur, jamais envoyé par le client

    // Format du numéro au format international (+242 pour le Congo)
    let msisdn = phone.replace(/\s+/g, '');
    if (!msisdn.startsWith('+')) {
      // retire un éventuel 0 initial puis préfixe +242
      msisdn = '+242' + msisdn.replace(/^0+/, '');
    }

    // 2) ÉTAPE 1 — Créer l'intention de paiement
    const createResp = await fetch(`${YABETOO_BASE_URL}/v1/payment-intents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${YABETOO_SECRET_KEY}`,
      },
      body: JSON.stringify({
        amount: amount,
        currency: 'xaf',
        description: product === 'bolingo-lien' ? 'Bolingo - lien de quiz' : 'QI Congo - résultat',
        metadata: { product, reference: product.toUpperCase() + '-' + Date.now() },
      }),
    });

    const createData = await createResp.json();

    if (!createResp.ok || !createData.id || !createData.clientSecret) {
      console.error('Erreur création intention:', createData);
      return res.status(502).json({ status: 'error', message: "Impossible de créer le paiement.", details: createData });
    }

    const intentId = createData.id;
    const clientSecret = createData.clientSecret;

    // 3) ÉTAPE 2 — Confirmer l'intention avec le Mobile Money du client
    const confirmResp = await fetch(`${YABETOO_BASE_URL}/v1/payment-intents/${intentId}/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${YABETOO_SECRET_KEY}`,
      },
      body: JSON.stringify({
        client_secret: clientSecret,
        payment_method_data: {
          type: 'momo',
          momo: {
            country: 'cg',
            msisdn: msisdn,
            operator_name: operator,
          },
        },
      }),
    });

    const confirmData = await confirmResp.json();

    // 4) Analyse du résultat
    if (confirmData.status === 'succeeded' && confirmData.captured === true) {
      // Paiement réussi et capturé → on autorise la suite côté client
      return res.json({
        status: 'success',
        transactionId: confirmData.transactionId || confirmData.id,
        amount: confirmData.amount,
      });
    } else {
      // Paiement échoué (timeout, fonds insuffisants, etc.)
      return res.json({
        status: 'failed',
        reason: confirmData.failureMessage || confirmData.status || 'Paiement non abouti',
      });
    }
  } catch (err) {
    console.error('Erreur serveur paiement:', err);
    return res.status(500).json({ status: 'error', message: 'Erreur serveur. Réessayez.' });
  }
});

// ------------------------------------------------------------
//  Démarrage
// ------------------------------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend quiz en écoute sur le port ${PORT}`);
  console.log(`YaBeTooPay base URL: ${YABETOO_BASE_URL}`);
});
