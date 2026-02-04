import type { NextConfig } from "next";

const isGithubPages = process.env.GITHUB_PAGES === "true";

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
  basePath: isGithubPages ? "/solana-deep-dive-quiz" : "",
  assetPrefix: isGithubPages ? "/solana-deep-dive-quiz/" : "",
};

export default nextConfig;
