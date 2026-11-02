import Link from "next/link";
import { ArrowLeft } from "@/components/Icons";

export const metadata = { title: "Privacy · Class Worlds" };

const SECTIONS: { title: string; body: string }[] = [
  {
    title: "What we store",
    body: "The teacher's email address and a secure hash of their password (never the password itself), class names, students' first names or nicknames, the points they earn and the reasons chosen for those points.",
  },
  {
    title: "What we don't store",
    body: "Students have no accounts, no email addresses and no passwords. We ask teachers to use first names or nicknames only. There are no ads and we don't sell any data.",
  },
  {
    title: "Who can see it",
    body: "Only the signed-in teacher who owns a class can open it. Students see what the teacher shows on the class screen. Points are hidden on that screen unless the teacher turns them on.",
  },
  {
    title: "Where it is kept",
    body: "Login and class data are held by Supabase, and the website runs on Vercel. These servers may be outside the UAE. If your school needs data kept in a particular country, please ask before adding students.",
  },
  {
    title: "Removing data",
    body: "A teacher can remove a student or delete a whole class from the Teacher page at any time. That permanently removes its students and points. To remove a teacher account, ask the person who set up Class Worlds for your school.",
  },
];

export default function PrivacyPage() {
  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-4 py-8 sm:py-12">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="cw-eyebrow">Class Worlds</p>
          <h1 className="cw-title mt-2 text-4xl text-white sm:text-5xl">Privacy</h1>
        </div>
        <Link href="/" className="cw-menu-btn !w-auto shrink-0 !py-2 text-sm">
          <ArrowLeft size={16} />
          Menu
        </Link>
      </header>
      {SECTIONS.map((s) => (
        <section key={s.title} className="cw-panel mb-4 p-5">
          <h2 className="cw-heading text-base text-white">{s.title}</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-text/85">{s.body}</p>
        </section>
      ))}
    </main>
  );
}
