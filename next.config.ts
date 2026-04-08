import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",          // GitHub Pages 정적 배포
  basePath: "/easyview",     // GitHub Pages 서브경로
  assetPrefix: "/easyview",  // 정적 파일 경로 prefix
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
