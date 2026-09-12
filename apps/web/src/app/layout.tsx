import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import type { ReactNode } from 'react';
import { AppProviders } from '@/providers/app-providers';
import { cn } from '@/lib/utils';
import './globals.css';

const geist = Geist({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });

export const metadata: Metadata = {
  title: {
    default: 'Nexo — Internal Operations Platform',
    template: '%s · Nexo',
  },
  description: 'Internal operations platform for modern teams. A NovaTec Product.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // suppressHydrationWarning: next-themes sets the theme class on <html>
    // before React hydrates, which is a deliberate mismatch.
    <html lang="es" suppressHydrationWarning className={cn('h-full', geist.variable)}>
      <body className="min-h-full antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
