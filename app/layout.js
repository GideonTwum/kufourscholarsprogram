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
  title: "Kufuor Scholars Program | Grooming Future Leaders of Africa",
  description:
    "The Kufuor Scholars Program, an initiative of the John Agyekum Kufuor Foundation, identifies and nurtures exceptional young Ghanaians with leadership potential through a transformational 3-year program.",
  keywords: [
    "Kufuor Scholars",
    "John Agyekum Kufuor Foundation",
    "Leadership Development",
    "Ghana Scholarship",
    "African Leaders",
    "Youth Development",
    "Mentorship Program",
  ],
  authors: [{ name: "John Agyekum Kufuor Foundation" }],
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://scholars.kufuorfoundation.org"),
  openGraph: {
    title: "Kufuor Scholars Program | Grooming Future Leaders of Africa",
    description:
      "A transformational 3-year program nurturing exceptional young Ghanaians through leadership development, mentorship, and academic excellence.",
    url: "/",
    siteName: "Kufuor Scholars Program",
    locale: "en_GH",
    type: "website",
    images: [{ url: "/scholars.jpg", width: 1200, height: 630, alt: "Kufuor Scholars Program" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Kufuor Scholars Program | Grooming Future Leaders of Africa",
    description:
      "A transformational 3-year program nurturing exceptional young Ghanaians through leadership development, mentorship, and academic excellence.",
  },
  alternates: {
    canonical: "/",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
