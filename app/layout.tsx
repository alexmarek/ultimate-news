import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';

const newsreader = localFont({
  src: [
    { path: './2026-11-13-fonts/2026-11-13-newsreader-variable.ttf', weight: '200 800', style: 'normal' },
    { path: './2026-11-13-fonts/2026-11-13-newsreader-italic-variable.ttf', weight: '200 800', style: 'italic' },
  ],
  variable: '--font-newsreader',
  display: 'swap',
});

const libreFranklin = localFont({
  src: './2026-11-13-fonts/2026-11-13-libre-franklin-variable.ttf',
  weight: '100 900',
  variable: '--font-libre-franklin',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Ultimate News',
  description: 'Curated news from sources you care about',
  icons: {
    icon: '/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${libreFranklin.variable} ${newsreader.variable}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme:dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})()`,
          }}
        />
      </head>
      <body className="font-sans text-ui">{children}</body>
    </html>
  );
}
