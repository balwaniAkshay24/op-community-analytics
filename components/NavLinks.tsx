"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { FEATURES } from "@/lib/features";
import { LinkPending } from "./LinkPending";

const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/messages", label: "Messages" },
  { href: "/voice", label: "Voice" },
  { href: "/members", label: "Members" },
  { href: "/invites", label: "Invites" },
  ...(FEATURES.activities
    ? [{ href: "/activities", label: "Activities" }]
    : []),
];

function isCurrent(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavLinks() {
  const pathname = usePathname() ?? "/";
  const navRef = useRef<HTMLElement>(null);

  // On phones the tabs scroll sideways; keep the current one in view.
  useEffect(() => {
    const nav = navRef.current;
    const current = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !current) return;
    const left =
      current.offsetLeft - (nav.clientWidth - current.offsetWidth) / 2;
    nav.scrollTo({ left: Math.max(0, left) });
  }, [pathname]);

  return (
    <nav ref={navRef} className="nav" aria-label="Sections">
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="nav-link"
          aria-current={isCurrent(pathname, link.href) ? "page" : undefined}
        >
          {link.label}
          <LinkPending />
        </Link>
      ))}
    </nav>
  );
}
