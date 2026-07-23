import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MatchLobby - Real-Time Tournament & Debate Platform',
  description: 'Pro competitive match lobby with real-time video/voice roster, 3-session chat, multi-page shared strategy notes & admin host master suite.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 min-h-screen font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
