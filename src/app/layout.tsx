import type { Metadata } from 'next';
import Script from 'next/script';
import { SidebarNav } from '@/components/SidebarNav';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import './globals.css';

export const metadata: Metadata = {
  title: 'Crescent Properties',
  description: 'Crescent Properties listing review and analysis app',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Script id="crescent-theme-init" strategy="beforeInteractive">
          {`(function(){try{var k='crescent-theme',t=localStorage.getItem(k),a=['dark','light','dusk','dawn'];if(a.indexOf(t)>-1)document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`}
        </Script>
        <div className="shell">
          <aside className="sidebar">
            <div className="brand">
              <div className="brand-mark" aria-hidden="true">
                <svg viewBox="0 0 64 64" role="img">
                  <path className="brand-moon" d="M43.8 7.8c-8.7 2.4-15 10.3-15 19.7 0 11.3 9.2 20.5 20.5 20.5 2.2 0 4.3-.3 6.2-1A25.2 25.2 0 1 1 43.8 7.8Z" />
                  <path className="brand-house" d="M14 34.8 31.8 20 49.6 34.8v20.4H37.8V42.5h-12v12.7H14V34.8Z" />
                  <path className="brand-roof" d="M10.5 36.9 31.8 19.2 53.1 36.9" />
                </svg>
              </div>
              <div>
                <strong>Crescent Properties</strong>
                <span>Zillow intake, underwriting, and pipeline review</span>
              </div>
            </div>
            <SidebarNav />
            <ThemeSwitcher />
          </aside>
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  );
}
