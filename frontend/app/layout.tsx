import type { Metadata } from "next";
import "./globals.css";
import CursorTrail from "@/components/layout/CursorTrail";

export const metadata: Metadata = {
  title: "Easy View | PwC",
  description: "PwC EasyView Financial Analytics",
  icons: { icon: "/easyview/favicon.png" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>
        <CursorTrail />
        {children}
      </body>
    </html>
  );
}
