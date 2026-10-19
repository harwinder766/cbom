'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import GooeyNav from '@/components/GooeyNav';
import { getActiveScanId } from '@/lib/api';

const BASE_NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Scan',      href: '/scan'      },
  { label: 'Artefacts', href: '/artefacts' },
  { label: 'Risk Graph',href: '/risk-graph'},
  { label: 'Reports',   href: '/reports'   },
];

export default function AppNav() {
  const pathname = usePathname();
  const [activeScanId, setActiveScanId] = useState<string>('latest');

  useEffect(() => {
    setActiveScanId(getActiveScanId());
  }, [pathname]);

  // Resolve which tab is active based on current route
  const activeIndex = Math.max(
    BASE_NAV_ITEMS.findIndex((item) => pathname.startsWith(item.href)),
    0
  );

  const isScan = pathname.startsWith('/scan');

  // Preserve active scan ID across navigation
  const navItems = BASE_NAV_ITEMS.map((item) => ({
    label: item.label,
    href:
      activeScanId && activeScanId !== 'latest' && item.href !== '/scan'
        ? `${item.href}?scan_id=${activeScanId}`
        : item.href,
  }));

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-colors duration-300 ${
        isScan
          ? 'bg-transparent border-b border-white/10 backdrop-blur-xl'
          : 'bg-black border-b border-white/10'
      }`}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-6">
        {/* Brand */}
        <a
          href="/"
          className="flex items-center gap-2 font-bold text-base tracking-tight text-white hover:text-white/80 transition-colors shrink-0 focus:outline-none focus:ring-2 focus:ring-white/40 rounded"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          <span className="h-2 w-2 rounded-full bg-white shadow-[0_0_10px_#ffffff]" />
          CBOM · PQ Readiness
        </a>

        {/* GooeyNav — centered nav tabs */}
        <GooeyNav
          items={navItems}
          initialActiveIndex={activeIndex}
          animationTime={500}
          particleCount={12}
          particleDistances={[80, 8]}
          particleR={80}
          timeVariance={250}
          colors={[1, 2, 3, 1, 2, 3, 1, 4]}
        />
      </div>
    </header>
  );
}
