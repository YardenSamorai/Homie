/** Shared pressable styles. Sage fill is the brand; pale coral on cream was reading as a blank pill. */

const press =
  "transition-transform duration-150 ease-out active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none";

export const btnPrimary =
  `inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-accent px-5 text-[17px] font-semibold text-accent-contrast shadow-[0_8px_20px_color-mix(in_oklab,var(--accent)_30%,transparent),inset_0_1px_0_rgb(255_255_255/0.28)] ${press}`;

export const btnSecondary =
  `inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-surface px-5 text-[17px] font-semibold text-accent shadow-card ring-1 ring-[color-mix(in_oklab,var(--accent)_28%,transparent)] ${press}`;

export const btnSuccess =
  `inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-success px-5 text-[17px] font-semibold text-white shadow-[0_8px_20px_color-mix(in_oklab,var(--success)_28%,transparent),inset_0_1px_0_rgb(255_255_255/0.28)] ${press}`;

export const btnGhost =
  `inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full px-4 text-[15px] font-semibold text-label-secondary ${press}`;

export const btnPrimarySm =
  `inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-accent px-5 text-[15px] font-semibold text-accent-contrast shadow-[0_6px_16px_color-mix(in_oklab,var(--accent)_28%,transparent),inset_0_1px_0_rgb(255_255_255/0.28)] ${press}`;

export const btnSecondarySm =
  `inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-surface px-4 text-[15px] font-semibold text-accent shadow-card ring-1 ring-[color-mix(in_oklab,var(--accent)_28%,transparent)] ${press}`;
