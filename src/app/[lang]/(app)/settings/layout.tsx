import { SettingsNav } from "./sections";

/** Settings: a list of sections on the phone, each its own screen; on a wide screen the sections stay beside it. */
export default function SettingsLayout({ children }: LayoutProps<"/[lang]/settings">) {
  return (
    <div data-wide-page className="lg:grid lg:grid-cols-[13.5rem_minmax(0,1fr)] lg:gap-10 xl:grid-cols-[15rem_minmax(0,1fr)]">
      <SettingsNav />
      <div className="@container min-w-0">{children}</div>
    </div>
  );
}
