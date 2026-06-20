import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    outputFileTracingIncludes: {
      "/*": ["prisma/dev.db"],
    },
  },
};

export default nextConfig;
