import Link from "next/link";
import { ChevronRight, ShoppingBasket } from "lucide-react";
import { Card } from "@/components/ui/card";
import { IconTile } from "@/components/ui/icon-tile";
import { ShoppingProgress, ShoppingSummary } from "@/components/today/shopping-summary";
import { TodayView } from "@/components/today/today-view";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";

export default async function TodayPage() {
  const locale = await getLocale();
  const dict = await getDictionary();

  return (
    <div className="pt-4 md:pt-10">
      <TodayView>
        <Card title={dict.today.shopping}>
          <Link
            href={`/${locale}/shopping`}
            className="flex min-h-14 items-center gap-3 rounded-card px-4 transition-[background-color,scale] duration-150 ease-out active:scale-[0.98] active:bg-fill hover:bg-fill"
          >
            <ShoppingProgress>
              <IconTile icon={ShoppingBasket} color="var(--green)" />
            </ShoppingProgress>
            <span className="flex flex-1 flex-col">
              <span className="text-[17px]">{dict.today.openList}</span>
              <ShoppingSummary />
            </span>
            <ChevronRight aria-hidden size={20} className="text-label-tertiary rtl:-scale-x-100" />
          </Link>
        </Card>
      </TodayView>
    </div>
  );
}
