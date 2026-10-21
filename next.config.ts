import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Uploads de logo/favicon (até 1 MB cada) e planilhas CSV (até 2 MB).
    serverActions: { bodySizeLimit: "3mb" },
  },
};

export default nextConfig;
