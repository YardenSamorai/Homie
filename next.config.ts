import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Every corner of the phone layout holds a control (add button, tab bar, settings, greeting).
  devIndicators: false,
  // Opening the dev server from a phone on the home network uses the LAN address.
  allowedDevOrigins: ["10.0.0.44"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
