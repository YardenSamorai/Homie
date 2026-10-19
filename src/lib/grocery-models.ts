/** Grocery models that can ride in the cart. Names match what people type, in both languages. */
const models: { src: string; names: string[] }[] = [
  { src: "/models/groceries/milk.glb", names: ["חלב", "milk"] },
  { src: "/models/groceries/pasta.glb", names: ["פסטה", "pasta"] },
  { src: "/models/groceries/juice.glb", names: ["מיץ תפוזים", "orange juice"] },
  { src: "/models/groceries/banana.glb", names: ["בננה", "בננות", "banana", "bananas"] },
  { src: "/models/groceries/tomato.glb", names: ["עגבניה", "עגבניות", "tomato", "tomatoes"] },
  { src: "/models/groceries/carrot.glb", names: ["גזר", "גזרים", "carrot", "carrots"] },
  { src: "/models/groceries/lettuce.glb", names: ["חסה", "lettuce"] },
  { src: "/models/groceries/baguette.glb", names: ["בגט", "לחם", "baguette", "bread"] },
  { src: "/models/groceries/apple.glb", names: ["תפוח", "תפוחים", "apple", "apples"] },
];

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/[\u0591-\u05C7]/g, "");
}

export function groceryModelFor(name: string) {
  const key = normalize(name);
  return models.find((model) => model.names.some((alias) => normalize(alias) === key))?.src ?? null;
}
