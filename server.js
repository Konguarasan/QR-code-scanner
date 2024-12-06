require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const app = express();


app.use(bodyParser.json());

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
    debug: true,
    logger: true,
});

// Temporary in-memory storage (replace with a database in production)
const candidateData = {};

// Webhook to handle form submission
app.post('/webhook', async (req, res) => {
    try {
        const { email, phoneNumber, name, password } = req.body;

        if (!email || !phoneNumber || !name || !password) {
            return res.status(400).send('Missing required fields: email, phoneNumber, name, and/or password');
        }

        const uniqueId = `CAND-${Date.now()}`;
        const candidateDetails = { uniqueId, name, email, phoneNumber, password };

        // Save candidate details to in-memory store (use DB in production)
        candidateData[uniqueId] = candidateDetails;

        // Generate QR code with link to candidate details
        const qrCodePath = path.join(__dirname, `qr-code-${uniqueId}.png`);
        const candidateUrl = `${process.env.BASE_URL}/candidate/${uniqueId}`;
        await QRCode.toFile(qrCodePath, candidateUrl);

        // Email HTML content
        const emailHtmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>QR Code</title>
        </head>
        <body>
            <center><h3>Your Unique QR Code</h3></center>
            <p>Your Unique ID: <strong>${uniqueId}</strong></p>
            <p>Scan the QR code to view your details.</p>
        </body>
        </html>`;

        // Send email with QR code attachment
        await transporter.sendMail({
            from: process.env.SMTP_USER,
            to: email,
            subject: 'Your Unique ID and QR Code',
            html: emailHtmlContent,
            attachments: [
                {
                    filename: `qr-code-${uniqueId}.png`,
                    path: qrCodePath,
                },
            ],
        });

        // Clean up QR code file
        fs.unlinkSync(qrCodePath);

        res.status(200).send('Mail sent successfully!');
    } catch (error) {
        console.error('Error processing webhook:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Route to display candidate details
app.get('/candidate/:id', (req, res) => {
    const uniqueId = req.params.id;
    const candidate = candidateData[uniqueId];

    if (!candidate) {
        return res.status(404).send('Candidate not found');
    }

    // Render candidate details as a non-editable HTML page
    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Candidate Details</title>
    </head>
    <body>
        <h2>Candidate Details</h2>
        <p><strong>Unique ID:</strong> ${candidate.uniqueId}</p>
        <p><strong>Name:</strong> ${candidate.name}</p>
        <p><strong>Email:</strong> ${candidate.email}</p>
        <p><strong>Phone Number:</strong> ${candidate.phoneNumber}</p>
    </body>
    </html>`;
    res.send(htmlContent);
});

// Start the server
const PORT = 9001;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
