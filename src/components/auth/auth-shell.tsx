"use client";

import type { CSSProperties } from "react";
import { HomieMark } from "@/components/brand/homie-mark";

const vars = (values: Record<string, string>) => values as CSSProperties;

/**
 * The onboarding steps after sign-in (name, home, invite, join), in the same language as the door:
 * warm light and rings around whatever this step is about, and the form anchored low, within thumb reach.
 * The entrance is CSS, so it plays from the first paint.
 */
export function AuthShell({
  title,
  lead,
  eyebrow,
  hero,
  children,
  footer,
  busy = false,
}: {
  title?: string;
  lead?: string;
  eyebrow?: string;
  /** What sits at the center of the rings. Defaults to the Homie icon. */
  hero?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  /** Kept for callers; layout no longer differs by size. */
  size?: "mid" | "tall";
  busy?: boolean;
}) {
  const reveal = (order: number) => ({ style: vars({ "--d": `${0.35 + order * 0.07}s` }) });

  return (
    <main
      aria-busy={busy || undefined}
      className="relative flex min-h-dvh flex-col bg-bg lg:grid lg:h-dvh lg:min-h-[40rem] lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] [@media(min-width:640px)_and_(max-height:560px)]:grid [@media(min-width:640px)_and_(max-height:560px)]:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)]"
    >
      <div className="relative min-h-[max(10rem,30dvh)] flex-1 lg:m-3 lg:overflow-hidden lg:rounded-[36px] lg:bg-[color-mix(in_oklab,var(--sage-light)_45%,var(--bg))]">
        <div className="absolute inset-x-0 bottom-0 top-[env(safe-area-inset-top)] lg:top-0">
          <ShellStage busy={busy}>{hero}</ShellStage>
        </div>
      </div>

      <div className="relative shrink-0 px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2 lg:flex lg:flex-col lg:items-center lg:justify-center lg:px-12 lg:pb-12 [@media(min-width:640px)_and_(max-height:560px)]:flex [@media(min-width:640px)_and_(max-height:560px)]:flex-col [@media(min-width:640px)_and_(max-height:560px)]:justify-center [@media(min-width:640px)_and_(max-height:560px)]:overflow-y-auto [@media(min-width:640px)_and_(max-height:560px)]:py-4">
        <div className="mx-auto flex w-full max-w-[24.5rem] flex-col">
          {eyebrow && (
            <p style={reveal(0).style} className="mb-1.5 text-[14px] font-semibold text-accent door-rise">
              {eyebrow}
            </p>
          )}
          {title && (
            <h1
              style={reveal(1).style}
              className="text-[clamp(2rem,8.6vw,2.5rem)] leading-[1.06] font-bold tracking-[-0.02em] break-words text-balance lg:text-[2.75rem] door-rise"
            >
              {title}
            </h1>
          )}
          {lead && (
            <p style={reveal(2).style} className="mt-2 text-[16px] leading-[1.5] text-label/[0.72] text-pretty door-rise">
              {lead}
            </p>
          )}
          {children && (
            <div style={reveal(3).style} className="mt-6 flex flex-col door-rise">
              {children}
            </div>
          )}
          {footer && (
            <div style={reveal(4).style} className="mt-4 text-center text-[15px] text-label/[0.72] door-rise">
              {footer}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function ShellStage({ busy, children }: { busy: boolean; children?: React.ReactNode }) {
  return (
    <div aria-hidden={children ? undefined : true} className="door-stage relative isolate size-full overflow-hidden">
      <div className="door-glow absolute inset-0 -z-10" />
      {/* Same anchor as the door: a zero-size point at the center that rings and hero hang off. */}
      <div className="door-shrink absolute left-1/2 top-1/2 size-0 lg:scale-[1.25]">
        {[0, 1, 2].map((ring) => (
          <span key={ring} className="door-ring-in absolute left-0 top-0 size-0" style={vars({ "--d": `${0.12 + ring * 0.08}s` })}>
            <span
              className="door-ring door-drift absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                width: `${8.75 + ring * 6.25}rem`,
                height: `${8.75 + ring * 6.25}rem`,
                ...vars({ "--float": `${11 + ring * 2}s`, "--d": `${1.2 + ring * 0.4}s` }),
              }}
            />
          </span>
        ))}
        <span className="door-fade-in absolute left-0 top-0 size-0" style={vars({ "--d": "0.2s" })}>
          <span className="door-halo door-breathe absolute left-0 top-0 size-[11rem] -translate-x-1/2 -translate-y-1/2 rounded-full" />
        </span>
        <div className="door-mark-in absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2" style={vars({ "--d": "0s" })}>
          {children ?? (busy ? <span className="block size-[88px] animate-pulse rounded-[21px] bg-fill" /> : <HomieMark size={88} />)}
        </div>
      </div>
    </div>
  );
}

const press =
  "transition-[scale,box-shadow,filter,opacity] duration-200 ease-[var(--ease-out-strong)] active:scale-[0.97] active:duration-100 focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-50";

/** The door's primary button: full color with a soft top light and a shadow the color of the fill. */
export const primaryClass = `relative inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-accent bg-[linear-gradient(180deg,rgb(255_255_255/0.16),rgb(255_255_255/0)_62%)] px-5 text-[17px] font-semibold tracking-[-0.01em] text-accent-contrast shadow-[inset_0_1px_0_rgb(255_255_255/0.22),0_1px_2px_rgb(37_79_65/0.22),0_12px_26px_-12px_color-mix(in_oklab,var(--accent)_80%,transparent)] hover:brightness-[1.05] active:brightness-95 ${press}`;
export const homeClass = primaryClass;
export const successClass = `relative inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-green bg-[linear-gradient(180deg,rgb(255_255_255/0.16),rgb(255_255_255/0)_62%)] px-5 text-[17px] font-semibold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.22),0_12px_26px_-12px_color-mix(in_oklab,var(--green)_80%,transparent)] ${press}`;
export const secondaryClass = `relative inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-surface px-5 text-[17px] font-semibold text-accent shadow-[0_1px_2px_rgb(40_30_20/0.05)] ring-1 ring-[color-mix(in_oklab,var(--accent)_28%,transparent)] hover:bg-[color-mix(in_oklab,var(--accent)_5%,var(--surface))] ${press}`;
export const ghostClass = `inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full px-4 text-[15px] font-semibold text-label/[0.72] hover:bg-fill ${press}`;

export const fieldClass =
  "h-[3.625rem] w-full rounded-[16px] bg-surface px-4 text-[17px] text-label shadow-[0_1px_2px_rgb(40_30_20/0.05)] outline-none ring-1 ring-[light-dark(rgb(40_30_20/0.1),rgb(255_255_255/0.12))] transition-[box-shadow] duration-200 ease-[var(--ease-out-strong)] placeholder:text-label/45 focus:shadow-[0_0_0_5px_color-mix(in_oklab,var(--accent)_14%,transparent)] focus:ring-2 focus:ring-accent";
