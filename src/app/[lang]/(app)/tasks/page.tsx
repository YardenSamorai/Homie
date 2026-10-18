import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { getDictionary } from "@/i18n/get-dictionary";
import { TasksView } from "./tasks-view";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).tasks.title };
}

export default async function TasksPage() {
  const dict = await getDictionary();

  return (
    <>
      <PageHeader title={dict.tasks.title} />
      <TasksView />
    </>
  );
}
