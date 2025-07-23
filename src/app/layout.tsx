import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import Header from "@/components/header";
import Footer from "@/components/footer";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "VIA Bridge",
  description: "Transfer BTC between Bitcoin and VIA network",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} flex flex-col min-h-screen`}>
        <Header />
        <div className="flex-1 flex flex-col overflow-y-auto">
          {children}
        </div>
        <Footer />
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
