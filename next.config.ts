import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Pin turbopack root to this project (parent home dir has another lockfile)
  turbopack: {
    root: process.cwd(),
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "api.normies.art",
        pathname: "/normie/**",
      },
    ],
  },
}

export default nextConfig
