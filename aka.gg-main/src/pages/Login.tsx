// src/pages/Login.tsx — ATAK.GG sign-in (brand glass, Riot + Google, visible CTA)
import { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { Loader2, Swords } from "lucide-react";
import { useAuth } from "@/features/auth/useAuth";

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});
type LoginFormData = z.infer<typeof loginSchema>;

const API_BASE = (import.meta.env.VITE_API_URL ?? "http://localhost:4000").replace(/\/$/, "");

// OAuth redirect errors → friendly Spanish copy
const OAUTH_ERRORS: Record<string, string> = {
  google: "No se pudo iniciar sesión con Google. Intenta de nuevo.",
  rso: "No se pudo iniciar sesión con Riot. Intenta de nuevo.",
  rso_state: "Sesión de Riot expirada (state). Vuelve a intentarlo.",
  rso_token: "Riot no devolvió el token. Intenta de nuevo.",
  rso_nopuuid: "No se pudo leer tu cuenta de Riot.",
  oauth: "Error de autenticación. Intenta de nuevo.",
};

// ─── Brand icons ───────────────────────────────────────────────────────────────
function GoogleIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.57c2.08-1.92 3.27-4.74 3.27-8.09Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.76c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z" />
    </svg>
  );
}
function RiotIcon({ className = "" }: { className?: string }) {
  // Simplified Riot Games "fist" wordmark mark, monochrome (inherits currentColor)
  return (
    <svg className={className} viewBox="0 0 48 48" fill="currentColor" aria-hidden="true">
      <path d="M6 13.5 17.6 9l-1.1 19.2-3.9 1.1.4-13.4-2.8.9.6 12.9-3.9 1.1.4-12.4-2.6.9.7 11.9-1.6.4L6 13.5Zm17 18.7L42 27v6.5l-3.4.9.1-2.6-3.3.9.2 2.6-3.2.8.2-2.5-3.2.9.3 2.5-3.3.9.3-2.5-3.5 1 .3 2.6-3 .8.1-3.7Zm.6-23.4L42 12.7l-.6 9.5-18.4 4.9.6-18.3Z" />
    </svg>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const from = (location.state as any)?.from?.pathname || "/dashboard";

  // Surface OAuth redirect errors (?error=google|rso|…)
  useEffect(() => {
    const code = new URLSearchParams(location.search).get("error");
    if (code) setError(OAUTH_ERRORS[code] ?? "Error de autenticación.");
  }, [location.search]);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setError("");
    try {
      await login(data);
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err?.response?.data?.msg || err?.response?.data?.message || "Credenciales inválidas");
    } finally {
      setIsLoading(false);
    }
  };

  const onGoogle = () => { window.location.href = `${API_BASE}/auth/google`; };
  const onRiot = () => { window.location.href = `${API_BASE}/auth/riot`; };

  const inputCls =
    "w-full h-11 px-3.5 rounded-xl bg-white/[0.04] border border-white/[0.10] text-white text-sm " +
    "placeholder:text-gray-600 outline-none transition focus:border-red-500/60 focus:bg-white/[0.06]";

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-black relative overflow-hidden">
      {/* Ambient red glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] rounded-full blur-[120px]"
          style={{ background: "radial-gradient(circle, rgba(225,36,46,0.18), transparent 70%)" }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-md"
      >
        {/* Glass card */}
        <div className="relative rounded-2xl border border-white/[0.08] bg-[rgba(13,13,17,0.66)] backdrop-blur-xl p-8
          shadow-[0_24px_64px_rgba(0,0,0,0.6)]">
          {/* top hairline */}
          <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-red-500/50 to-transparent" />

          {/* Brand */}
          <div className="text-center mb-7">
            <div className="mx-auto mb-4 w-12 h-12 rounded-xl flex items-center justify-center
              bg-gradient-to-br from-red-600/25 to-red-900/10 border border-red-500/30">
              <Swords className="h-6 w-6 text-red-400" />
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white">
              ATAK<span className="text-red-500">.GG</span>
            </h1>
            <p className="text-sm text-gray-500 mt-1">Inicia sesión para continuar</p>
          </div>

          {/* OAuth */}
          <div className="space-y-2.5">
            <button type="button" onClick={onRiot} disabled={isLoading}
              className="w-full h-11 rounded-xl flex items-center justify-center gap-2.5 text-sm font-semibold text-white
                bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600
                shadow-[0_4px_16px_rgba(225,36,46,0.25)] transition disabled:opacity-50">
              <RiotIcon className="h-5 w-5" />
              Iniciar sesión con Riot
            </button>

            <button type="button" onClick={onGoogle} disabled={isLoading}
              className="w-full h-11 rounded-xl flex items-center justify-center gap-2.5 text-sm font-semibold
                text-white bg-white/[0.05] border border-white/[0.12] hover:bg-white/[0.09] transition disabled:opacity-50">
              <GoogleIcon className="h-5 w-5" />
              Continuar con Google
            </button>
          </div>

          {/* Divider */}
          <div className="relative my-5 text-center">
            <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px bg-white/[0.08]" />
            <span className="relative px-3 bg-[rgba(13,13,17,0.66)] text-[11px] uppercase tracking-widest text-gray-600">
              o con email
            </span>
          </div>

          {/* Email + password */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-medium text-gray-400">Email</label>
              <input id="email" type="email" autoComplete="email" placeholder="tu@email.com"
                className={inputCls} {...register("email")} />
              {errors.email && <p className="text-xs text-red-400">{errors.email.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-xs font-medium text-gray-400">Contraseña</label>
              <input id="password" type="password" autoComplete="current-password" placeholder="••••••••"
                className={inputCls} {...register("password")} />
              {errors.password && <p className="text-xs text-red-400">{errors.password.message}</p>}
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
                {error}
              </div>
            )}

            <button type="submit" disabled={isLoading}
              className="w-full h-11 rounded-xl flex items-center justify-center gap-2 text-sm font-bold text-white
                bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600
                shadow-[0_4px_16px_rgba(225,36,46,0.25)] transition disabled:opacity-50">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Iniciar Sesión"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            ¿No tienes una cuenta?{" "}
            <Link to="/register" className="text-red-400 hover:text-red-300 font-semibold">Regístrate</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
