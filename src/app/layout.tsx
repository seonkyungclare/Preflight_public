import type { Metadata } from 'next'
import './globals.css'
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

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
    <html lang="ko" className={cn("font-sans", geist.variable)}>
      <body className="bg-[#0a0e1a] text-white min-h-screen antialiased">
        {children}
      </body>
    </html>
  )
}
