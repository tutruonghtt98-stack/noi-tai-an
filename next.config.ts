import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // pg-cloudflare dùng điều kiện export "workerd" mà @vercel/nft (trace của Next)
  // không phát hiện ra. .prisma/client/*.wasm được wasm-compiler-edge.js đọc bằng
  // fs runtime (không phải static import) nên tracer cũng bỏ sót. Buộc include cả hai.
  outputFileTracingIncludes: {
    "/*": ["node_modules/pg-cloudflare/**/*", "node_modules/.prisma/client/*.wasm"],
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;

import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
