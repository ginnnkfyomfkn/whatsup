const express = require('express');
const fileUpload = require('express-fileupload');
const { makeWASocket, useMultiFileAuthState, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
const chalk = require('chalk');
const pino = require('pino');
const fs = require('fs').promises;
const path = require('path');

const app = express();
app.use(express.json());
app.use(fileUpload());
app.use(express.static('public')); // Serve static files (HTML, JS, CSS)

let MznKing = null; // WhatsApp client instance
let messages = []; // Store messages
let sendMessageInterval = null; // Store interval for message sending

// Connect to WhatsApp
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

  // Handle pairing code
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
    const { connection, lastDisconnect } = s;
    if (connection === 'open') {
      console.log(chalk.yellow('WhatsApp Connected Successfully'));
    }
    if (connection === 'close' && lastDisconnect?.error?.output?.statusCode !== 401) {
      setTimeout(() => connect(phoneNumber), 5000);
    }
  });

  MznKing.ev.on('creds.update', saveCreds);
  return { status: 'connected' };
};

// Read messages from files
const readMessagesFromFiles = async (filePaths) => {
  let messages = [];
  for (const filePath of filePaths) {
    try {
      const data = await fs.readFile(path.join(__dirname, 'uploads', filePath), 'utf-8');
      messages = messages.concat(data.split('\n').filter(line => line.trim() !== ''));
    } catch (err) {
      console.error(`Error reading file ${filePath}:`, err);
    }
  }
  return messages;
};

// Send messages
const sendMessageInfinite = async (target, targetName, intervalTime, filePaths) => {
  messages = await readMessagesFromFiles(filePaths);
  if (messages.length === 0) throw new Error('No messages found');

  let currentIndex = 0;
  const colors = [chalk.green, chalk.yellow, chalk.white];
  let colorIndex = 0;

  if (sendMessageInterval) clearInterval(sendMessageInterval); // Clear previous interval

  sendMessageInterval = setInterval(async () => {
    try {
      const rawMessage = messages[currentIndex];
      const time = new Date().toLocaleTimeString();
      const simpleMessage = `${targetName} ${rawMessage}`;
      const formattedMessage = `
=======================================
Time ==> ${time}
Target name ==> ${targetName}
Target No ==> ${target}
Message ==> ${rawMessage}
=======================================
      `;
      if (/^\d+$/.test(target)) {
        await MznKing.sendMessage(target + '@s.whatsapp.net', { text: simpleMessage });
      } else {
        await MznKing.sendMessage(target, { text: simpleMessage });
      }
      console.log(colors[colorIndex](`Message sent:\n${formattedMessage}`));
      colorIndex = (colorIndex + 1) % colors.length;
      currentIndex = (currentIndex + 1) % messages.length;
    } catch (error) {
      console.error(`Error sending message: ${error}`);
    }
  }, intervalTime * 1000);
};

// API Endpoints
app.post('/connect', async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    const result = await connect(phoneNumber);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/send-messages', async (req, res) => {
  try {
    const { target, targetName, intervalTime, fileNames } = req.body;
    if (!MznKing) throw new Error('WhatsApp not connected');
    await sendMessageInfinite(target, targetName, parseInt(intervalTime), fileNames);
    res.json({ status: 'started' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/upload', async (req, res) => {
  try {
    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }
    const file = req.files.file;
    const uploadPath = path.join(__dirname, 'uploads', file.name);
    await file.mv(uploadPath);
    res.json({ status: 'uploaded', fileName: file.name });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
