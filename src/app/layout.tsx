import type { Metadata } from "next";
import { Urbanist } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// Variable font: one file covers every weight we use (400 / 500 / 600, plus bold in markdown).
// latin-ext for names with diacritics.
const urbanist = Urbanist({
  variable: "--font-urbanist",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "UXDA Learn",
  description: "Challenges, feedback and leaderboard for the UXDA team.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${urbanist.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Dark by default, whatever the system setting says; the toggle stores the visitor's own choice (localStorage "theme"). */}
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
          {children}
          <Toaster richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
