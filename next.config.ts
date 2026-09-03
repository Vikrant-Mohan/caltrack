import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // OFF images can live on either generation of hosts.
      { protocol: "https", hostname: "**.openfoodfacts.org" },
      { protocol: "https", hostname: "openfoodfacts.org" },
      { protocol: "https", hostname: "**.openfoodfacts.net" },
      { protocol: "https", hostname: "openfoodfacts.net" },
    ],
  },
};

export default nextConfig;