import { OnboardSky } from "@/components/auth/onboard-sky";
import { ConnectionBanner } from "@/components/shell/connection-banner";

export default function AuthLayout({ children }: LayoutProps<"/[lang]">) {
  return (
    <div className="flex min-h-dvh max-h-dvh flex-col overflow-hidden bg-bg">
      <div className="relative min-h-[36dvh] flex-1 overflow-hidden">
        <OnboardSky />
      </div>
      <ConnectionBanner />
      {children}
    </div>
  );
}
