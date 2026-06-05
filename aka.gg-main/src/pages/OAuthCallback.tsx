// src/pages/OAuthCallback.tsx
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

function b64urlToJson<T = unknown>(s: string): T {
  // decode base64url -> json
  const normalized = s.replace(/-/g, "+").replace(/_/g, "/");
  const json = atob(normalized);
  return JSON.parse(json);
}

export default function OAuthCallback() {
  const nav = useNavigate();

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("payload");
    if (!p) {
      nav("/login", { replace: true });
      return;
    }
    try {
      type User = { id: string; name: string; email: string }; // Adjust fields as needed
      const { token, user } = b64urlToJson<{ token: string; user: User }>(p);
      localStorage.setItem("access_token", token);
      localStorage.setItem("user", JSON.stringify(user));
      nav("/dashboard", { replace: true });
    } catch (e) {
      nav("/login?error=oauth", { replace: true });
    }
  }, [nav]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p>Conectando con Google…</p>
    </div>
  );
}
