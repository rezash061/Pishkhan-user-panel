import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const apiUrl = process.env.PISHKHAN_API_URL ?? "http://localhost:5080";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  // The SignalR hub is served by the Api host. Same-origin in every environment: Nginx routes /hubs in production,
  // this rewrite does it for `next dev` and `next start` (SignalR falls back to SSE or long polling through it).
  async rewrites() {
    return [{ source: "/hubs/:path*", destination: `${apiUrl}/hubs/:path*` }];
  },
  // Static headers; the nonce-based CSP is set per request in src/proxy.ts.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=(), payment=(), usb=()" },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
