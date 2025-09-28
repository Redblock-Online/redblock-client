import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Redblock Online",
  description:
    "Redblock Online is a minimalistic free aim trainer. It will improve your accuracy and reflexes with different game modes. No signup, just play!",
  keywords: [
    "aim trainer",
    "redblock online",
    "aim practice",
    "shooter training",
    "free aim trainer",
    "fps aim trainer",
  ],
  authors: [{ name: "Redblock Team" }],
  robots: "index, follow",
  metadataBase: new URL("https://redblock.online"),
  themeColor: "#ff0000",
  openGraph: {
    title: "Redblock Online - Free Aim Trainer",
    description:
      "Redblock Online is a minimalistic free aim trainer. It will improve your accuracy and reflexes with different game modes. No signup, just play!",
    url: "https://redblock.online",
    type: "website",
    images: [
      {
        url: "https://redblock.online/slogo.png",
        width: 1200,
        height: 630,
        alt: "Redblock Online preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Redblock Online - Free Aim Trainer",
    description:
      "Redblock Online is a minimalistic free aim trainer. It will improve your accuracy and reflexes with different game modes. No signup, just play!",
    images: ["https://redblock.online/slogo.png"],
  },
  icons: {
    icon: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body className="relative h-full overflow-hidden bg-[#f8f8f8] font-mono text-black">
        {children}
      </body>
    </html>
  );
}
