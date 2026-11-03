import { Card } from "@/components/ui/card";
import { GuideReplay } from "@/components/shell/guide-replay";
import { NotificationsCard } from "@/components/shell/activity";
import { InstallCard } from "@/components/shell/install";
import { getDictionary } from "@/i18n/get-dictionary";
import { AppearanceEditor } from "./appearance/appearance-editor";
import { CalendarColorsCard } from "./appearance/calendar-colors";
import { HomeLayoutCard } from "./appearance/home-layout-card";
import { ShareLookCard } from "./appearance/share-look";
import { CalendarsCard } from "./calendars-card";
import { HouseholdCard } from "./household-card";
import { HouseholdName } from "./household-name";
import { InviteCard } from "./invite-card";
import { LanguagePicker } from "./language-picker";
import { AboutCard, DeleteAccount, MyName, NewTaskDefaults, NotificationPrefs, PrivacyCard } from "./preferences";
import { ProfilePhoto } from "./profile-photo";
import { RoutineCard } from "./routine-card";
import { SectionHeader, type SettingsSection } from "./sections";
import { SignOut } from "./sign-out";

function Section({ section, children }: { section: SettingsSection; children: React.ReactNode }) {
  return (
    <>
      <SectionHeader section={section} />
      <div className="flex flex-col gap-8">{children}</div>
    </>
  );
}

export async function ProfileContent() {
  const dict = await getDictionary();
  return (
    <Section section="profile">
      <ProfilePhoto />
      <MyName />
      <Card title={dict.settings.language}>
        <LanguagePicker />
      </Card>
    </Section>
  );
}

export async function HouseContent() {
  const dict = await getDictionary();
  return (
    <Section section="house">
      <Card title={dict.settings.homeName}>
        <HouseholdName />
      </Card>
      <Card title={dict.settings.household}>
        <HouseholdCard />
      </Card>
      <InviteCard />
    </Section>
  );
}

export function AppearanceContent() {
  return (
    <Section section="appearance">
      <AppearanceEditor />
      <HomeLayoutCard />
      <CalendarColorsCard />
      <ShareLookCard />
    </Section>
  );
}

export function NotificationsContent() {
  return (
    <Section section="notifications">
      <NotificationsCard />
      <RoutineCard />
      <NotificationPrefs />
      <NewTaskDefaults />
    </Section>
  );
}

export function CalendarsContent() {
  return (
    <Section section="calendars">
      <CalendarsCard />
    </Section>
  );
}

export async function AccountContent() {
  const dict = await getDictionary();
  return (
    <Section section="account">
      <Card title={dict.settings.account}>
        <SignOut />
      </Card>
      <PrivacyCard />
      <DeleteAccount />
    </Section>
  );
}

export async function HelpContent() {
  const dict = await getDictionary();
  return (
    <Section section="help">
      <Card title={dict.settingsNav.guidesTitle}>
        <p className="px-4 pt-3 text-[15px] leading-snug text-label-secondary">{dict.settingsNav.guidesBody}</p>
        <GuideReplay />
      </Card>
      <InstallCard />
      <AboutCard />
    </Section>
  );
}
