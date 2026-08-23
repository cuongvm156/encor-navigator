import { Link } from "@tanstack/react-router";
import {
  BookOpen,
  ChartNoAxesColumn,
  Headphones,
  Home,
  NotebookPen,
  Settings,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

interface NavItem {
  to: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
}

const navItems: NavItem[] = [
  { to: "/", label: "Dashboard", shortLabel: "Home", icon: Home },
  { to: "/course", label: "Learn", shortLabel: "Learn", icon: BookOpen },
  { to: "/audio", label: "Audio", shortLabel: "Audio", icon: Headphones },
  { to: "/notes", label: "Notes & Bookmarks", shortLabel: "Notes", icon: NotebookPen },
  { to: "/progress", label: "Progress", shortLabel: "Progress", icon: ChartNoAxesColumn },
  { to: "/settings", label: "Settings", shortLabel: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-border bg-sidebar px-4 py-6 md:flex">
        <div className="px-2">
          <p className="text-sm font-semibold tracking-tight text-sidebar-foreground">
            ENCOR Study
          </p>
          <p className="mt-1 text-xs text-muted-foreground">CCNP 350-401</p>
        </div>
        <nav className="mt-8 flex flex-col gap-1">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.to === "/" }}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[status=active]:bg-sidebar-accent data-[status=active]:font-medium data-[status=active]:text-sidebar-accent-foreground"
            >
              <item.icon className="size-4" strokeWidth={1.75} />
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      <header className="sticky top-0 z-20 border-b border-border bg-background/90 px-4 py-3 backdrop-blur md:hidden">
        <p className="text-sm font-semibold tracking-tight">ENCOR Study</p>
      </header>

      <main className="px-4 pt-6 pb-24 md:ml-60 md:px-10 md:pt-10 md:pb-12">
        <div className="mx-auto w-full max-w-4xl">{children}</div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-6 border-t border-border bg-background/95 backdrop-blur md:hidden">
        {navItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            activeOptions={{ exact: item.to === "/" }}
            className="flex flex-col items-center gap-1 py-2 text-[10px] text-muted-foreground transition-colors data-[status=active]:text-foreground"
          >
            <item.icon className="size-5" strokeWidth={1.75} />
            {item.shortLabel}
          </Link>
        ))}
      </nav>
    </div>
  );
}
