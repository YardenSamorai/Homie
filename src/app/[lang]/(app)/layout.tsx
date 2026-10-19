import { AddSheet } from "@/components/add/add-sheet";
import { ConnectionBanner } from "@/components/shell/connection-banner";
import { HouseholdSync } from "@/components/shell/household-sync";
import { OnboardingGate } from "@/components/shell/onboarding-gate";
import { ScrollEdges } from "@/components/shell/scroll-edges";
import { SheetDepth } from "@/components/shell/sheet-depth";
import { Sidebar } from "@/components/shell/sidebar";
import { ScreenGuide } from "@/components/shell/screen-guide";
import { TabBar } from "@/components/shell/tab-bar";

export default function AppLayout({ children }: LayoutProps<"/[lang]">) {
  return (
    <OnboardingGate>
    <div className="flex min-h-dvh">
      <HouseholdSync />
      <ConnectionBanner />
      <Sidebar />
      <SheetDepth className="mx-auto w-full max-w-2xl flex-1 px-4 pb-32 pt-safe md:px-8 md:pb-12">{children}</SheetDepth>
      <ScrollEdges />
      <ScreenGuide />
      <TabBar />
      <AddSheet />
    </div>
    </OnboardingGate>
  );
}
