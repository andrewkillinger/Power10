import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Power10 — Journalist Desk",
  description:
    "A kanban dashboard tracking what the journalists we follow are publishing.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen font-sans text-ink-900 antialiased">
        {children}
      </body>
    </html>
  );
}
