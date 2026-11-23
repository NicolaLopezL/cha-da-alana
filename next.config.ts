import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Postgres embutido: só no modo local (dev/testes); nunca vai para a Vercel.
  serverExternalPackages: ["@electric-sql/pglite"],
  // Fontes do cartaz em PDF
  outputFileTracingIncludes: {
    "/quiz/qr/cartaz": ["./node_modules/@fontsource/{pinyon-script,cormorant-garamond,manrope}/files/*-latin-{400,500,600}-normal.woff"],
  },
  outputFileTracingExcludes: { "/*": ["node_modules/@electric-sql/**"] },
  // Os testes E2E usam uma pasta própria para não atrapalhar o "npm run dev".
  distDir: process.env.NEXT_DIST_DIR || ".next",
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }],
  },
  experimental: {
    serverActions: { bodySizeLimit: "4mb" },
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Links pessoais não devem ser indexados nem cacheados por intermediários.
      { source: "/convite/:token*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/admin/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
    ];
  },
};

export default nextConfig;
