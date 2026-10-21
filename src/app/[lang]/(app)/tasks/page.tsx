import type { Metadata } from "next";
import { getDictionary } from "@/i18n/get-dictionary";
import { TasksView } from "./tasks-view";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).tasks.title };
}

export default function TasksPage() {
  return <TasksView />;
}
