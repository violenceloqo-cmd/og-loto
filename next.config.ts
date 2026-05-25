import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disabled: React 19 Strict Mode double-mounts the R3F Canvas in dev,
  // which causes the WebGL context to be lost ("THREE.WebGLRenderer: Context Lost.").
  reactStrictMode: false,
};

export default nextConfig;
