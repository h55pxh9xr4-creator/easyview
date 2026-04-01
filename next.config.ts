import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",          // GitHub Pages 정적 배포
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
