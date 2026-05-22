/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@anthropic-ai/sdk"],
  },
  api: {
    bodyParser: {
      sizeLimit: "50mb",
    },
  },
};

module.exports = nextConfig;
