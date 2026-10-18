"use client";

import { SegmentedControl } from "@/components/ui/segmented-control";
import { useI18n } from "@/i18n/dictionary-provider";
import { setTheme, themes, useTheme } from "@/lib/theme";

export function AppearancePicker() {
  const { dict } = useI18n();
  const theme = useTheme();

  return (
    <div className="p-3">
      <SegmentedControl
        label={dict.settings.appearance}
        options={themes.map((value) => ({ value, label: dict.settings.themes[value] }))}
        value={theme}
        onChange={setTheme}
      />
    </div>
  );
}
