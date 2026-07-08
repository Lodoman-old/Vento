import { io } from "socket.io-client";

let socket = null;

export function connectSocket(userId) {
  if (socket?.connected) return socket;

  const url = import.meta.env.VITE_API_URL || "/";
  socket = io(url, {
    auth: { userId },
    transports: ["websocket"],
  });

  socket.on("connect", () => console.log("[socket] conectado"));
  socket.on("disconnect", () => console.log("[socket] desconectado"));

  return socket;
}

export function getSocket() {
  return socket;
}

export function joinEvent(eventId) {
  socket?.emit("join:event", eventId);
}

export function leaveEvent(eventId) {
  socket?.emit("leave:event", eventId);
}
