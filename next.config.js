/** @type {import('next').NextConfig} */
const nextConfig = {
  // 빌드 폴더를 환경변수로 바꿀 수 있게 둔다. dev 서버 두 개를 동시에 띄우거나
  // dev 서버가 떠 있는 채로 next build를 돌리면 같은 .next를 두 프로세스가
  // 밟아 "Cannot find module './948.js'" 같은 청크 404·500이 난다.
  // 예) NEXT_DIST_DIR=.next-alt npm run dev
  distDir: process.env.NEXT_DIST_DIR || '.next',
  env: {
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
  },
  experimental: {
    serverComponentsExternalPackages: ['pdf-parse'],
  },
  transpilePackages: ['@codesandbox/sandpack-react', '@codesandbox/sandpack-client'],
}

module.exports = nextConfig
