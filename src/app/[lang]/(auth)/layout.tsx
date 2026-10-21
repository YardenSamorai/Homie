import { ConnectionBanner } from "@/components/shell/connection-banner";

export default function AuthLayout({ children }: LayoutProps<"/[lang]">) {
  return (
    <div className="keyboard-fit bg-bg">
      <ConnectionBanner />
      {children}
    </div>
  );
}
