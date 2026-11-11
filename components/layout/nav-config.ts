import {
  CalendarCheck,
  ChartLine,
  Goal,
  NotebookPen,
  LayoutDashboard,
  Quote,
  Repeat,
  Settings,
  Timer,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** shown in the mobile bottom bar */
  primary?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, primary: true },
  { href: "/planner", label: "Daily Planner", icon: CalendarCheck, primary: true },
  { href: "/activities", label: "Activity Log", icon: Timer, primary: true },
  { href: "/habits", label: "Habits", icon: Repeat, primary: true },
  { href: "/goals", label: "Goals", icon: Goal },
  { href: "/performance", label: "Performance", icon: ChartLine },
  { href: "/reviews", label: "Reviews", icon: NotebookPen },
  { href: "/affirmations", label: "Affirmations", icon: Quote },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
