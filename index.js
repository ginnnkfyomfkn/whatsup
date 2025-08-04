const express = require('express');
const { makeWASocket, useMultiFileAuthState, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
const chalk = require('chalk');
const pino = require('pino');
const fs = require('fs').promises;
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static('public')); // Serve static files

let MznKing = null;

const connect = async (phoneNumber) => {
  const { state, saveCreds } = await useMultiFileAuthState('/opt/render/project/src/session');
  MznKing = makeWASocket({
    logger: pino({ level: 'silent' }),
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'fatal' })),
    },
    markOnlineOnConnect: true,
  });

  if (!MznKing.authState.creds.registered) {
    phoneNumber = phoneNumber.replace(/[^0-9]/g, '');
    if (!phoneNumber.startsWith('91')) {
      throw new Error('Phone number must start with country code, e.g., +91');
    }
    let code = await MznKing.requestPairingCode(phoneNumber);
    code = code?.match(/.{1,4}/g)?.join('-') || code;
    return { status: 'pairing', code };
  }

  MznKing.ev.on('connection.update', async (s) => {
    const { connection } = s;
    if (connection === 'open') {
      console.log(chalk.yellow('Your WhatsApp Login Successfully'));
    }
  });

  MznKing.ev.on('creds.update', saveCreds);
  return { status: 'connected' };
};

// API Endpoint for connection
app.post('/connect', async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    const result = await connect(phoneNumber);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check (optional for Render)
app.get('/health', (req, res) => {
  res.json({ status: MznKing ? 'connected' : 'disconnected' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
