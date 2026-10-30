import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Box art served by IGDB. See lib/igdb-client.ts.
    remotePatterns: [new URL("https://images.igdb.com/igdb/image/upload/**")],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Nothing embeds the app, so block framing to rule out clickjacking.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Keeps the reset password token in the URL from leaking to other sites.
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default nextConfig;
