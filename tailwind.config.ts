import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // ── 배경 ──────────────────────────────────
        canvas: '#0a0e1a',         // 페이지 최하단 배경
        surface: {
          DEFAULT: '#0f172a',      // 카드/패널 배경 (slate-900)
          raised: '#1e293b',       // 보조 카드, 구분선 (slate-800)
          overlay: '#334155',      // 호버, 활성 상태 (slate-700)
        },

        // ── 텍스트 ────────────────────────────────
        ink: {
          primary: '#ffffff',      // 주요 텍스트
          subtle: '#cbd5e1',       // 준주요 텍스트 (slate-300)
          secondary: '#94a3b8',    // 보조 텍스트 (slate-400)
          muted: '#64748b',        // 희미한 텍스트 (slate-500)
          faint: '#475569',        // 매우 희미한 텍스트 (slate-600)
          dim: '#334155',          // 거의 안 보이는 텍스트 (slate-700)
        },

        // ── 브랜드 Primary ────────────────────────
        brand: {
          DEFAULT: '#7c3aed',      // violet-600
          light: '#8b5cf6',        // violet-500
          dim: '#4c1d95',          // violet-900 (버튼 테두리 등)
        },

        // ── 보조 액센트 ───────────────────────────
        accent: {
          DEFAULT: '#4f46e5',      // indigo-600
          light: '#6366f1',        // indigo-500
        },

        // ── 상태 색상 ──────────────────────────────
        status: {
          success: '#22c55e',      // green-500 (Ready)
          warning: '#f59e0b',      // amber-500 (Refine)
          error: '#ef4444',        // red-500 (Rewrite)
          info: '#60a5fa',         // blue-400 (개발자 체크리스트)
        },
      },
    },
  },
  plugins: [],
}

export default config
