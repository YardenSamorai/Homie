import { OnboardSky } from "@/components/auth/onboard-sky";

/** Setup, join, and invite keep the painted house. Sign-in does not. */
export default function HouseAuthLayout({ children }: LayoutProps<"/[lang]">) {
  return (
    <div className="flex min-h-dvh max-h-dvh flex-col overflow-hidden bg-bg">
      <div className="relative min-h-[36dvh] flex-1 overflow-hidden">
        <OnboardSky />
      </div>
      {children}
    </div>
  );
}
