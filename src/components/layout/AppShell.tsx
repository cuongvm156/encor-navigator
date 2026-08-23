import { Link, useNavigate } from "@tanstack/react-router";
import {
  BookOpen,
  ChartNoAxesColumn,
  Headphones,
  Home,
  CloudDownload,
  MoreHorizontal,
  NotebookPen,
  Search,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

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
  { to: "/offline", label: "Offline", shortLabel: "Offline", icon: CloudDownload },
  { to: "/settings", label: "Settings", shortLabel: "Settings", icon: Settings },
];

const mobilePrimary = navItems.slice(0, 4);
const mobileMore = navItems.slice(4);

export function AppShell({ children }: { children: ReactNode }) {
  const [moreOpen, setMoreOpen] = useState(false);

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

      <main className="px-4 pt-6 pb-32 md:ml-60 md:px-10 md:pt-10 md:pb-12">
        <div className="mx-auto w-full max-w-4xl">{children}</div>
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 overflow-hidden border-t border-border bg-background/95 backdrop-blur md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        aria-label="Primary"
      >
        {mobilePrimary.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            activeOptions={{ exact: item.to === "/" }}
            className="flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] text-muted-foreground transition-colors data-[status=active]:font-medium data-[status=active]:text-foreground"
          >
            <item.icon className="size-5" strokeWidth={1.75} />
            <span className="truncate">{item.shortLabel}</span>
          </Link>
        ))}

        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              className="flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] text-muted-foreground transition-colors data-[state=open]:font-medium data-[state=open]:text-foreground"
            >
              <MoreHorizontal className="size-5" strokeWidth={1.75} />
              <span className="truncate">More</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-xl">
            <SheetHeader className="text-left">
              <SheetTitle className="text-sm">More</SheetTitle>
            </SheetHeader>
            <div
              className="mt-2 flex flex-col gap-1 pb-4"
              style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}
            >
              {mobileMore.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMoreOpen(false)}
                  className="flex min-h-12 items-center gap-3 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-accent data-[status=active]:bg-accent data-[status=active]:font-medium data-[status=active]:text-foreground"
                >
                  <item.icon className="size-4" strokeWidth={1.75} />
                  {item.label}
                </Link>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </nav>
    </div>
  );
}
