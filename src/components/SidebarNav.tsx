'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, Cog, Database, Home, LayoutDashboard, Settings, Users, Workflow } from 'lucide-react';

const mainNav = [
  { href: '/', label: 'Overview', icon: Home },
  { href: '/data', label: 'Listing Data', icon: Database },
  { href: '/insights', label: 'Insights', icon: LayoutDashboard },
  { href: '/partners', label: 'Partners', icon: Users },
  { href: '/assumptions', label: 'Underwriting', icon: Settings },
  { href: '/workflows', label: 'Ingestion Logs', icon: Workflow },
  { href: '/settings', label: 'Settings', icon: Cog },
] as const;

function linkActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="nav">
      {mainNav.map(({ href, label, icon: Icon }) => {
        const active = linkActive(pathname, href);
        return (
          <Link key={href} href={href} className={active ? 'active' : undefined} aria-current={active ? 'page' : undefined}>
            <Icon size={18} />
            {label}
          </Link>
        );
      })}
      <Link
        href="/api/health"
        className={pathname.startsWith('/api/health') ? 'active' : undefined}
        aria-current={pathname.startsWith('/api/health') ? 'page' : undefined}
      >
        <BarChart3 size={18} />
        Health
      </Link>
    </nav>
  );
}
