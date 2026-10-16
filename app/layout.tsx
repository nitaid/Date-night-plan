import type { Metadata, Viewport } from "next";
import { Rubik } from "next/font/google";
import "./globals.css";

const rubik = Rubik({ variable: "--font-rubik", subsets: ["hebrew", "latin"] });

export const metadata: Metadata = {
  title: "Streak Club",
  description: "מי מחזיק הכי הרבה ימים",
  appleWebApp: { capable: true, title: "Streak Club", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0b0b10",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="he" dir="rtl" className={`${rubik.variable} antialiased`}>
      <body className="min-h-dvh font-sans">
        <div className="mx-auto max-w-md px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-24">{children}</div>
      </body>
    </html>
  );
}
