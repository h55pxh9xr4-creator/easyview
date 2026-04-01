import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Easy View | PwC",
  description: "PwC EasyView Financial Analytics",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
