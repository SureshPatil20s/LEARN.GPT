import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
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
    <html lang="en" className="dark h-full">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased h-full bg-[#121212] text-zinc-100 flex flex-col`}
      >
        <GoogleOAuthWrapper>
          <AuthProvider>{children}</AuthProvider>
        </GoogleOAuthWrapper>
      </body>
    </html>
  );
}
