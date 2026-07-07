/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
  },
  // Next 15: experimental.serverComponentsExternalPackages → 최상위 serverExternalPackages
  serverExternalPackages: ['pdf-parse'],
  transpilePackages: ['@codesandbox/sandpack-react', '@codesandbox/sandpack-client'],
}

module.exports = nextConfig
