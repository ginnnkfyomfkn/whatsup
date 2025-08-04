const qrcode = require('qrcode');

app.post('/connect', async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    console.log(`Attempting to connect with phone number: ${phoneNumber}`);
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
      console.log(`Waiting for QR code...`);
      MznKing.ev.on('connection.update', async (update) => {
        const { qr } = update;
        if (qr) {
          const qrImage = await qrcode.toDataURL(qr);
          res.json({ status: 'pairing', qr: qrImage });
        }
      });
      MznKing.ev.on('creds.update', saveCreds);
    } else {
      MznKing.ev.on('connection.update', async (s) => {
        const { connection } = s;
        if (connection === 'open') {
          console.log(chalk.yellow('Your WhatsApp Login Successfully'));
        }
      });
      res.json({ status: 'connected' });
    }
  } catch (error) {
    console.error(`Connection error: ${error.message}`, error.stack);
    res.status(500).json({ error: error.message });
  }
});
