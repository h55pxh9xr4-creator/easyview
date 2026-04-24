import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  output: isDev ? undefined : "export",   // 로컬 dev는 정적 export 안 함
  basePath: isDev ? "" : "/easyview",
  assetPrefix: isDev ? "" : "/easyview",
  trailingSlash: !isDev,
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_BASE_PATH: isDev ? "" : "/easyview",
  },
};

export default nextConfig;
