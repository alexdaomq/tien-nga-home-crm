import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const baseUrl = new URL(`${protocol}://${host}`);

  return {
    metadataBase: baseUrl,
    title: "Tiến Nga Home CRM",
    description: "CRM bán hàng B2C với bản đồ cơ hội, ưu tiên chăm sóc và dữ liệu khách hàng đầy đủ của Tiến Nga Home.",
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: {
      title: "Tiến Nga Home · CRM bán hàng B2C",
      description: "Rõ cơ hội · Đúng ưu tiên · Chốt hiệu quả.",
      type: "website",
      images: [{ url: new URL("/og.png", baseUrl).toString(), width: 1536, height: 1024, alt: "Dashboard CRM bán hàng B2C Tiến Nga Home" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Tiến Nga Home · CRM bán hàng B2C",
      description: "Rõ cơ hội · Đúng ưu tiên · Chốt hiệu quả.",
      images: [new URL("/og.png", baseUrl).toString()],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <head><meta charSet="utf-8" /></head>
      <body>{children}</body>
    </html>
  );
}
