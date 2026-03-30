import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'HashScan — Distributed Range Processor',
  description: 'Monitor de agentes e blocos processados',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, padding: 0, background: '#080b0f' }}>{children}</body>
    </html>
  )
}
