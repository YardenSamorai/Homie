"use client";

import { useState } from "react";
import { Drawer } from "@base-ui/react/drawer";
import { Reorder, useDragControls } from "motion/react";
import { ChevronDown, ChevronUp, GripVertical } from "lucide-react";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Sheet, SheetBody, sheetGroup } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/i18n/dictionary-provider";
import { format } from "@/i18n/format";
import { useAuth } from "@/lib/auth/session";
import { compactRegions, defaultHomeLayout, isDefaultLayout, moveRegion, type HomeLayout, type HomeRegion } from "@/lib/home-layout";
import { usePrefs, usePrefsOf } from "@/lib/prefs-store";

function RegionRow({
  region,
  index,
  count,
  layout,
  onChange,
  onDragEnd,
}: {
  region: HomeRegion;
  index: number;
  count: number;
  layout: HomeLayout;
  onChange: (layout: HomeLayout, moved?: HomeRegion) => void;
  onDragEnd: () => void;
}) {
  const { dict } = useI18n();
  const copy = dict.homeLayout;
  const controls = useDragControls();
  const name = copy.regions[region];
  const hidden = layout.hidden.includes(region);
  const compact = layout.compact.includes(region);
  const move = (step: -1 | 1) => onChange(moveRegion(layout, region, step), region);
  const arrow = "flex size-11 shrink-0 items-center justify-center rounded-full text-label-secondary transition-transform duration-150 ease-out active:scale-[0.94] disabled:opacity-25";

  return (
    <Reorder.Item value={region} dragListener={false} dragControls={controls} onDragEnd={onDragEnd} as="li" className="relative bg-surface">
      <div className="flex min-h-14 flex-wrap items-center gap-x-1 pe-3 ps-1">
        <button
          type="button"
          aria-label={format(copy.drag, { name })}
          aria-describedby="home-layout-keys"
          onPointerDown={(event) => {
            event.stopPropagation();
            controls.start(event);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowUp" || event.key === "ArrowDown") {
              event.preventDefault();
              move(event.key === "ArrowUp" ? -1 : 1);
            }
          }}
          className="flex size-11 shrink-0 cursor-grab touch-none items-center justify-center text-label-tertiary active:cursor-grabbing"
        >
          <GripVertical aria-hidden size={20} />
        </button>
        <span className={`min-w-0 flex-1 basis-[6.5rem] py-1 text-[17px] leading-snug ${hidden ? "text-label-secondary" : ""}`}>{name}</span>
        <div className="ms-auto flex items-center gap-1">
          <button type="button" aria-label={format(copy.moveUp, { name })} disabled={index === 0} onClick={() => move(-1)} className={arrow}>
            <ChevronUp aria-hidden size={20} />
          </button>
          <button type="button" aria-label={format(copy.moveDown, { name })} disabled={index === count - 1} onClick={() => move(1)} className={arrow}>
            <ChevronDown aria-hidden size={20} />
          </button>
          <Switch
            checked={!hidden}
            label={format(copy.show, { name })}
            onChange={(on) => onChange({ ...layout, hidden: on ? layout.hidden.filter((r) => r !== region) : [...layout.hidden, region] })}
          />
        </div>
      </div>
      {compactRegions.includes(region) && !hidden && (
        <div className="pb-3 pe-3 ps-12">
          <SegmentedControl
            label={format(copy.form, { name })}
            value={compact ? "compact" : "detailed"}
            onChange={(value) =>
              onChange({ ...layout, compact: value === "compact" ? [...layout.compact, region] : layout.compact.filter((r) => r !== region) })
            }
            options={[
              { value: "detailed", label: copy.detailed },
              { value: "compact", label: copy.compact },
            ]}
          />
        </div>
      )}
    </Reorder.Item>
  );
}

/**
 * Arranging Today, for this parent only: drag by the handle, or move with the arrows or the arrow keys; show or
 * hide; detailed or compact. Each change is saved as it's made. Hiding deletes nothing and silences nothing.
 */
export function HomeLayoutSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { dict } = useI18n();
  const copy = dict.homeLayout;
  const userId = useAuth((s) => s.session?.userId) ?? "";
  const layout = usePrefsOf(userId, (prefs) => prefs.home);
  const update = usePrefs((s) => s.update);
  const [dragging, setDragging] = useState<HomeRegion[] | null>(null);
  const [status, setStatus] = useState<"idle" | "saved" | "failed">("idle");
  const [said, setSaid] = useState("");
  const order = dragging ?? layout.order;

  const save = (next: HomeLayout, moved?: HomeRegion) => {
    if (moved) {
      const place = next.order.indexOf(moved) + 1;
      setSaid(format(copy.moved, { name: copy.regions[moved], place: String(place), count: String(next.order.length) }));
    }
    void update(userId, "home", next).then((result) => setStatus(result === "saved" ? "saved" : "failed"));
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <div className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-x-3 px-4 pb-3 pt-1">
        <span />
        <Drawer.Title className="text-[17px] font-semibold">{copy.title}</Drawer.Title>
        <Drawer.Close className="justify-self-end py-2 text-[17px] font-semibold text-accent">{copy.done}</Drawer.Close>
      </div>
      <SheetBody>
        <Drawer.Description className="px-1 text-[15px] leading-snug text-label-secondary">{copy.lead}</Drawer.Description>
        <Reorder.Group axis="y" values={order} onReorder={setDragging} as="ul" className={sheetGroup}>
          {order.map((region, index) => (
            <RegionRow
              key={region}
              region={region}
              index={index}
              count={order.length}
              layout={{ ...layout, order }}
              onChange={save}
              onDragEnd={() => {
                if (dragging && dragging.join() !== layout.order.join()) save({ ...layout, order: dragging });
                setDragging(null);
              }}
            />
          ))}
        </Reorder.Group>
        <p id="home-layout-keys" className="-mt-3 px-1 text-[13px] text-label-secondary">
          {copy.keyboardHint}
        </p>
        <div className={sheetGroup}>
          <div className="flex min-h-12 items-center justify-between gap-3 px-4 py-2">
            <span className="text-[17px]">{copy.hideEmpty}</span>
            <Switch checked={layout.hideEmpty} label={copy.hideEmpty} onChange={(hideEmpty) => save({ ...layout, hideEmpty })} />
          </div>
        </div>
        <p className="-mt-3 px-1 text-[13px] leading-snug text-label-secondary">{copy.hideEmptyHint}</p>
        <div className="flex flex-col items-start gap-1 px-1">
          <button
            type="button"
            disabled={isDefaultLayout(layout)}
            onClick={() => {
              setSaid(copy.restored);
              save(defaultHomeLayout);
            }}
            className="min-h-11 text-[17px] font-medium text-accent active:opacity-60 disabled:opacity-40"
          >
            {copy.restore}
          </button>
          <p className="text-[13px] leading-snug text-label-secondary">{copy.restoreHint}</p>
        </div>
        <p aria-live="polite" className={`px-1 text-[13px] ${status === "failed" ? "text-danger" : "text-label-secondary"}`}>
          {status === "failed" ? copy.failed : said}
        </p>
      </SheetBody>
    </Sheet>
  );
}
