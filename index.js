const express = require("express");
const { makeWASocket, useMultiFileAuthState } = require("@whiskeysockets/baileys");
const pino = require("pino");
const PhoneNumber = require("awesome-phonenumber");
const chalk = require("chalk");
const path = require("path");

const app = express();
const port = process.env.PORT || 3000;

// Serve static files and parse form data
app.use(express.static(path.join(__dirname, "views")));
app.use(express.urlencoded({ extended: true }));

// Home page
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "views", "index.html"));
});

// Handle pairing code request
app.post("/generate-pairing-code", async (req, res) => {
    let phoneNumber = req.body.phoneNumber?.replace(/[^0-9]/g, "");
    if (!phoneNumber) {
        return res.render("result", { error: "Please enter a phone number." });
    }

    // Validate phone number using awesome-phonenumber
    if (!PhoneNumber("+" + phoneNumber).isValid()) {
        return res.render("result", {
            error: "Invalid phone number. Use international format (e.g., 6281376552730).",
        });
    }

    // Initialize Baileys
    const { state } = await useMultiFileAuthState("./session");
    const sock = makeWASocket({
        logger: pino({ level: "silent" }),
        printQRInTerminal: false,
        auth: state,
    });

    try {
        let code = await sock.requestPairingCode(phoneNumber);
        code = code?.match(/.{1,4}/g)?.join("-") || code;
        console.log(chalk.black(chalk.bgGreen(`Your Pairing Code: `)), chalk.black(chalk.white(code)));
        res.render("result", {
            code: code,
            instructions: `
                Please enter this code in your WhatsApp app:
                1. Open WhatsApp
                2. Go to Settings > Linked Devices
                3. Tap "Link a Device"
                4. Enter the code: ${code}
            `,
        });
    } catch (error) {
        console.error("Error requesting pairing code:", error);
        res.render("result", { error: "Failed to generate pairing code. Please try again." });
    }
});

app.listen(port, () => {
    console.log(chalk.green(`Server running on port ${port}`));
});
