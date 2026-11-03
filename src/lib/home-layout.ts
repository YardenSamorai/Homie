/**
 * How one parent arranges Today: the order of its regions, which are hidden, which are compact, and whether an
 * empty region steps aside. Only how Today is drawn for this person; hiding a region deletes nothing and
 * silences nothing. A region added to Homie later joins at its default place for everyone who never moved it.
 */

export const homeRegions = ["note", "members", "agenda", "tasks", "shopping", "tomorrow", "activity"] as const;
export type HomeRegion = (typeof homeRegions)[number];

/** Regions with a shorter form. */
export const compactRegions: readonly HomeRegion[] = ["agenda", "shopping", "tomorrow", "activity"];

export type HomeLayout = {
  order: HomeRegion[];
  hidden: HomeRegion[];
  compact: HomeRegion[];
  hideEmpty: boolean;
};

export const defaultHomeLayout: HomeLayout = { order: [...homeRegions], hidden: [], compact: [], hideEmpty: true };

const known = (value: unknown): value is HomeRegion => homeRegions.includes(value as HomeRegion);

export function readHomeLayout(raw: unknown): HomeLayout {
  const value = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const stored = Array.isArray(value.order) ? [...new Set(value.order.filter(known))] : [];
  const order = [...stored];
  // A region this parent has never seen goes where it sits by default: after the region before it there.
  homeRegions.forEach((region, index) => {
    if (order.includes(region)) return;
    const before = homeRegions.slice(0, index).reverse().find((r) => order.includes(r));
    order.splice(before ? order.indexOf(before) + 1 : 0, 0, region);
  });
  const list = (key: string, allowed: readonly HomeRegion[] = homeRegions) =>
    Array.isArray(value[key]) ? [...new Set((value[key] as unknown[]).filter((r): r is HomeRegion => known(r) && allowed.includes(r)))] : [];
  return {
    order,
    hidden: list("hidden"),
    compact: list("compact", compactRegions),
    hideEmpty: typeof value.hideEmpty === "boolean" ? value.hideEmpty : true,
  };
}

/** One step earlier (-1) or later (+1) in the order. */
export function moveRegion(layout: HomeLayout, region: HomeRegion, step: -1 | 1): HomeLayout {
  const order = [...layout.order];
  const at = order.indexOf(region);
  const to = at + step;
  if (at < 0 || to < 0 || to >= order.length) return layout;
  [order[at], order[to]] = [order[to], order[at]];
  return { ...layout, order };
}

export const isDefaultLayout = (layout: HomeLayout) =>
  layout.order.join() === defaultHomeLayout.order.join() && layout.hidden.length === 0 && layout.compact.length === 0 && layout.hideEmpty;
