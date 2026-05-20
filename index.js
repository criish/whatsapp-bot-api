// index.js
// WhatsApp connection using Baileys and expose REST API via Express
// Requires: @adiwajshing/baileys, express, qrcode, dotenv, fs

require('dotenv').config();
const express = require('express');
const { default: makeWASocket, useSingleFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@adiwajshing/baileys');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const SESSION_FILE = process.env.SESSION_FILE || './auth_info.json';

// Auth state persisted to single file
const { state, saveState } = useSingleFileAuthState(SESSION_FILE);

let sock; // Will hold the WA socket instance
let isReady = false;

async function startWhatsApp() {
  const { version } = await fetchLatestBaileysVersion();
  sock = makeWASocket({
    version,
    printQRInTerminal: false,
    auth: state,
  });

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      // Generate QR code as data URL and store globally for API
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
      global.qrCodeDataURL = null; // QR no longer needed
    }
  });

  sock.ev.on('creds.update', saveState);

  // Simple message logger
  sock.ev.on('messages.upsert', ({ messages, type }) => {
    if (type === 'notify') {
      const msg = messages[0];
      console.log('📩 New message from', msg.key.remoteJid, ':', msg.message?.conversation ?? '(non-text)');
    }
  });
}

// API endpoints
app.get('/status', (req, res) => {
  res.json({
    connected: isReady,
    qrCode: global.qrCodeDataURL || null,
  });
});

app.post('/send', async (req, res) => {
  if (!isReady) return res.status(503).json({ error: 'WhatsApp not connected' });
  const { to, message } = req.body;
  if (!to || !message) return res.status(400).json({ error: '`to` and `message` required' });
  try {
    await sock.sendMessage(to, { text: message });
    res.json({ success: true });
  } catch (err) {
    console.error('❌ Failed to send message', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/qr', (req, res) => {
  if (global.qrCodeDataURL) {
    // Return the QR as PNG image
    const img = Buffer.from(global.qrCodeDataURL.split(',')[1], 'base64');
    res.type('png').send(img);
  } else {
    res.status(404).json({ error: 'QR code not available' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server listening on http://localhost:${PORT}`);
});

startWhatsApp().catch(err => console.error('Failed to start WhatsApp', err));
