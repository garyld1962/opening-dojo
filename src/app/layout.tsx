import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Opening Dojo",
  description: "Chess opening trainer — London System & Caro-Kann",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
