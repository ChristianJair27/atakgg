// src/pages/Register.tsx — ATAK.GG sign-up (matches Login: brand glass, Riot + Google)
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { Loader2, Swords, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/features/auth/useAuth";

const registerSchema = z.object({
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});
type RegisterFormData = z.infer<typeof registerSchema>;

const API_BASE = (import.meta.env.VITE_API_URL ?? "http://localhost:4000").replace(/\/$/, "");

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
  return (
    <svg className={className} viewBox="0 0 48 48" fill="currentColor" aria-hidden="true">
      <path d="M6 13.5 17.6 9l-1.1 19.2-3.9 1.1.4-13.4-2.8.9.6 12.9-3.9 1.1.4-12.4-2.6.9.7 11.9-1.6.4L6 13.5Zm17 18.7L42 27v6.5l-3.4.9.1-2.6-3.3.9.2 2.6-3.2.8.2-2.5-3.2.9.3 2.5-3.3.9.3-2.5-3.5 1 .3 2.6-3 .8.1-3.7Zm.6-23.4L42 12.7l-.6 9.5-18.4 4.9.6-18.3Z" />
    </svg>
  );
}

const Register = () => {
  const navigate = useNavigate();
  const { register: registerUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(true);
    setError("");
    try {
      await registerUser(data);
      setSuccess(true);
      setTimeout(() => navigate("/login"), 1800);
    } catch (err: any) {
      setError(err?.response?.data?.msg || err?.response?.data?.message || "Error al crear la cuenta");
    } finally {
      setIsLoading(false);
    }
  };

  const onGoogle = () => { window.location.href = `${API_BASE}/auth/google`; };
  const onRiot = () => { window.location.href = `${API_BASE}/auth/riot`; };

  const inputCls =
    "w-full h-11 px-3.5 rounded-xl bg-white/[0.04] border border-white/[0.10] text-white text-sm " +
    "placeholder:text-gray-600 outline-none transition focus:border-red-500/60 focus:bg-white/[0.06]";

  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-black relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] rounded-full blur-[120px]"
          style={{ background: "radial-gradient(circle, rgba(225,36,46,0.18), transparent 70%)" }} />
      </div>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }} className="relative w-full max-w-md">
        <div className="relative rounded-2xl border border-white/[0.08] bg-[rgba(13,13,17,0.66)] backdrop-blur-xl p-8 shadow-[0_24px_64px_rgba(0,0,0,0.6)]">
          <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-red-500/50 to-transparent" />
          {children}
        </div>
      </motion.div>
    </div>
  );

  if (success) {
    return shell(
      <div className="text-center py-4">
        <div className="mx-auto mb-4 w-12 h-12 rounded-xl flex items-center justify-center bg-green-500/15 border border-green-500/30">
          <CheckCircle2 className="h-6 w-6 text-green-400" />
        </div>
        <h2 className="text-2xl font-black text-white mb-1">¡Cuenta creada!</h2>
        <p className="text-sm text-gray-500 mb-4">Te redirigimos al inicio de sesión…</p>
        <Loader2 className="h-5 w-5 animate-spin text-red-400 mx-auto" />
      </div>
    );
  }

  return shell(
    <>
      <div className="text-center mb-7">
        <div className="mx-auto mb-4 w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br from-red-600/25 to-red-900/10 border border-red-500/30">
          <Swords className="h-6 w-6 text-red-400" />
        </div>
        <h1 className="text-3xl font-black tracking-tight text-white">
          ATAK<span className="text-red-500">.GG</span>
        </h1>
        <p className="text-sm text-gray-500 mt-1">Crea tu cuenta para competir</p>
      </div>

      <div className="space-y-2.5">
        <button type="button" onClick={onRiot} disabled={isLoading}
          className="w-full h-11 rounded-xl flex items-center justify-center gap-2.5 text-sm font-semibold text-white
            bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600
            shadow-[0_4px_16px_rgba(225,36,46,0.25)] transition disabled:opacity-50">
          <RiotIcon className="h-5 w-5" />
          Registrarse con Riot
        </button>
        <button type="button" onClick={onGoogle} disabled={isLoading}
          className="w-full h-11 rounded-xl flex items-center justify-center gap-2.5 text-sm font-semibold
            text-white bg-white/[0.05] border border-white/[0.12] hover:bg-white/[0.09] transition disabled:opacity-50">
          <GoogleIcon className="h-5 w-5" />
          Continuar con Google
        </button>
      </div>

      <div className="relative my-5 text-center">
        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px bg-white/[0.08]" />
        <span className="relative px-3 bg-[rgba(13,13,17,0.66)] text-[11px] uppercase tracking-widest text-gray-600">o con email</span>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="name" className="text-xs font-medium text-gray-400">Nombre</label>
          <input id="name" type="text" placeholder="Tu nombre" className={inputCls} {...register("name")} />
          {errors.name && <p className="text-xs text-red-400">{errors.name.message}</p>}
        </div>
        <div className="space-y-1.5">
          <label htmlFor="email" className="text-xs font-medium text-gray-400">Email</label>
          <input id="email" type="email" placeholder="tu@email.com" className={inputCls} {...register("email")} />
          {errors.email && <p className="text-xs text-red-400">{errors.email.message}</p>}
        </div>
        <div className="space-y-1.5">
          <label htmlFor="password" className="text-xs font-medium text-gray-400">Contraseña</label>
          <input id="password" type="password" placeholder="••••••••" className={inputCls} {...register("password")} />
          {errors.password && <p className="text-xs text-red-400">{errors.password.message}</p>}
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">{error}</div>
        )}

        <button type="submit" disabled={isLoading}
          className="w-full h-11 rounded-xl flex items-center justify-center gap-2 text-sm font-bold text-white
            bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600
            shadow-[0_4px_16px_rgba(225,36,46,0.25)] transition disabled:opacity-50">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear Cuenta"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        ¿Ya tienes una cuenta?{" "}
        <Link to="/login" className="text-red-400 hover:text-red-300 font-semibold">Inicia sesión</Link>
      </p>
    </>
  );
};

export default Register;
