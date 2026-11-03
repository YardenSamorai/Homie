import { readAmount, type Unit } from "./quantity";

/**
 * One product found in what was typed or pasted. `unsure`: it was split off at an "ו"/"and" only because
 * both halves look like products, so the preview asks before treating them as two.
 */
export type ParsedItem = { text: string; name: string; quantity: number | null; unit: Unit | null; unsure: boolean };

/** Whether a phrase names a product the app or this house knows. */
export type Known = (name: string) => boolean;

const MAQAF = "[־\\-–]";
const vavDigit = new RegExp(`^ו${MAQAF}?\\d`);
const vavMaqaf = new RegExp(`^ו${MAQAF}(.+)$`);

/**
 * Where a run of words splits at a conjunction. A digit right after it ("ו־6 עגבניות") or a hyphen ("ו־חלב")
 * is a sure split; a bare "ו" glued to a word ("לחם וחלב") splits only when the word without it is a product,
 * the word with it isn't ("וניל", "ופל") and the words before it are one too.
 */
function splitWords(words: string[], known: Known): { words: string[]; unsure: boolean }[] {
  const parts: { words: string[]; unsure: boolean }[] = [];
  let current: string[] = [];
  let unsure = false;
  const close = (nextUnsure: boolean) => {
    if (current.length > 0) parts.push({ words: current, unsure });
    current = [];
    unsure = nextUnsure;
  };

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const lower = word.toLowerCase();
    if (current.length === 0) {
      current.push(word);
      continue;
    }
    const restOfLine = words.slice(i + 1).join(" ");
    if (word === "ו" || lower === "&") {
      close(false);
      continue;
    }
    if (lower === "and") {
      const next = words[i + 1] ?? "";
      if (/^\d/.test(next) || (known(current.join(" ")) && known(restOfLine))) {
        close(!/^\d/.test(next));
        continue;
      }
    }
    if (vavDigit.test(word)) {
      close(false);
      current.push(word.replace(new RegExp(`^ו${MAQAF}?`), ""));
      continue;
    }
    const hyphen = vavMaqaf.exec(word);
    if (hyphen) {
      close(false);
      current.push(hyphen[1]);
      continue;
    }
    if (word.startsWith("ו") && word.length > 2) {
      const stripped = word.slice(1);
      const tail = [stripped, ...words.slice(i + 1)].join(" ");
      const looksLikeTwo =
        (known(stripped) || known(tail)) && !known(word) && !known([word, ...words.slice(i + 1)].join(" ")) && known(current.join(" "));
      if (looksLikeTwo) {
        close(true);
        current.push(stripped);
        continue;
      }
    }
    current.push(word);
  }
  close(false);
  return parts;
}

const bullet = /^\s*(?:[-•*·]|\d+[.)])\s+/;

/**
 * "2 חלב, לחם מלא ו־6 עגבניות" or "2 milk, bread, 6 tomatoes", or a pasted list, one per line:
 * every product with its amount. Commas, semicolons and new lines always separate; conjunctions only
 * as `splitWords` allows. A list's bullets and numbering ("1. חלב") aren't quantities.
 */
export function parseItems(input: string, known: Known): ParsedItem[] {
  const lines = input.split(/\r?\n/);
  const listy = lines.filter((line) => line.trim()).length > 1;
  const items: ParsedItem[] = [];
  for (const rawLine of lines) {
    const line = listy ? rawLine.replace(bullet, "") : rawLine.replace(/^\s*[-•*·]\s+/, "");
    for (const chunk of line.split(/[,;،]/)) {
      const words = chunk.trim().split(/\s+/).filter(Boolean);
      if (words.length === 0) continue;
      for (const part of splitWords(words, known)) {
        const text = part.words.join(" ");
        const amount = readAmount(text);
        if (!amount.name) continue;
        items.push({ text, name: amount.name, quantity: amount.quantity, unit: amount.unit, unsure: part.unsure });
      }
    }
  }
  return items;
}
