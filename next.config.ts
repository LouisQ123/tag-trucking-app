import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Default is 1MB — too small for a phone photo of a paper ticket.
      bodySizeLimit: "15mb",
    },
  },
};

export default nextConfig;
