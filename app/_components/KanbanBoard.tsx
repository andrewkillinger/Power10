import type { Article, Journalist } from "@/lib/types";
import { JournalistColumn } from "./JournalistColumn";

export function KanbanBoard({
  journalists,
  articlesByJournalist,
}: {
  journalists: Journalist[];
  articlesByJournalist: Map<string, Article[]>;
}) {
  return (
    <div className="relative">
      <div
        className="flex min-h-[calc(100vh-120px)] gap-4 overflow-x-auto px-6 pb-10 pt-4 scrollbar-thin"
      >
        {journalists.map((j) => (
          <JournalistColumn
            key={j.id}
            journalist={j}
            articles={articlesByJournalist.get(j.id) ?? []}
          />
        ))}
      </div>
    </div>
  );
}
