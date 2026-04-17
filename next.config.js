/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['pdf-parse'],
  },
  transpilePackages: ['@codesandbox/sandpack-react', '@codesandbox/sandpack-client'],
}

module.exports = nextConfig
