import type { Metadata } from "next";
import { ShoppingMeta } from "@/components/shopping/shopping-meta";
import { PageHeader } from "@/components/ui/page-header";
import { getDictionary } from "@/i18n/get-dictionary";
import { ShoppingView } from "./shopping-view";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).shopping.title };
}

export default async function ShoppingPage() {
  const dict = await getDictionary();

  return (
    <>
      <PageHeader title={dict.shopping.title} meta={<ShoppingMeta />} />
      <ShoppingView />
    </>
  );
}
