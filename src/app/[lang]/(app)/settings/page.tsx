import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getDictionary } from "@/i18n/get-dictionary";
import { AppearancePicker } from "./appearance-picker";
import { HouseholdCard } from "./household-card";
import { InviteCard } from "./invite-card";
import { GuideReplay } from "@/components/shell/guide-replay";
import { LanguagePicker } from "./language-picker";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).settings.title };
}

export default async function SettingsPage() {
  const dict = await getDictionary();

  return (
    <>
      <PageHeader title={dict.settings.title} subtitle={dict.settings.lead} />
      <div className="flex flex-col gap-8">
        <Card title={dict.settings.household}>
          <HouseholdCard />
        </Card>
        <Card title={dict.settings.invite}>
          <InviteCard />
        </Card>
        <Card title={dict.settings.appearance}>
          <AppearancePicker />
        </Card>
        <Card title={dict.settings.language}>
          <LanguagePicker />
          <GuideReplay />
        </Card>
      </div>
    </>
  );
}
