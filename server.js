// ✅ server.js completo con PDFKit, Nodemailer y Stripe Webhook

import express from 'express'; import Stripe from 'stripe'; import cors from 'cors'; import dotenv from 'dotenv'; import bodyParser from 'body-parser'; import PDFDocument from 'pdfkit'; import nodemailer from 'nodemailer'; import fs from 'fs';

dotenv.config();

const app = express(); const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

app.use(cors({ origin: 'https://adrianrs928222.github.io', credentials: true })); app.use(bodyParser.json()); app.use(bodyParser.urlencoded({ extended: true }));

// ✅ Página de éxito app.get('/success', (req, res) => { res.send(<html> <head> <title>¡Compra exitosa!</title> <style> body { font-family: sans-serif; text-align: center; padding: 40px; background: #f0fff0; } h1 { color: green; } </style> </head> <body> <h1>✅ ¡Gracias por tu compra!</h1> <p>Tu entrada ha sido enviada por correo.</p> </body> </html>); });

// ✅ Página de cancelación app.get('/cancel', (req, res) => { res.send(<html> <head> <title>Pago cancelado</title> <style> body { font-family: sans-serif; text-align: center; padding: 40px; background: #fff0f0; } h1 { color: red; } </style> </head> <body> <h1>❌ El pago ha sido cancelado</h1> <p>No te preocupes, puedes volver a intentarlo cuando quieras.</p> </body> </html>); });

// ✅ Crear sesión de pago app.post('/create-checkout-session', async (req, res) => { try { const session = await stripe.checkout.sessions.create({ payment_method_types: ['card'], mode: 'payment', line_items: [ { price_data: { currency: 'eur', product_data: { name: 'Entrada Recital Flamenco', }, unit_amount: 100, // 1€ }, quantity: 1, }, ], success_url: 'https://recitaldechipiona.onrender.com/success', cancel_url: 'https://recitaldechipiona.onrender.com/cancel', }); res.json({ url: session.url }); } catch (error) { res.status(500).json({ error: error.message }); } });

// ✅ Webhook para enviar PDF app.post('/webhook', bodyParser.raw({ type: 'application/json' }), async (req, res) => { const sig = req.headers['stripe-signature']; let event;

try { event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET); } catch (err) { return res.status(400).send(Webhook Error: ${err.message}); }

if (event.type === 'checkout.session.completed') { const session = event.data.object;

// 🔒 Correo real del cliente (solo si usas collect_email=true)
const customerEmail = session.customer_details?.email || 'demo@demo.com';

// 🔧 Crear PDF
const doc = new PDFDocument();
const pdfPath = `entrada-${Date.now()}.pdf`;
const stream = fs.createWriteStream(pdfPath);
doc.pipe(stream);
doc.fontSize(20).text('🎶 Recital Flamenco – Chipiona', { align: 'center' });
doc.moveDown();
doc.text('📍 CEIP Maestro Manuel Aparcero');
doc.text('🗓️ 6 de agosto · 21:00 h');
doc.text('🎟️ Entrada: 1 €');
doc.moveDown();
doc.text('Gracias por tu compra ❤️');
doc.end();

stream.on('finish', async () => {
  // Enviar email con PDF
  let transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  await transporter.sendMail({
    from: `Recital Flamenco <${process.env.EMAIL_USER}>`,
    to: customerEmail,
    subject: '🎟️ Tu entrada para el Recital Flamenco',
    text: 'Adjuntamos tu entrada en PDF. ¡Nos vemos en el evento!',
    attachments: [
      {
        filename: 'entrada.pdf',
        path: pdfPath,
      },
    ],
  });

  fs.unlinkSync(pdfPath); // 🧹 Borra el archivo después de enviarlo
});

}

res.status(200).json({ received: true }); });

const PORT = process.env.PORT || 3000; app.listen(PORT, () => console.log(✅ Servidor funcionando en puerto ${PORT}));

