import express from "express"; import Stripe from "stripe"; import cors from "cors"; import bodyParser from "body-parser"; import dotenv from "dotenv"; import nodemailer from "nodemailer"; import fs from "fs"; import path from "path"; import pdf from "html-pdf"; import { fileURLToPath } from "url"; import { dirname } from "path";

// Configuración inicial const __filename = fileURLToPath(import.meta.url); const __dirname = dirname(__filename); dotenv.config(); const app = express(); const PORT = process.env.PORT || 3000; const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// CORS solo permite tu GitHub Pages const allowedOrigins = ["https://adrianrs928222.github.io"]; app.use(cors({ origin: allowedOrigins, methods: ["GET", "POST"] }));

app.use(express.json()); app.use(bodyParser.urlencoded({ extended: true }));

// Checkout con Stripe app.post("/create-checkout-session", async (req, res) => { try { const session = await stripe.checkout.sessions.create({ payment_method_types: ["card"], line_items: [ { price_data: { currency: "eur", product_data: { name: "Entrada Recital Flamenco – Chipiona", }, unit_amount: 100, // 1 euro en céntimos }, quantity: 1, }, ], mode: "payment", success_url: ${process.env.DOMAIN}/success, cancel_url: ${process.env.DOMAIN}/cancel, }); res.json({ url: session.url }); } catch (err) { console.error("Error creando sesión de Stripe:", err); res.status(500).json({ error: "Fallo al crear sesión" }); } });

// Ruta de éxito app.get("/success", (req, res) => { res.send("<h1>✅ ¡Pago exitoso! Te hemos enviado tu entrada al correo.</h1>"); });

// Ruta cancelada app.get("/cancel", (req, res) => { res.send("<h1>❌ Pago cancelado. Vuelve cuando quieras.</h1>"); });

// Webhook Stripe app.post("/webhook", express.raw({ type: "application/json" }), (req, res) => { const sig = req.headers["stripe-signature"]; let event;

try { event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET); } catch (err) { console.error("Webhook signature error:", err.message); return res.status(400).send(Webhook Error: ${err.message}); }

if (event.type === "checkout.session.completed") { const session = event.data.object; const email = session.customer_details.email; sendTicketEmail(email); }

res.status(200).json({ received: true }); });

// Función para enviar entrada PDF function sendTicketEmail(email) { const html = <div style="text-align:center; font-family:sans-serif"> <img src="https://i.imgur.com/MVf0qVW.png" alt="Escudo" width="100"/> <h2>🎶 Recital Flamenco – Chipiona</h2> <p><strong>Fecha:</strong> 6 de agosto · 21:00h</p> <p><strong>Lugar:</strong> CEIP Maestro Manuel Aparcero</p> <p><strong>Precio:</strong> 1€</p> <p><strong>Gracias por tu compra 🎟️</strong></p> </div>;

const pdfPath = path.join(__dirname, "entrada.pdf"); pdf.create(html).toFile(pdfPath, (err, resPdf) => { if (err) return console.error("Error al crear PDF:", err);

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const mailOptions = {
  from: `Recital Flamenco <${process.env.EMAIL_USER}>`,
  to: email,
  subject: "🎫 Tu entrada para el Recital Flamenco – Chipiona",
  text: "Gracias por tu compra. Aquí tienes tu entrada en PDF.",
  attachments: [
    {
      filename: "entrada.pdf",
      path: pdfPath,
    },
  ],
};

transporter.sendMail(mailOptions, (error, info) => {
  if (error) return console.error("Error enviando email:", error);
  console.log("✅ Entrada enviada a:", email);
});

}); }

// Middleware para permitir webhook app.use((err, req, res, next) => { if (err instanceof SyntaxError && err.status === 400 && 'body' in err) { return res.status(400).send({ message: "Invalid JSON" }); } next(); });

app.listen(PORT, () => console.log(🔥 Servidor activo en http://localhost:${PORT}));

