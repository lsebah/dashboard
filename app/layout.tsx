import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Dashboard CMF',
  description: 'Personal dashboard - Capital Management France',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Dashboard CMF',
  },
}

export const viewport: Viewport = {
  themeColor: '#2c5068',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body className="bg-gradient-animated antialiased">
        {children}
      </body>
    </html>
  )
}
