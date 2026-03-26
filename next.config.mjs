/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@sparticuz/chromium", "playwright"],
    outputFileTracingIncludes: {
      "/api/analyze": ["./node_modules/@sparticuz/chromium/**/*"],
    },
  },
};

export default nextConfig;
