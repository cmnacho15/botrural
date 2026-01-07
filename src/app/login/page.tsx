"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';

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
        router.push(callbackUrl);
        router.refresh();
      }
    } catch (err) {
      setError("Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">

      {/* CARD LOGIN */}
      <div className="bg-white p-10 rounded-2xl shadow-xl w-full max-w-md border border-gray-200">

        {/* 🔥 LOGO ARRIBA ESTILO FIELDDATA */}
        <div className="flex flex-col items-center mb-6">
          <Image 
  src="/BoTRURAL.svg"
  alt="BotRural"
  width={180}
  height={180}
  className="mx-auto mb-4 w-32 sm:w-40 md:w-48"
  priority
/>
          <h1 className="text-3xl font-bold text-gray-900">Iniciar sesión</h1>
          <p className="text-gray-500 text-sm mt-1">
            Ingresa tus credenciales para continuar
          </p>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* FORMULARIO */}
        <form onSubmit={handleLogin} className="space-y-4">

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
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
            <label className="block text-sm font-medium text-gray-700 mb-2">
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

          {/* Botón */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition font-medium shadow-md disabled:opacity-50"
          >
            {loading ? "⏳ Cargando..." : "🚀 Iniciar Sesión"}
          </button>
        </form>

        {/* Links */}
        <p className="text-center text-gray-600 text-sm mt-6">
          ¿No tienes cuenta?{" "}
          <a href="/register" className="text-green-600 font-medium hover:underline">
            Regístrate aquí
          </a>
        </p>
      </div>

      {/* FOOTER */}
      <div className="mt-4 text-center text-sm text-gray-500">
        <a href="/privacy" className="hover:text-gray-700">Política de Privacidad</a>
        {" • "}
        <a href="/terms" className="hover:text-gray-700">Términos de Uso</a>
      </div>
    </div>
  );
}