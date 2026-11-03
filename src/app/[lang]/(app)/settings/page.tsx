import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { getDictionary } from "@/i18n/get-dictionary";
import { ProfileContent } from "./contents";
import { LegacyCalendarsRedirect } from "./legacy-redirect";
import { SettingsList } from "./sections";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).settingsNav.title };
}

export default async function SettingsPage() {
  const dict = await getDictionary();
  return (
    <>
      <Suspense>
        <LegacyCalendarsRedirect />
      </Suspense>
      <div className="lg:hidden">
        <PageHeader title={dict.settingsNav.title} subtitle={dict.settingsNav.lead} />
        <SettingsList />
      </div>
      <div className="hidden lg:block">
        <ProfileContent />
      </div>
    </>
  );
}
