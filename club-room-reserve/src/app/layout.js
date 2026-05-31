import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "音スタ 予約システム", // ついでにタイトルもカッコよく変更！
  description: "Band Practice Control Panel",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="ja" // 日本語環境なので "ja" に変更
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased bg-slate-950`}
    >
      {/* 💡 body に bg-slate-950 と text-slate-100 を直接指定して、隙間を漆黒で埋め尽くします */}
      <body className="min-h-full flex flex-col bg-slate-950 text-slate-100 m-0 p-0 overflow-x-hidden">
        {children}
      </body>
    </html>
  );
}