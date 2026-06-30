/** @type {import('next').NextConfig} */
const nextConfig = {
  // Ticketmaster event images are served from ticketm.net.
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**.ticketm.net" }],
  },
  // Bundle the OG font into the image function so the disk read works at
  // runtime on Vercel (not just at build) — without this, fs reads of files
  // outside the traced graph fail in the serverless function.
  outputFileTracingIncludes: {
    "/opengraph-image": [
      "./assets/fonts/SpaceGrotesk-Regular.ttf",
      "./assets/fonts/SpaceGrotesk-Bold.ttf",
    ],
  },
};

export default nextConfig;
