import { LayoutDashboard, ListTodo, NotebookPen, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: "/" | "/tasks" | "/journal";
  label: string;
  shortLabel: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Overview", shortLabel: "Overview", icon: LayoutDashboard },
  { href: "/tasks", label: "Tasks", shortLabel: "Tasks", icon: ListTodo },
  { href: "/journal", label: "Daily Journal", shortLabel: "Journal", icon: NotebookPen },
];

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
