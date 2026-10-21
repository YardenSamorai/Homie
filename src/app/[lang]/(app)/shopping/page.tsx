import type { Metadata } from "next";
import { getDictionary } from "@/i18n/get-dictionary";
import { ShoppingView } from "./shopping-view";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).shopping.title };
}

export default function ShoppingPage() {
  return <ShoppingView />;
}
