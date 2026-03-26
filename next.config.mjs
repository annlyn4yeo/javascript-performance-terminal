/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["@sparticuz/chromium", "playwright"],
  experimental: {
    outputFileTracingIncludes: {
      "/api/analyze": ["./node_modules/@sparticuz/chromium/**/*"],
    },
  },
};

export default nextConfig;
