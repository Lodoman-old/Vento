import { createContext, useContext, useState, useEffect } from "react";
import { api } from "../lib/api";
import { requestFcmToken, listenForegroundMessages } from "../lib/fcm";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("user");
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) localStorage.setItem("user", JSON.stringify(user));
    else localStorage.removeItem("user");
  }, [user]);

  // Register FCM token and listen for foreground messages when logged in
  useEffect(() => {
    if (!user) return;

    let unsubscribe = () => {};

    (async () => {
      await requestFcmToken();

      unsubscribe = listenForegroundMessages((payload) => {
        const title = payload.notification?.title || "Vento";
        const body = payload.notification?.body || "";
        if (Notification.permission === "granted") {
          new Notification(title, { body, icon: "/vento-icon.svg" });
        }
      });
    })();

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [user]);

  async function login(email, password) {
    setLoading(true);
    try {
      const data = await api.post("/auth/login", { email, password });
      localStorage.setItem("token", data.token);
      setUser(data.user);
      return data.user;
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
