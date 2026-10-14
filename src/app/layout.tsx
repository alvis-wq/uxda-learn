import type { Metadata } from "next";
import localFont from "next/font/local";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// Urbanist, self-hosted (SIL OFL, src/app/fonts/OFL-Urbanist.txt): the full original variable font, one file for every
// weight. Not the Google Fonts copy: its latin-ext subset draws the macron of ā ē ī ū (and Ā Ē Ī Ū) one letter to the
// right, over the next glyph, which broke Latvian names such as "Katrīna".
const urbanist = localFont({
  src: "./fonts/Urbanist-Variable.woff2",
  variable: "--font-urbanist",
  weight: "100 900",
  display: "swap",
});

// Urbanist has no lowercase ģ (U+0123): browsers drew it in Arial, or built it from g + a combining cedilla. This is
// Outfit's ģ, a close geometric match (same weights, turned comma above), used for that one code point only
// (src/app/fonts/OFL-Outfit.txt). It must come first in --font-sans (see globals.css).
const urbanistGcomma = localFont({
  src: "./fonts/Outfit-gcommaaccent.woff2",
  variable: "--font-urbanist-extra",
  weight: "100 900",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  declarations: [{ prop: "unicode-range", value: "U+0123" }],
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
      className={`${urbanist.variable} ${urbanistGcomma.variable} h-full antialiased`}
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
