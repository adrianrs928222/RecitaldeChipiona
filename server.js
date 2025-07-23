import express from "express";
import Stripe from "stripe";
import cors from "cors";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

dotenv.config();
const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
app.use(cors());
app.use(express.json());

// 📩 Configurar transporte de Gmail
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// 📦 Webhook de Stripe para pagos completados
app.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      process.env.STRIPE_WEBHOOK_SECRET,
      stripe.webhooks.DEFAULT_TOLERANCE
    );
  } catch (err) {
    console.error("Webhook error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const email = session.customer_details.email;

    // 📄 Generar entrada en PDF
    const pdfPath = path.join("/tmp", `${Date.now()}_entrada.pdf`);
    const doc = new PDFDocument({ size: "A5", layout: "portrait" });
    doc.pipe(fs.createWriteStream(pdfPath));

    doc.image("img/escudo.png", { fit: [80, 80], align: "center" });
    doc.moveDown(1);
    doc.fontSize(18).text("ENTRADA DIGITAL", { align: "center" });
    doc.moveDown();
    doc.fontSize(16).text("🎶 Recital Flamenco – Chipiona", { align: "center" });
    doc.moveDown();
    doc.fontSize(14).text("📅 6 de agosto – 21:00 h", { align: "center" });
    doc.text("📍 CEIP Maestro Manuel Aparcero", { align: "center" });
    doc.moveDown();
    doc.text(`👤 Comprador: ${email}`, { align: "center" });
    doc.moveDown(1);
    doc.fontSize(12).text("Muestra esta entrada al acceder al evento.", {
      align: "center",
    });
    doc.end();

    // 📨 Enviar correo con entrada PDF
    setTimeout(() => {
      transporter.sendMail({
        from: `"CD Chipiona F.S" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "🎟️ Tu entrada para el Recital Flamenco",
        text: `Gracias por tu compra. Adjuntamos tu entrada en PDF.`,
        attachments: [{ filename: "entrada.pdf", path: pdfPath }],
      }, (error, info) => {
        if (error) console.error("Error enviando correo:", error);
        else console.log("Correo enviado a:", email);
        fs.unlink(pdfPath, () => {}); // Borrar PDF después de enviar
      });
    }, 1000);
  }

  res.status(200).send("Evento recibido");
});

// ✅ Endpoint para crear sesión de pago
app.post("/create-checkout-session", async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [{
        price_data: {
          currency: "eur",
          product_data: {
            name: "Entrada Recital Flamenco – Chipiona",
          },
          unit_amount: 500,
        },
        quantity: 1,
      }],
      customer_email: req.body.email,
      success_url: "https://adrianrs928222.github.io/flamenco/success.html",
      cancel_url: "https://adrianrs928222.github.io/flamenco/cancel.html",
    });

    res.json({ url: session.url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000, () => console.log("Servidor activo en puerto 3000"));