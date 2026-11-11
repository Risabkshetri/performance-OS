import type { Metadata, Viewport } from "next";
import { Besley, Geist_Mono, Hanken_Grotesk } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const sans = Hanken_Grotesk({ variable: "--font-sans", subsets: ["latin"] });
const display = Besley({ variable: "--font-display", subsets: ["latin"], weight: ["500", "600"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Performance OS", template: "%s · Performance OS" },
  description: "Plan deliberately, execute meaningful work, keep healthy habits and measure long-term progress.",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "Performance", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f8fa" },
    { media: "(prefers-color-scheme: dark)", color: "#111318" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: next-themes sets the class before hydration to avoid a theme flash
    <html lang="en" suppressHydrationWarning className={`${sans.variable} ${display.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <ThemeProvider>
          <TooltipProvider delayDuration={300}>
            {children}
            <Toaster position="bottom-right" mobileOffset={{ bottom: "calc(4.5rem + env(safe-area-inset-bottom))" }} />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
