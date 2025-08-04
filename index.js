const express = require("express");
const fs = require("fs");
const qrcode = require("qrcode");
const { default: makeWASocket, useMultiFileAuthState } = require("@whiskeysockets/baileys");

const app = express();
const port = process.env.PORT || 3000;

app.use(express.static("public"));

// Ensure 'public' directory exists
if (!fs.existsSync("public")) {
  fs.mkdirSync("public");
}

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/pair.html");
});

let sock;

const startSock = async () => {
  const { state, saveCreds } = await useMultiFileAuthState("auth");
  sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
  });

  sock.ev.on("connection.update", async (update) => {
    const { connection, qr, lastDisconnect } = update;

    if (qr) {
      const qrImage = await qrcode.toDataURL(qr);
      fs.writeFileSync("public/qr.html", `<img src="${qrImage}" style="width:300px; height:300px;">`);
    }

    if (connection === "close") {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;
      console.log("Connection closed. Reconnecting...", shouldReconnect);
      if (shouldReconnect) startSock();
    } else if (connection === "open") {
      console.log("✅ Paired and connected to WhatsApp.");
    }
  });

  sock.ev.on("creds.update", saveCreds);
};

startSock();

app.listen(port, () => {
  console.log(`🌐 Server running at http://localhost:${port}`);
});
