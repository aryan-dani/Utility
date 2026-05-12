import { getTopics } from "@/lib/dataFetcher";
import { BookMarked, Layers, CircleDot } from "lucide-react";

export default function SyllabusPage() {
  const topics = getTopics();

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto px-6 py-8 min-h-[80vh]">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Syllabus Directory
          </h1>
          <p className="text-muted text-sm mt-1">
            Track and master your coursework comprehensively.
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-surface border border-border text-foreground font-medium text-sm">
          <Layers className="w-4 h-4 text-muted" />
          <span>{topics.length} Units Found</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {topics.map((t, idx) => (
          <div key={idx} className="bg-white border border-border p-6 rounded-lg shadow-sm hover:shadow transition-shadow">
            <div className="flex justify-between items-start mb-4 border-b border-border pb-4">
              <div className="flex gap-3 items-start">
                <div className="w-10 h-10 rounded bg-surface flex items-center justify-center border border-border flex-shrink-0 text-foreground">
                  <BookMarked className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground mb-0.5 leading-tight">
                    {t.subject}
                  </h2>
                  <p className="text-sm font-medium text-muted">Unit {t.unit}</p>
                </div>
              </div>
            </div>

            <ul className="space-y-3 mt-4">
              {t.topics.map((sub, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2.5"
                >
                  <CircleDot className="w-4 h-4 text-muted mt-0.5 flex-shrink-0" />
                  <span className="text-foreground text-sm font-medium leading-relaxed">{sub}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}

        {topics.length === 0 && (
          <div className="col-span-2 flex flex-col items-center justify-center p-12 text-center border border-dashed border-border rounded-lg bg-surface">
            <BookMarked className="w-10 h-10 text-muted mb-3" />
            <p className="text-lg font-semibold text-foreground mb-1">No Syllabus Found</p>
            <p className="text-sm text-muted">Configure subjects in your topics.json to see them here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
