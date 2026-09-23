import type { Metadata } from "next";
import { Inter, Fraunces } from "next/font/google";
import "./globals.css";
import { NavBar } from "@/components/NavBar";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

// Serif editorial para titulares. Es lo que le da a SINKA su aire de diario
// o bitácora en vez de panel de control genérico: los títulos grandes usan
// esta tipografía, todo lo demás sigue en Inter.
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-serif",
  style: ["normal", "italic"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "SINKA — Concentración Colaborativa",
  description: "Sesiones Pomodoro cooperativas con emparejamiento aleatorio.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${inter.variable} ${fraunces.variable}`}>
      <body className="font-sans antialiased">
        <NavBar />
        {children}
      </body>
    </html>
  );
}
