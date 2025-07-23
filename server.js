import express from 'express';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';

dotenv.config();

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// 👉 Solo para el webhook usa express.raw
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('❌ Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const customerEmail = session.customer_details.email;

    const html = `
      <html>
        <head>
          <style>
            body { font-family: Arial; padding: 40px; text-align: center; }
            .title { font-size: 24px; font-weight: bold; }
            .info { margin-top: 20px; font-size: 18px; }
            img { margin-top: 20px; width: 150px; }
          </style>
        </head>
        <body>
          <div class="title">🎫 Entrada Recital Flamenco</div>
          <div class="info">Gracias por tu compra, ${customerEmail}.</div>
          <div class="info">📅 Fecha: 6 de agosto a las 21:00h</div>
          <div class="info">📍 Lugar: Chipiona</div>
          <img src="https://adrianrs928222.github.io/RecitaldeChipiona/logo.png" />
        </body>
      </html>
    `;

    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setContent(html);
    const pdfBuffer = await page.pdf({ format: 'A4' });
    await browser.close();

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_FROM,
        pass: process.env.EMAIL_PASS
      }
    });

    const mailOptions = {
      from: `"Recital Flamenco" <${process.env.EMAIL_FROM}>`,
      to: customerEmail,
      subject: '🎟️ Entrada para el Recital Flamenco',
      text: 'Gracias por tu compra. Adjuntamos tu entrada en PDF.',
      attachments: [{
        filename: 'entrada.pdf',
        content: pdfBuffer
      }]
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('❌ Error al enviar correo:', error);
      } else {
        console.log('✅ Entrada enviada:', info.response);
      }
    });
  }

  res.status(200).send('Evento recibido');
});

// 👉 JSON parser para el resto de rutas
app.use(express.json());

app.post('/create-checkout-session', async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: {
            name: 'Entrada Recital Flamenco'
          },
          unit_amount: 500 // 5€
        },
        quantity: 1
      }],
      success_url: 'https://adrianrs928222.github.io/RecitaldeChipiona/success.html',
      cancel_url: 'https://adrianrs928222.github.io/RecitaldeChipiona/cancel.html'
    });

    res.json({ id: session.id });
  } catch (err) {
    console.error('❌ Error creando sesión de pago:', err);
    res.status(500).json({ error: 'Error al crear sesión' });
  }
});

app.get('/', (req, res) => {
  res.send('Servidor activo para entradas 🎫');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🔥 Servidor activo en puerto ${PORT}`));