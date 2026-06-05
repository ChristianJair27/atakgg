// src/pages/Login.tsx
import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/Card";
import { Spinner } from "@/components/Spinner";
import { useAuth } from "@/features/auth/useAuth";
import { LogIn } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

type LoginFormData = z.infer<typeof loginSchema>;

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth(); // debe hacer POST /auth/login con {email,password}
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const from = (location.state as any)?.from?.pathname || "/dashboard";

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setError("");
    try {
      await login(data); // asegúrate que tu hook envíe withCredentials:true
      navigate(from, { replace: true });
    } catch (err: any) {
      const msg =
        err?.response?.data?.msg ||
        err?.response?.data?.message ||
        "Credenciales inválidas";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const onGoogle = () => {
    // redirige al flujo de OAuth del backend
    window.location.href = `${API_BASE}auth/google`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-hero">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-3 bg-gradient-primary rounded-lg w-fit">
              <LogIn className="h-8 w-8 text-primary-foreground" />
            </div>
            <CardTitle className="text-2xl">Iniciar Sesión</CardTitle>
            <CardDescription>Ingresa a tu cuenta de ATAK.GG</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Google OAuth */}
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={onGoogle}
              disabled={isLoading}
            >
              {isLoading ? <Spinner size="sm" /> : "Continuar con Google"}
            </Button>

            <div className="relative my-2 text-center text-xs text-muted-foreground">
              <span className="bg-background px-2 relative z-10">o con email</span>
              <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px bg-border" />
            </div>

            {/* Email + Password */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="tu@email.com"
                  aria-invalid={!!errors.email}
                  {...register("email")}
                />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium">
                  Contraseña
                </label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  aria-invalid={!!errors.password}
                  {...register("password")}
                />
                {errors.password && (
                  <p className="text-sm text-destructive">{errors.password.message}</p>
                )}
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive text-destructive text-sm">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? <Spinner size="sm" /> : "Iniciar Sesión"}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm">
              <span className="text-muted-foreground">¿No tienes una cuenta? </span>
              <Link to="/register" className="text-accent hover:text-accent/80 font-medium">
                Regístrate aquí
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
