/** @type {import('next').NextConfig} */
const nextConfig = {
  // Compile the shared workspace UI package (ships raw .tsx source).
  transpilePackages: ["@tools/ui"],
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
