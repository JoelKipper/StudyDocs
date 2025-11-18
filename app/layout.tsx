import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StudyDocs - Student File Manager",
  description: "Dateiverwaltung für Studenten",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}

