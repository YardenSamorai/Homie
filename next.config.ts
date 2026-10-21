import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // Settings › About names the site's version by the day it was built.
  env: { NEXT_PUBLIC_BUILD_DATE: new Date().toISOString().slice(0, 10) },
  partialPrefetching: true,
  // Every corner of the phone layout holds a control (add button, tab bar, settings, greeting).
  devIndicators: false,
  // Opening the dev server from a phone on the home network uses the LAN address.
  allowedDevOrigins: ["10.0.0.44"],
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
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
