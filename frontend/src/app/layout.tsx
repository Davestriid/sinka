import type { Metadata } from "next";
import { Zen_Kaku_Gothic_New, Zen_Old_Mincho } from "next/font/google";
import "./globals.css";
import { NavBar } from "@/components/NavBar";
import { ThemeProvider } from "@/components/ThemeProvider";
import { I18nProvider } from "@/components/I18nProvider";

// Se aplica el tema guardado ANTES de que React hidrate, corriendo como
// script normal (no un módulo, no bloquea el parseo del resto del <head>).
// Sin esto, la primera pintura siempre sería oscura y quien eligió "Claro"
// vería un parpadeo oscuro→claro cada vez que carga la página.
const SCRIPT_TEMA_INICIAL = `
(function () {
  try {
    var t = window.localStorage.getItem("sinka-theme");
    if (t === "light" || t === "dark") {
      document.documentElement.setAttribute("data-theme", t);
    }
  } catch (e) {}
})();
`;

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
    <html lang="es" className={`${zenSans.variable} ${zenSerif.variable}`} suppressHydrationWarning>
      <head>
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA_INICIAL }} />
      </head>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <ThemeProvider>
          <I18nProvider>
            <NavBar />
            {children}
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
