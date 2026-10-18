import { CalendarDays, House, ListChecks, Settings, ShoppingBasket, type LucideIcon } from "lucide-react";
import type { AddKind } from "@/lib/household-store";

export type NavItem = {
  key: "today" | "calendar" | "shopping" | "tasks" | "settings";
  path: string;
  icon: LucideIcon;
  /** Shown in the phone tab bar; settings is reached from the Today screen instead. */
  inTabBar: boolean;
  /** What "+" creates by default on this screen. */
  addKind: AddKind;
};

export const navItems: NavItem[] = [
  { key: "today", path: "", icon: House, inTabBar: true, addKind: "task" },
  { key: "calendar", path: "/calendar", icon: CalendarDays, inTabBar: true, addKind: "event" },
  { key: "shopping", path: "/shopping", icon: ShoppingBasket, inTabBar: true, addKind: "shopping" },
  { key: "tasks", path: "/tasks", icon: ListChecks, inTabBar: true, addKind: "task" },
  { key: "settings", path: "/settings", icon: Settings, inTabBar: false, addKind: "task" },
];

export function isActive(pathname: string, locale: string, path: string) {
  const href = `/${locale}${path}`;
  return path === "" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function addKindFor(pathname: string, locale: string): AddKind {
  return navItems.find((item) => isActive(pathname, locale, item.path))?.addKind ?? "task";
}
