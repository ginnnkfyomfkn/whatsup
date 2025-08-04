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
      console.log(`Requesting pairing code for ${phoneNumber}...`);
      let code = await MznKing.requestPairingCode(phoneNumber);
      console.log(`Raw code received: ${code}`);
      code = code?.match(/.{1,4}/g)?.join('-') || code;
      console.log(`Formatted code: ${code}`);
      if (!code) throw new Error('Failed to generate pairing code');
      MznKing.ev.on('creds.update', saveCreds);
      return res.json({ status: 'pairing', code });
    }

    MznKing.ev.on('connection.update', async (s) => {
      const { connection } = s;
      if (connection === 'open') {
        console.log(chalk.yellow('Your WhatsApp Login Successfully'));
      }
    });
    MznKing.ev.on('creds.update', saveCreds);
    res.json({ status: 'connected' });
  } catch (error) {
    console.error(`Connection error: ${error.message}`, error.stack);
    res.status(500).json({ error: error.message });
  }
});
