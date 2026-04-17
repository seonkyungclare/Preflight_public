/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
  },
  experimental: {
    serverComponentsExternalPackages: ['pdf-parse'],
  },
  transpilePackages: ['@codesandbox/sandpack-react', '@codesandbox/sandpack-client'],
}

module.exports = nextConfig
