import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/components/auth/auth-provider";
import { AppShell } from "@/components/shell/app-shell";
import { Toaster } from "@/components/ui/sonner";
import { JournalDraftProvider } from "@/components/journal/journal-draft-provider";
import { LifeDataProvider } from "@/lib/data/provider";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Orlander's Life Dashboard",
  description: "Personal command center for tasks, journal, and more.",
};

export const viewport: Viewport = {
  themeColor: "#0f1526",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        <AuthProvider>
          <LifeDataProvider>
            <JournalDraftProvider>
              <AppShell>{children}</AppShell>
            </JournalDraftProvider>
          </LifeDataProvider>
          <Toaster position="top-center" richColors closeButton />
        </AuthProvider>
      </body>
    </html>
  );
}
