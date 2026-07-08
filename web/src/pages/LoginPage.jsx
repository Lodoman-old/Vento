import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import Logo from "../components/Logo";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState(() => localStorage.getItem("rememberedEmail") || "");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(() => !!localStorage.getItem("rememberedEmail"));
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);

  function validate() {
    const errors = {};
    if (!email.trim()) errors.email = "El email/usuario es obligatorio";
    if (!password) errors.password = "La contraseña es obligatoria";
    else if (password.length < 6) errors.password = "Mínimo 6 caracteres";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!validate()) return;

    setLoading(true);
    try {
      if (remember) localStorage.setItem("rememberedEmail", email);
      else localStorage.removeItem("rememberedEmail");
      const user = await login(email, password);
      navigate(user.role === "cliente" ? "/portal" : "/", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-vento-navy flex items-center justify-center p-4 animate-fade-in">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8 animate-slide-down">
          <Logo size={48} showText={true} />
          <p className="text-white/50 text-sm mt-2">Eventos en perfecta sincronía.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 animate-slide-up">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg p-3 flex items-center gap-2 animate-shake">
              <span>⚠</span> {error}
            </div>
          )}

          <div>
            <label className="text-sm text-white/60 block mb-1">Email o usuario</label>
            <div className="relative">
              <input
                type="text"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setFieldErrors((prev) => ({ ...prev, email: "" })); }}
                className={`w-full pl-3 pr-10 py-2.5 rounded-lg bg-white/5 border text-white placeholder-white/30 focus:outline-none focus:border-vento-cyan transition-colors ${
                  fieldErrors.email ? "border-red-400" : "border-white/10"
                }`}
                placeholder="Usuario o email"
                autoFocus
              />
              {email && !fieldErrors.email && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-green-400 text-sm">✓</span>
              )}
            </div>
            {fieldErrors.email && (
              <p className="text-red-400 text-xs mt-1 animate-fade-in">{fieldErrors.email}</p>
            )}
          </div>

          <div>
            <label className="text-sm text-white/60 block mb-1">Contraseña</label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setFieldErrors((prev) => ({ ...prev, password: "" })); }}
                className={`w-full pl-3 pr-10 py-2.5 rounded-lg bg-white/5 border text-white placeholder-white/30 focus:outline-none focus:border-vento-cyan transition-colors ${
                  fieldErrors.password ? "border-red-400" : "border-white/10"
                }`}
                placeholder="••••••••"
              />
              {password && password.length >= 6 && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-green-400 text-sm">✓</span>
              )}
            </div>
            {fieldErrors.password && (
              <p className="text-red-400 text-xs mt-1 animate-fade-in">{fieldErrors.password}</p>
            )}
          </div>

          <label className="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="w-4 h-4 rounded border-white/20 bg-white/5 checked:bg-vento-cyan checked:border-vento-cyan focus:ring-vento-cyan focus:ring-offset-0"
            />
            <span className="text-sm text-white/50 group-hover:text-white/70 transition-colors">Recordar email</span>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-vento-cyan text-vento-navy font-semibold hover:bg-cyan-400 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Entrando...
              </>
            ) : "Entrar"}
          </button>
        </form>

        <p className="text-center text-xs text-white/30 mt-6">
          Vento v1.0 — {new Date().getFullYear()}
        </p>
      </div>

      <style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slide-down { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slide-up { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
        .animate-fade-in { animation: fade-in 0.3s ease-out; }
        .animate-slide-down { animation: slide-down 0.5s ease-out; }
        .animate-slide-up { animation: slide-up 0.5s ease-out 0.2s both; }
        .animate-shake { animation: shake 0.3s ease-in-out; }
      `}</style>
    </div>
  );
}
