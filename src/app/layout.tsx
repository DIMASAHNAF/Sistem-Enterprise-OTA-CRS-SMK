import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SMK Enterprise OTA & CRS — Reservasi Tiket & Operasional Pariwisata',
  description:
    'Sistem Enterprise Computer Reservation System (CRS) dan Online Travel Agent (OTA) untuk praktik ULP/ULW & Kunjungan Industri SMK.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>{children}</body>
    </html>
  );
}
