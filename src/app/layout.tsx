import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'PRD Simulator',
  description: 'Validate your PRD and generate UI mockups with AI',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body className="bg-[#0a0e1a] text-white min-h-screen antialiased">
        {children}
      </body>
    </html>
  )
}
