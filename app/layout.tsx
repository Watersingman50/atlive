import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ATLive — What's on in Atlanta this week",
  description:
    "Automated weekly roundup of live music across Atlanta, aggregated and deduped from multiple sources.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
