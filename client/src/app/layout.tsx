import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import GoogleOAuthWrapper from '@/components/GoogleOAuthWrapper';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'LEARN.GPT — AI Learning Platform',
  description: 'Enterprise AI chat platform powered by Groq hosted models with document RAG knowledge base',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark h-full" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased h-full bg-slate-50 dark:bg-[#121212] text-zinc-900 dark:text-zinc-100 flex flex-col transition-colors duration-200`}
      >
        <GoogleOAuthWrapper>
          <AuthProvider>
            <ThemeProvider>{children}</ThemeProvider>
          </AuthProvider>
        </GoogleOAuthWrapper>
      </body>
    </html>
  );
}
