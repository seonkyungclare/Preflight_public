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
    <html lang="ko" className="dark font-sans">
      <head>
        <link href="https://cdn.jsdelivr.net/gh/sun-typeface/SUIT@2/fonts/variable/woff2/SUIT-Variable.css" rel="stylesheet" />
      </head>
      <body className="min-h-screen antialiased">
        {children}
      </body>
    </html>
  )
}
