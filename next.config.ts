import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    // Pages are prerendered in worker processes, and each worker would have its own
    // copy of the Statbot rate limiter. One worker means one limiter for the whole
    // build. There are only a handful of pages, so the build isn't noticeably slower.
    cpus: 1,
  },
};

export default nextConfig;
