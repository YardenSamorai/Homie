/** How much of a product: a number, and what it counts. A count without a unit is plain "2". */
export const UNITS = ["unit", "pack", "kg", "g", "l", "ml"] as const;
export type Unit = (typeof UNITS)[number];
export type Amount = { quantity: number | null; unit: Unit | null };

export const isUnit = (value: unknown): value is Unit => typeof value === "string" && (UNITS as readonly string[]).includes(value);

export const noAmount: Amount = { quantity: null, unit: null };

/** Quotes and geresh aside, so ק"ג, ק״ג and קג read the same. */
const bare = (word: string) => word.toLowerCase().replace(/['"׳״`’]/g, "");

const unitWords: Record<Unit, string[]> = {
  unit: ["יח", "יחידה", "יחידות", "unit", "units", "pc", "pcs", "piece", "pieces"],
  pack: ["אריזה", "אריזות", "חבילה", "חבילות", "מארז", "מארזים", "pack", "packs", "package", "packages", "pkg"],
  kg: ["קג", "קילו", "קילוגרם", "kg", "kgs", "kilo", "kilos", "kilogram", "kilograms"],
  g: ["גרם", "גר", "g", "gr", "gram", "grams"],
  l: ["ליטר", "ליטרים", "l", "lt", "liter", "liters", "litre", "litres"],
  ml: ["מל", "ml", "milliliter", "millilitre"],
};

const unitOf = new Map<string, Unit>();
for (const unit of UNITS) for (const word of unitWords[unit]) unitOf.set(word, unit);

/** A unit word, as written. A lone "ל" is only liters when it carries a geresh (ל׳), never the preposition. */
export function readUnit(word: string): Unit | null {
  const key = bare(word);
  if (key === "ל") return /['׳]/.test(word) ? "l" : null;
  return unitOf.get(key) ?? null;
}

const wordNumbers: Record<string, number> = {
  חצי: 0.5,
  half: 0.5,
  שני: 2,
  שתי: 2,
  שניים: 2,
  שתיים: 2,
  שלוש: 3,
  שלושה: 3,
  ארבע: 4,
  ארבעה: 4,
  חמש: 5,
  חמישה: 5,
  שש: 6,
  שישה: 6,
  תריסר: 12,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  dozen: 12,
};

const vulgar: Record<string, number> = { "½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3 };

/** A number as people write it on a list: 2, 1.5, 1/2, ½, 1½, "חצי", "two". Null for anything else. */
export function readNumber(word: string): number | null {
  const text = word.trim().toLowerCase();
  if (text in wordNumbers) return wordNumbers[text];
  const mixed = /^(\d+)?([½¼¾⅓⅔])$/.exec(text);
  if (mixed) return Number(mixed[1] ?? 0) + vulgar[mixed[2]];
  const fraction = /^(\d+)\/(\d+)$/.exec(text);
  if (fraction) return Number(fraction[2]) > 0 ? Number(fraction[1]) / Number(fraction[2]) : null;
  if (/^\d+(\.\d+)?$/.test(text)) return Number(text);
  return null;
}

const valid = (n: number | null): n is number => n !== null && Number.isFinite(n) && n > 0 && n < 100000;

const NUM = String.raw`(\d+(?:\.\d+)?|\d+\/\d+|\d*[½¼¾⅓⅔])`;
/** A number glued to its unit: 500g, 2ק"ג, 1.5l. */
const glued = new RegExp(String.raw`^${NUM}([^\d\s./½¼¾⅓⅔].*)$`, "u");

/** "500g" or "2" or "ק״ג": what one token says about the amount. */
function readToken(token: string): { quantity?: number; unit?: Unit } | null {
  const n = readNumber(token);
  if (valid(n)) return { quantity: n };
  const g = glued.exec(token);
  if (g) {
    const q = readNumber(g[1]);
    const unit = readUnit(g[2]);
    if (valid(q) && unit) return { quantity: q, unit };
  }
  return null;
}

export type ReadAmount = Amount & { name: string };

/**
 * Splits "2 ק״ג עגבניות", "חצי קילו גבינה", "milk 2l", "bread x2" into the product and its amount.
 * Only shapes that can't mean anything else are read; "חלב 3%" or "קולה 1.5" stay whole names.
 */
export function readAmount(text: string): ReadAmount {
  const clean = text.trim().replace(/\s+/g, " ");
  const tokens = clean.split(" ");
  const whole = { name: clean, ...noAmount };
  if (tokens.length < 2) return whole;

  // Leading: "2 חלב", "2 ק״ג תפוחים", "500g cheese", "קילו עגבניות", "חצי קילו גבינה".
  const first = readToken(tokens[0]);
  if (first?.quantity !== undefined) {
    const unit = first.unit ?? (tokens.length > 2 ? readUnit(tokens[1]) : null);
    const rest = tokens.slice(first.unit || !unit ? 1 : 2);
    if (rest.length > 0 && !/^[%x×*]/.test(rest[0])) return { name: rest.join(" "), quantity: first.quantity, unit: unit ?? null };
    return whole;
  }
  const leadUnit = readUnit(tokens[0]);
  if (leadUnit && leadUnit !== "unit" && bare(tokens[0]).length > 1) return { name: tokens.slice(1).join(" "), quantity: 1, unit: leadUnit };

  // Trailing: "חלב 2 ליטר", "milk 2l", "bread x2", "לחם ×2".
  const last = tokens[tokens.length - 1];
  const times = /^[x×*](\d+)$/i.exec(last);
  if (times && tokens.length > 1) return { name: tokens.slice(0, -1).join(" "), quantity: Number(times[1]), unit: null };
  const tail = readToken(last);
  if (tail?.unit && tail.quantity !== undefined) return { name: tokens.slice(0, -1).join(" "), quantity: tail.quantity, unit: tail.unit };
  if (tokens.length > 2) {
    const unit = readUnit(last);
    const n = readNumber(tokens[tokens.length - 2]);
    if (unit && valid(n)) return { name: tokens.slice(0, -2).join(" "), quantity: n, unit };
  }
  return whole;
}

/**
 * The old free-text "quantity or note" field, read as an amount only when that's all it says:
 * "2", "2 ליטר", "חצי קילו", "x3". Anything else ("2 גדולים", "של תנובה", "2-3") stays a note, untouched.
 */
export function readLegacyNote(note: string | null): Amount | null {
  const text = note?.trim().replace(/\s+/g, " ");
  if (!text) return null;
  const times = /^[x×*]\s?(\d+)$/i.exec(text) ?? /^(\d+)\s?[x×*]$/i.exec(text);
  if (times) return { quantity: Number(times[1]), unit: null };
  const tokens = text.split(" ");
  if (tokens.length === 1) {
    const one = readToken(tokens[0]);
    if (one?.quantity !== undefined && /^[\d½¼¾⅓⅔]/.test(tokens[0])) return { quantity: one.quantity, unit: one.unit ?? null };
    return null;
  }
  if (tokens.length === 2) {
    const n = readNumber(tokens[0]);
    const unit = readUnit(tokens[1]);
    if (valid(n) && unit) return { quantity: n, unit };
    const lead = readUnit(tokens[0]);
    const after = readNumber(tokens[1]);
    if (lead && valid(after)) return { quantity: after, unit: lead };
  }
  return null;
}

const family = (unit: Unit | null) => (unit === "kg" || unit === "g" ? "mass" : unit === "l" || unit === "ml" ? "volume" : unit === "pack" ? "pack" : "count");
const base = (unit: Unit | null) => (unit === "kg" || unit === "l" ? 1000 : 1);

const round = (n: number) => Math.round(n * 1000) / 1000;

/** The sum of two amounts when they count the same thing (kilos and grams too), in the first one's unit. */
export function addAmounts(a: Amount, b: Amount): Amount | null {
  if (a.quantity === null || b.quantity === null) return null;
  if (family(a.unit) !== family(b.unit)) return null;
  const total = a.quantity * base(a.unit) + b.quantity * base(b.unit);
  return { quantity: round(total / base(a.unit)), unit: a.unit };
}

export const sameAmount = (a: Amount, b: Amount) =>
  a.quantity === b.quantity && (a.unit ?? "unit") === (b.unit ?? "unit");

/**
 * What merging two items' amounts can come to. `pick` is the one shown first, or null when the amounts
 * can't be added (liters and packs) and a parent has to choose.
 */
export function mergeAmounts(a: Amount, b: Amount): { options: Amount[]; pick: number | null } {
  if (a.quantity === null && b.quantity === null) return { options: [noAmount], pick: 0 };
  if (a.quantity === null) return { options: [b], pick: 0 };
  if (b.quantity === null) return { options: [a], pick: 0 };
  const sum = addAmounts(a, b);
  const options: Amount[] = [];
  for (const option of [sum, a, b]) if (option && !options.some((known) => sameAmount(known, option))) options.push(option);
  return { options, pick: sum ? 0 : null };
}

/** "2", "1.5 ק״ג", "½ ליטר": short enough for the row. Labels come from the dictionary. */
export function formatAmount(
  amount: Amount,
  locale: string,
  labels: { one: Record<Unit, string>; many: Record<Unit, string> },
): string | null {
  if (amount.quantity === null) return null;
  const n = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(amount.quantity);
  if (!amount.unit) return n;
  return `${n} ${(amount.quantity === 1 ? labels.one : labels.many)[amount.unit]}`;
}
