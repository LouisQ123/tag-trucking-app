import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Default is 1MB — too small for a phone photo of a paper ticket.
      // Set above the 20MB scan cap to leave room for multipart overhead.
      bodySizeLimit: "25mb",
    },
    // proxy.ts (our auth check) buffers every request body up to this cap
    // before the Server Action ever sees it — default 10MB, so it needs
    // raising too or large scan uploads get silently truncated here first.
    proxyClientMaxBodySize: "25mb",
  },
};

export default nextConfig;
