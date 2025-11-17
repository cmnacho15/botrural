import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ignora ESLint SOLO durante el build (ideal para tu caso)
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Mantiene los errores de TypeScript (importante para calidad)
  typescript: {
    ignoreBuildErrors: false,
  },

  // Config básico para Next 15 (sin turbopack experimental)
  reactStrictMode: true,
};

export default nextConfig;