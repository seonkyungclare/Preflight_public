import type { Metadata } from 'next'
import './globals.css'
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";

const inter = Inter({subsets:['latin'],variable:'--font-sans'});

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
    <html lang="ko" className={cn("dark font-sans", inter.variable)}>
      <body className="min-h-screen antialiased">
        {children}
      </body>
    </html>
  )
}
