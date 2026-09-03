"use client";

import { Home, Search, Camera } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/search", label: "Search", icon: Search },
  { href: "/scanner", label: "Scan", icon: Camera },
];

export function BottomNav() {
  const pathname = usePathname();
  if (pathname.startsWith("/onboarding") || pathname.startsWith("/auth"))
    return null;
  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-3 z-40 flex justify-center px-4">
      <div className="pointer-events-auto flex h-16 w-full max-w-md items-center justify-around rounded-full border border-border/60 bg-card/90 px-3 shadow-[0_8px_30px_rgb(0,0,0,0.08)] backdrop-blur-xl">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-w-16 flex-col items-center gap-0.5 rounded-full px-4 py-1.5 text-xs font-medium transition-all",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <item.icon
                className={cn("h-5 w-5", isActive && "stroke-[2.2]")}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}