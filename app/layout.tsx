import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

// 🚨 修正：SEOキーワードを戦略的に埋め込んだメタデータ
export const metadata: Metadata = {
  title: {
    default: "価値ピ｜価値観でつながる匿名チャット",
    template: "%s | カチピ"
  },
  description: "年収や学歴、外見などのスペック競争に疲れたあなたへ。カチピは、ニーチェやショーペンハウアーの格言と共に、今の本音を静かにつぶやき、深い価値観で共感できる仲間を探す「大人のための聖域」です。",
  keywords: [
    "マッチングアプリ 疲れた", 
    "価値観マッチング 匿名", 
    "本音で話せる場所", 
    "婚活疲れ 癒やし", 
    "哲学 チャット", 
    "スペック重視 嫌い",
    "孤独 解消 大人"
  ],
  openGraph: {
    title: "カチピ｜価値観でつながる、大人のための匿名チャット",
    description: "スペック競争を脱ぎ捨てて、本音の価値観でつながりませんか？",
    url: "https://www.kachipea.com/",
    siteName: "カチピ (Kachipea)",
    locale: "ja_JP",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "カチピ｜スペック重視に疲れたあなたへ",
    description: "哲学者の格言と共に、匿名で本音を語り合える場所。",
  },
  generator: "v0.app",
  icons: {
    icon: [
      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/apple-icon.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ja">
      <body className={`font-sans antialiased`}>
        {children}
        <Analytics />
      </body>
    </html>
  )
}