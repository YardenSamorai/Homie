import { AddSheet } from "@/components/add/add-sheet";
import { ConnectionBanner } from "@/components/shell/connection-banner";
import { HouseholdSeeder } from "@/components/shell/household-seeder";
import { SheetDepth } from "@/components/shell/sheet-depth";
import { Sidebar } from "@/components/shell/sidebar";
import { TabBar } from "@/components/shell/tab-bar";

export default function AppLayout({ children }: LayoutProps<"/[lang]">) {
  return (
    <div className="flex min-h-dvh">
      <HouseholdSeeder />
      <ConnectionBanner />
      <Sidebar />
      <SheetDepth className="mx-auto w-full max-w-2xl flex-1 px-4 pb-32 pt-safe md:px-8 md:pb-12">{children}</SheetDepth>
      <TabBar />
      <AddSheet />
    </div>
  );
}
