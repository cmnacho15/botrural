"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link"; // ← agregué esto que te faltaba

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await signIn("credentials", {
        email: email.toLowerCase().trim(),
        password,
        redirect: false,
      });

      if (res?.error) {
        setError("Email o contraseña incorrectos");
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err) {
      setError("Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* CARD LOGIN */}
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        {/* LOGO ARRIBA */}
        <div className="flex justify-center mb-8">
          <Image
            src="/logo.png"
            alt="Logo"
            width={80}
            height={80}
            className="rounded-xl"
          />
        </div>

        <h2 className="text-3xl font-bold text-center text-gray-800 mb-2">
          Iniciar sesión
        </h2>
        <p className="text-center text-gray-600 mb-6">
          Ingresa tus credenciales para continuar
        </p>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm mb-6 text-center">
            {error}
          </div>
        )}

        {/* FORMULARIO */}
        <form onSubmit={handleLogin} className="space-y-5">
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
              placeholder="email@example.com"
            />
          </div>

          {/* Contraseña */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contraseña
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
              placeholder="••••••••"
            />
          </div>

          {/* Botón con tu verde exacto */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#008838] hover:bg-[#006b2d] text-white font-bold py-4 rounded-lg transition shadow-md disabled:opacity-70"
          >
            {loading ? "Cargando..." : "Iniciar Sesión"}
          </button>
        </form>

        {/* Links */}
        <div className="mt-6 text-center">
          ¿No tienes cuenta?{" "}
          <Link
            href="/register"
            className="font-semibold text-[#008838] hover:text-[#006b2d] transition underline"
          >
            Regístrate aquí
          </Link>
        </div>
      </div>

      {/* FOOTER */}
      <div className="mt-10 text-center text-xs text-gray-500">
        Política de Privacidad {" • "} Términos de Uso
      </div>
    </>
  );
}