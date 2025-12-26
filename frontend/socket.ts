import { io, type Socket } from "socket.io-client";

const DEFAULT_SOCKET_URL = "http://localhost:3001";

function getSocketUrl() {
  const envUrl = (import.meta as any).env?.VITE_SOCKET_URL as string | undefined;
  return (envUrl && envUrl.trim()) || DEFAULT_SOCKET_URL;
}

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(getSocketUrl(), {
      transports: ["websocket"],
      autoConnect: true
    });
  }
  return socket;
}
