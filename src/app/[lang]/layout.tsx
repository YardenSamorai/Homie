import type { Metadata, Viewport } from "next";
import { Heebo } from "next/font/google";
import { locales, localeDirection } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { skyScript } from "@/lib/sky";
import splashScreens from "@/lib/splash-screens.json";
import { themeScript } from "@/lib/theme-script";
import { Providers } from "../providers";
import "../globals.css";

const heebo = Heebo({
  variable: "--font-heebo",
  subsets: ["hebrew", "latin"],
});

export async function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return {
    title: { default: dict.meta.title, template: `%s · ${dict.meta.title}` },
    description: dict.meta.description,
    applicationName: "Homie",
    appleWebApp: { capable: true, title: "Homie", statusBarStyle: "default", startupImage: splashScreens },
    // iOS before 16.4 opens full screen from this tag rather than the manifest.
    other: { "apple-mobile-web-app-capable": "yes" },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f7f2" },
    { media: "(prefers-color-scheme: dark)", color: "#121614" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/[lang]">) {
  const locale = await getLocale();
  const dict = await getDictionary();

  return (
    <html lang={locale} dir={localeDirection[locale]} className={`${heebo.variable} h-full`} suppressHydrationWarning>
      <body className="min-h-full" suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: skyScript }} />
        <Providers locale={locale} dict={dict}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
