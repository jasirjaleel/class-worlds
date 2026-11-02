"use client";

import Link from "next/link";
import { ArrowLeft } from "@/components/Icons";
import { classProgress } from "@/lib/progress";
import { REASONS } from "@/lib/reasons";
import { useClassroom } from "@/lib/useClassroom";
import { useCurrentClass } from "@/lib/useCurrentClass";

export default function ProgressPage() {
  const current = useCurrentClass();
  const classroom = useClassroom(current.classId);
  const rows = classroom ? classProgress(classroom) : [];

  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-4 py-8 sm:py-12">
      <header className="cw-rise mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="cw-eyebrow">{classroom?.name ?? "Teacher"}</p>
          <h1 className="cw-title mt-2 text-4xl text-white sm:text-5xl">Progress</h1>
          <p className="mt-3 text-sm text-muted">Only you can see this page, so avoid showing it on the class screen. Weeks start on Monday.</p>
        </div>
        <Link href="/teacher" className="cw-menu-btn !w-auto shrink-0 !py-2 text-sm">
          <ArrowLeft size={16} />
          Teacher
        </Link>
      </header>

      {classroom && rows.length === 0 ? <p className="cw-panel p-5 text-sm text-muted">Add students on the Teacher page to see their progress.</p> : null}

      <ul className="flex flex-col gap-2.5">
        {rows.map((r) => (
          <li key={r.id} className="cw-panel p-4">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="flex min-w-32 flex-1 items-center gap-2 font-semibold text-white">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: r.color }} />
                <span className="truncate">{r.name}</span>
              </span>
              <dl className="flex gap-5 text-right text-sm">
                <Stat label="This week" value={r.thisWeek} strong />
                <Stat label="Last week" value={r.lastWeek} />
                <Stat label="Total" value={r.total} />
              </dl>
            </div>
            {r.reasons.length ? (
              <p className="mt-2 text-sm text-muted">{r.reasons.map((x) => `${REASONS[x.reason].button} ${x.points}`).join(" · ")}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </main>
  );
}

function Stat({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={strong ? "cw-heading text-lg text-gold" : "cw-heading text-lg text-white"}>{value}</dd>
    </div>
  );
}
