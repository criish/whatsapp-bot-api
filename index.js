require('dotenv').config();
const express = require('express');
const { default: makeWASocket, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const { MongoClient } = require('mongodb');
const { useMongoAuthState } = require('./mongo-auth-state');
const QRCode = require('qrcode');
const https = require('https');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY;
const MONGODB_URI = process.env.MONGODB_URI;

let sock;
let isReady = false;
let lastError = null;
let initStep = 'starting';

async function startWhatsApp() {
  try {
    initStep = 'fetching version';
    console.log('[init] Fetching Baileys version...');
    const { version } = await fetchLatestBaileysVersion();

    initStep = 'connecting MongoDB';
    console.log('[init] Connecting to MongoDB...');
    const mongoClient = new MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      tls: true,
      tlsInsecure: true,
    });
    await mongoClient.connect();
    console.log('[init] MongoDB connected');

    initStep = 'loading auth state';
    console.log('[init] Loading auth state...');
    const { state, saveCreds } = await useMongoAuthState(mongoClient);

    initStep = 'creating socket';
    console.log('[init] Creating WhatsApp socket...');
    sock = makeWASocket({
      version,
      printQRInTerminal: false,
      auth: state,
    });

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      if (qr) {
        console.log('[init] QR code received');
        const qrDataURL = await QRCode.toDataURL(qr);
        global.qrCodeDataURL = qrDataURL;
      }
      if (connection === 'close') {
        const shouldReconnect = (lastDisconnect?.error?.output?.statusCode ?? DisconnectReason.disconnect) !== DisconnectReason.loggedOut;
        console.log('Connection closed due to', lastDisconnect?.error, ', reconnecting:', shouldReconnect);
        isReady = false;
        if (shouldReconnect) startWhatsApp();
      } else if (connection === 'open') {
        console.log('✅ WhatsApp connection opened');
        isReady = true;
        global.qrCodeDataURL = null;
      }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', ({ messages, type }) => {
      if (type === 'notify') {
        const msg = messages[0];
        console.log('📩 New message from', msg.key.remoteJid, ':', msg.message?.conversation ?? '(non-text)');
      }
    });

    initStep = 'ready';
    console.log('[init] WhatsApp initialization complete');
  } catch (err) {
    lastError = err.message;
    console.error('[init] FAILED at step:', initStep, err);
  }
}

// Auth middleware
function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!API_KEY) return next();
  if (!header || !header.startsWith('Bearer ') || header.slice(7) !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized — invalid or missing API Key' });
  }
  next();
}

// API endpoints
app.get('/ping', (req, res) => res.send('pong'));

app.get('/debug', (req, res) => {
  res.json({
    whatsappConnected: isReady,
    hasQrCode: !!global.qrCodeDataURL,
    hasMongoUri: !!MONGODB_URI,
    mongodbUriPrefix: MONGODB_URI ? MONGODB_URI.slice(0, 25) + '...' : null,
    initStep,
    lastError,
  });
});

app.get('/status', requireAuth, (req, res) => {
  res.json({
    connected: isReady,
    qrCode: global.qrCodeDataURL || null,
  });
});

app.post('/send', requireAuth, async (req, res) => {
  if (!isReady) return res.status(503).json({ error: 'WhatsApp not connected' });
  let { to, message, image, audio, video, document: doc } = req.body;
  if (!to) return res.status(400).json({ error: '`to` is required' });
  if (!to.includes('@')) to = to.replace(/\D/g, '') + '@s.whatsapp.net';

  try {
    let content;
    if (image) {
      content = { image: image.url ? { url: image.url } : image, caption: image.caption || '' };
    } else if (audio) {
      content = { audio: audio.url ? { url: audio.url } : audio, mimetype: audio.mimetype || 'audio/mp4' };
    } else if (video) {
      content = { video: video.url ? { url: video.url } : video, caption: video.caption || '' };
    } else if (doc) {
      content = { document: doc.url ? { url: doc.url } : doc, fileName: doc.filename || 'file', mimetype: doc.mimetype || 'application/octet-stream' };
    } else {
      if (!message) return res.status(400).json({ error: '`message` or media (image/audio/video/document) is required' });
      content = { text: message };
    }

    await sock.sendMessage(to, content);
    res.json({ success: true });
  } catch (err) {
    console.error('❌ Failed to send message', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/qr', (req, res) => {
  if (global.qrCodeDataURL) {
    const img = Buffer.from(global.qrCodeDataURL.split(',')[1], 'base64');
    res.type('png').send(img);
  } else if (lastError) {
    res.status(503).json({ error: 'WhatsApp failed to start', details: lastError });
  } else if (isReady) {
    res.status(400).json({ error: 'WhatsApp already connected — no QR needed' });
  } else {
    res.status(404).json({ error: 'QR code not available yet', hint: 'Check /debug for connection status' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server listening on http://localhost:${PORT}`);
});

// Self-ping every 10 minutes to help prevent Render standby
setInterval(() => {
  https.get('https://whatsapp-bot-api-hnmk.onrender.com/ping', (res) => {
    console.log(`[keep-alive] Self-ping status: ${res.statusCode}`);
  }).on('error', (err) => {
    console.error('[keep-alive] Self-ping failed:', err.message);
  });
}, 10 * 60 * 1000);

startWhatsApp();
