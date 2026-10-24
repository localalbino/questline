import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Box art served by IGDB. See lib/igdb-client.ts.
    remotePatterns: [new URL("https://images.igdb.com/igdb/image/upload/**")],
  },
};

export default nextConfig;
