import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import { connectDb } from "./services/db.js";
import { setupRedis } from "./services/redis.js";
import { setupSocketEvents } from "./socket.js";
import authRoutes from "./routes/auth.js";
import eventRoutes from "./routes/events.js";
import agendaRoutes from "./routes/agenda.js";
import supplierRoutes from "./routes/suppliers.js";
import supplierCatalogRoutes from "./routes/supplierCatalog.js";
import catalogRoutes from "./routes/catalog.js";
import quoteRoutes from "./routes/quotes.js";
import settingsRoutes from "./routes/settings.js";
import uploadRoutes from "./routes/upload.js";
import notificationRoutes from "./routes/notifications.js";
import userRoutes from "./routes/users.js";
import checklistRoutes from "./routes/checklist.js";
import paymentRoutes from "./routes/payments.js";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: process.env.CORS_ORIGIN || "*" },
});

app.use(cors());
app.use(express.json());
// app.use("/uploads", express.static("uploads")); // removido — ahora se usa Cloudinary

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/agenda", agendaRoutes);
app.use("/api/supplier-catalog", supplierCatalogRoutes);
app.use("/api/event-suppliers", supplierRoutes);
app.use("/api/catalog", catalogRoutes);
app.use("/api/quotes", quoteRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/users", userRoutes);
app.use("/api/checklist", checklistRoutes);
app.use("/api/payments", paymentRoutes);

// Socket.io
setupSocketEvents(io);

const PORT = process.env.PORT || 4000;

async function start() {
  await connectDb();
  await setupRedis();
  httpServer.listen(PORT, () => {
    console.log(`[vento-api] corriendo en http://localhost:${PORT}`);
  });
}

start();
