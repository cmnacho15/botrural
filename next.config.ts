import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname, // 👈 fija explícitamente el root y elimina el warning
  },
  /* config options here */
};

export default nextConfig;