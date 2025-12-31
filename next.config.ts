

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ignora ESLint durante build (opcional, pero útil si tenés lint errors)
  eslint: {
    ignoreDuringBuilds: true,
  },

  // NO ignores TypeScript errors (mantiene calidad de código)
  typescript: {
    ignoreBuildErrors: false,
  },

  reactStrictMode: true,

  // ==================== FIX PARA SKIA-CANVAS ====================
  // Marca skia-canvas como paquete externo en server (evita que webpack intente procesar el .node binario)
  serverExternalPackages: ["skia-canvas"],

  webpack: (config, { isServer }) => {
    // Solo en el lado server (donde se ejecuta la API route)
    if (isServer) {
      // Agrega skia-canvas a los externals para que no sea bundled
      config.externals = [...(config.externals || []), "skia-canvas"];
    }
    return config;
  },
  // ============================================================

};

export default nextConfig;