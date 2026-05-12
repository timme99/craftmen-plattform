import type { NextConfig } from "next";

// Vercel project root dir is set to "services/pdf-service"; distDir must
// match so Vercel finds the build output at services/pdf-service/.next
const nextConfig: NextConfig = {
  distDir: "services/pdf-service/.next",
};

export default nextConfig;
