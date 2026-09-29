import type { Metadata } from "next";
import { Zen_Kaku_Gothic_New, Zen_Old_Mincho } from "next/font/google";
import "./globals.css";
import { NavBar } from "@/components/NavBar";

// Sans japonesa para toda la interfaz — reemplaza a Inter.
const zenSans = Zen_Kaku_Gothic_New({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "700"],
});

// Serif japonesa para titulares y números. Es lo que le da a SINKA su aire
// de wabi-sabi (tinta, washi) en vez de panel de control genérico: los
// títulos grandes usan esta tipografía, todo lo demás sigue en la sans.
const zenSerif = Zen_Old_Mincho({
  subsets: ["latin"],
  variable: "--font-serif",
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
    <html lang="es" className={`${zenSans.variable} ${zenSerif.variable}`}>
      <body className="font-sans antialiased">
        <NavBar />
        {children}
      </body>
    </html>
  );
}
