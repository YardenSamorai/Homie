import { ConnectionBanner } from "@/components/shell/connection-banner";

export default function AuthLayout({ children }: LayoutProps<"/[lang]">) {
  return (
    <div className="min-h-dvh bg-bg">
      <ConnectionBanner />
      {children}
    </div>
  );
}
