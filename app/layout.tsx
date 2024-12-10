import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';

import '@react95/core/GlobalStyle';
import '@react95/core/themes/win95.css';
import React from 'react';
import FolderButton from './component/folder-button';
import Footer from './footer';

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist-sans',
  weight: '100 900',
});
const geistMono = localFont({
  src: './fonts/GeistMonoVF.woff',
  variable: '--font-geist-mono',
  weight: '100 900',
});

export const metadata: Metadata = {
  title: 'hazzzi.dev — A blog by Hazzzi',
  description: 'My Personal Blog',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <main className="p-8 flex">
          <aside>
            <FolderButton />
          </aside>
          {children}
          <Footer />
        </main>
      </body>
    </html>
  );
}
