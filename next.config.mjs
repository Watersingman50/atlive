/** @type {import('next').NextConfig} */
const nextConfig = {
  // Ticketmaster event images are served from ticketm.net.
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**.ticketm.net" }],
  },
};

export default nextConfig;
