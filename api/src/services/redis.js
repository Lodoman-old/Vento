import Redis from "ioredis";
import { getIO } from "../socket.js";
import { query } from "./db.js";

let subscriber;
let publisher;

export async function setupRedis() {
  const url = process.env.REDIS_URL || "redis://localhost:6379";
  subscriber = new Redis(url);
  publisher = new Redis(url);

  subscriber.on("connect", () => console.log("[redis] conectado"));

  // Reenviar mensajes de Redis a Socket.io local
  subscriber.on("message", (channel, message) => {
    try {
      const { event, room, data } = JSON.parse(message);
      const io = getIO();
      if (!io) return;
      if (room) {
        io.to(room).emit(event, data);
      } else {
        io.emit(event, data);
      }
    } catch {
      console.log(`[redis] ${channel}: ${message}`);
    }
  });

  // Suscribirse a canales de eventos
  subscriber.subscribe("vento:events", (err) => {
    if (err) console.error("[redis] error al suscribirse:", err);
    else console.log("[redis] suscrito a vento:events");
  });
}

export function publishToRedis(event, room, data) {
  if (publisher) {
    publisher.publish("vento:events", JSON.stringify({ event, room, data }));
  }
}

// Escuchar NOTIFY de PostgreSQL y reenviar a Socket.io
export async function listenPgNotify(io) {
  let client;
  async function connect() {
    try {
      if (client) { try { await client.release(); } catch {} }
      client = await (await import("./db.js")).getPool().connect();
      await client.query("LISTEN agenda_channel");
      await client.query("LISTEN supplier_channel");
      console.log("[pg] escuchando canales: agenda_channel, supplier_channel");

      client.on("notification", (msg) => {
        const channel = msg.channel;
        try {
          const payload = JSON.parse(msg.payload);
          const socketEvent = channel === "agenda_channel" ? "agenda:updated" : "supplier:updated";
          if (payload.event_id) {
            io.to(`event:${payload.event_id}`).emit(socketEvent, payload);
          }
        } catch {
          // ignore parse errors
        }
      });

      client.on("error", (err) => {
        console.error("[pg] error en notify client, reconectando:", err.message);
        setTimeout(connect, 3000);
      });

      client.on("end", () => {
        console.log("[pg] notify client disconnected, reconectando en 3s...");
        setTimeout(connect, 3000);
      });
    } catch (err) {
      console.error("[pg] error al conectar notify client, reintentando en 3s:", err.message);
      setTimeout(connect, 3000);
    }
  }
  await connect();
}

export function getSubscriber() {
  return subscriber;
}

export function getPublisher() {
  return publisher;
}
