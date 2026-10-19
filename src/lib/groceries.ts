import type { Locale } from "@/i18n/config";

export type GroceryHint = { name: string; note: string | null };

const catalog: Record<Locale, string[]> = {
  he: [
    "חלב",
    "לחם",
    "ביצים",
    "גבינה לבנה",
    "קוטג'",
    "יוגורט",
    "חמאה",
    "שמנת מתוקה",
    "עגבניות",
    "מלפפונים",
    "חסה",
    "בצל",
    "שום",
    "גזר",
    "תפוחי אדמה",
    "בננות",
    "תפוחים",
    "אבוקדו",
    "לימון",
    "ענבים",
    "עגבניות שרי",
    "פלפל",
    "ברוקולי",
    "עוף",
    "בשר טחון",
    "שניצל",
    "דג",
    "טונה",
    "אורז",
    "פסטה",
    "קמח",
    "סוכר",
    "שמן זית",
    "מלח",
    "פלפל שחור",
    "רסק עגבניות",
    "חומוס",
    "טחינה",
    "פיתות",
    "חלות",
    "קפה",
    "תה",
    "מים",
    "חלב שקדים",
    "נייר טואלט",
    "נוזל כלים",
    "אבקת כביסה",
    "שקיות אשפה",
    "סבון ידיים",
    "שמפו",
  ],
  en: [
    "Milk",
    "Bread",
    "Eggs",
    "White cheese",
    "Cottage cheese",
    "Yogurt",
    "Butter",
    "Cream",
    "Tomatoes",
    "Cucumbers",
    "Lettuce",
    "Onion",
    "Garlic",
    "Carrots",
    "Potatoes",
    "Bananas",
    "Apples",
    "Avocado",
    "Lemon",
    "Grapes",
    "Cherry tomatoes",
    "Pepper",
    "Broccoli",
    "Chicken",
    "Ground beef",
    "Schnitzel",
    "Fish",
    "Tuna",
    "Rice",
    "Pasta",
    "Flour",
    "Sugar",
    "Olive oil",
    "Salt",
    "Black pepper",
    "Tomato paste",
    "Hummus",
    "Tahini",
    "Pita",
    "Challah",
    "Coffee",
    "Tea",
    "Water",
    "Almond milk",
    "Toilet paper",
    "Dish soap",
    "Laundry detergent",
    "Trash bags",
    "Hand soap",
    "Shampoo",
  ],
};

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/[\u0591-\u05C7]/g, "");
}

/** Names already used in this house come first, then common groceries. Exact echoes of the current fields are omitted. */
export function grocerySuggestions(
  locale: Locale,
  query: string,
  history: GroceryHint[],
  currentNote = "",
): GroceryHint[] {
  const q = normalize(query);
  if (!q) return [];

  const seen = new Set<string>();
  const pool: GroceryHint[] = [];
  const add = (item: GroceryHint) => {
    const key = normalize(item.name);
    if (!key || seen.has(key) || !key.includes(q)) return;
    seen.add(key);
    pool.push({ name: item.name, note: item.note?.trim() || null });
  };

  history.forEach(add);
  catalog[locale].forEach((name) => add({ name, note: null }));

  pool.sort((a, b) => Number(!normalize(a.name).startsWith(q)) - Number(!normalize(b.name).startsWith(q)));

  const note = currentNote.trim();
  return pool.filter((item) => !(normalize(item.name) === q && (item.note ?? "") === note)).slice(0, 6);
}
