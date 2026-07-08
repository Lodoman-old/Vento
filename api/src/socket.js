import { listenPgNotify } from "./services/redis.js";

let io = null;

export function setupSocketEvents(socketIO) {
  io = socketIO;

  io.on("connection", (socket) => {
    const userId = socket.handshake.auth?.userId;
    console.log(`[socket] conectado: ${userId || "anon"}`);

    socket.on("join:event", (eventId) => {
      socket.join(`event:${eventId}`);
      console.log(`[socket] ${userId} se unió a event:${eventId}`);
    });

    socket.on("leave:event", (eventId) => {
      socket.leave(`event:${eventId}`);
    });

    socket.on("disconnect", () => {
      console.log(`[socket] desconectado: ${userId || "anon"}`);
    });
  });

  // Escuchar NOTIFY de PostgreSQL
  listenPgNotify(io);

  console.log("[socket] Socket.io configurado");
}

export function getIO() {
  return io;
}
