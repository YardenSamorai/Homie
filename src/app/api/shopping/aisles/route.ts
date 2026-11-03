import { NextResponse } from "next/server";
import { AISLES, isAisle, type Aisle } from "@/lib/aisles";
import { itemKey } from "@/lib/groceries";
import { supabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabase } from "@/lib/supabase/server";

const MAX_NAMES = 40;

const PROMPT = `You sort a shared grocery list into supermarket aisles for a household in Israel.
Items are in Hebrew or English and may include brand names, typos, quantities or personal notes.
For every input item, by its index, choose exactly one aisle:
- produce: fresh fruit, vegetables and herbs
- bakery: bread, pita, challah, rolls, cakes and pastries
- meat: meat, poultry, fish and deli meats such as pastrami or salami
- dairy: milk, cheese, yogurt, butter, cream, eggs and chilled dairy desserts
- pantry: dry and canned food, pasta, rice, grains, oil, sauces, spreads, spices, baking goods, cereal, coffee and tea, pickles, dips such as hummus or tahini
- snacks: chips, sweets, chocolate, cookies, crackers and snack nuts
- drinks: water, soft drinks, juice, alcohol and plant milks
- frozen: frozen food and ice cream
- cleaning: cleaning and laundry products, paper towels, toilet paper, wipes, trash bags, foil and wrap
- care: personal hygiene, cosmetics, baby care and pharmacy items
- other: only what a supermarket doesn't sell or what fits nowhere else
Answer for every index.`;

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["index", "aisle"],
        properties: { index: { type: "integer" }, aisle: { type: "string", enum: AISLES } },
      },
    },
  },
};

/** One call for the whole batch. Null when there's no key or the AI didn't answer in time. */
async function classify(names: string[]): Promise<(Aisle | null)[] | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key || names.length === 0) return null;
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        messages: [
          { role: "system", content: PROMPT },
          { role: "user", content: JSON.stringify(names.map((name, index) => ({ index, name }))) },
        ],
        response_format: { type: "json_schema", json_schema: { name: "aisles", strict: true, schema } },
      }),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const parsed = JSON.parse(body.choices?.[0]?.message?.content ?? "{}") as { items?: { index?: unknown; aisle?: unknown }[] };
    const found: (Aisle | null)[] = names.map(() => null);
    for (const item of parsed.items ?? []) {
      if (typeof item.index === "number" && item.index in found && isAisle(item.aisle)) found[item.index] = item.aisle;
    }
    return found;
  } catch {
    return null;
  }
}

/** Where these products go: what the house already knows, then the AI for the rest, which the house then remembers. */
export async function POST(request: Request) {
  if (!supabaseConfigured()) return NextResponse.json({ error: "generic" }, { status: 404 });
  const body = (await request.json().catch(() => ({}))) as { names?: unknown };
  const names = [
    ...new Set(
      (Array.isArray(body.names) ? body.names : [])
        .filter((name): name is string => typeof name === "string")
        .map((name) => name.trim().slice(0, 120))
        .filter(Boolean),
    ),
  ].slice(0, MAX_NAMES);
  if (names.length === 0) return NextResponse.json({ aisles: {} });

  const db = await createServerSupabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const { data: membership } = await db.from("household_members").select("household_id").eq("user_id", user.id).maybeSingle();
  if (!membership) return NextResponse.json({ error: "missing" }, { status: 404 });
  const household = membership.household_id as string;

  const keys = new Map(names.map((name) => [name, itemKey(name)]));
  const { data: remembered } = await db
    .from("shopping_categories")
    .select("item_key, category")
    .eq("household_id", household)
    .in("item_key", [...new Set(keys.values())]);
  const memory = new Map((remembered ?? []).flatMap((row) => (isAisle(row.category) ? [[row.item_key as string, row.category]] : [])));

  const aisles: Record<string, Aisle> = {};
  const unknown: string[] = [];
  for (const name of names) {
    const known = memory.get(keys.get(name)!);
    if (known) aisles[name] = known;
    else unknown.push(name);
  }

  const answers = await classify(unknown);
  if (answers) {
    const learned = new Map<string, Aisle>();
    unknown.forEach((name, index) => {
      const aisle = answers[index];
      if (!aisle) return;
      aisles[name] = aisle;
      learned.set(keys.get(name)!, aisle);
    });
    if (learned.size > 0) {
      // A parent's own choice (or the other phone's answer) wins over this one.
      await db.from("shopping_categories").upsert(
        [...learned].map(([key, category]) => ({ household_id: household, item_key: key, category, source: "ai" })),
        { onConflict: "household_id,item_key", ignoreDuplicates: true },
      );
    }
  }

  return NextResponse.json({ aisles });
}
