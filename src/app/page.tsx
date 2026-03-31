import Image from "next/image";
import Link from "next/link";
import { getPublicDepartmentSummaries } from "@/lib/public-departments";

const coreValues = [
  "Passion Towards Work",
  "Respect for People",
  "Integrity in Every Transaction",
  "Dedication for Results",
  "Empowerment for Development",
];

export default async function Home() {
  const departments = await getPublicDepartmentSummaries(4);

  return (
    <main className="bg-[#eef1fb] text-[#0d1635]">
      <section className="border-b border-slate-200/70 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-5 sm:px-6 lg:px-10">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="https://lakshyamailerimages.s3.ap-south-1.amazonaws.com/Lg.png"
              alt="Lakshya logo"
              width={160}
              height={48}
              className="h-12 w-auto object-contain"
            />
            {/* <p className="text-lg font-extrabold tracking-[-0.04em] text-[#0d1635]">Lakshya</p> */}
          </Link>

          <nav className="hidden items-center gap-8 text-sm text-slate-600 lg:flex">
            <a href="#about" className="transition hover:text-slate-950">
              About Us
            </a>
            <a href="#departments" className="transition hover:text-slate-950">
              SOP
            </a>
            <a href="#values" className="transition hover:text-slate-950">
              Core Values
            </a>
            <a href="#mission" className="transition hover:text-slate-950">
              Mission
            </a>
            <a href="#vision" className="transition hover:text-slate-950">
              Vision
            </a>
          </nav>

        </div>
      </section>

      <section className="bg-[#0d2d63]">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-[1.05fr_0.95fr] lg:px-10">
          <div className="flex gap-5">
            <div className="hidden w-px bg-[#f1b82c] lg:block" />
            <div className="max-w-2xl">
              <p className="text-[11px] uppercase tracking-[0.35em] text-[#d6ad45]">Education. Careers. Excellence.</p>
              <h1 className="mt-5 text-5xl leading-[0.95] font-extrabold tracking-[-0.06em] text-white sm:text-6xl">
                Lakshya shapes students into <span className="text-[#ffd15c]">skilled professionals.</span>
              </h1>
              <p className="mt-7 max-w-xl text-base leading-7 text-slate-200">
                With over a decade as educators and career advisors, we help students overcome educational
                challenges, build professional competence, and transition confidently into an ever-evolving business
                environment.
              </p>

              <div className="mt-9 flex flex-wrap gap-4">
                <a
                  href="#departments"
                  className="rounded-sm border border-[#d6ad45] bg-[#d6ad45] px-5 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#0d1635] transition hover:bg-[#e6bf58]"
                >
                  Explore SOP Library
                </a>
                <a
                  href="#about"
                  className="rounded-sm border border-white/25 px-5 py-3 text-xs font-semibold uppercase tracking-[0.16em] !text-white transition hover:border-white/40 hover:bg-white/8 hover:!text-white"
                >
                  About Us
                </a>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-[#173971] p-6 shadow-[0_24px_80px_rgba(2,10,28,0.35)]">
            <div className="rounded-[24px] bg-[radial-gradient(circle_at_top,#2d5c9e_0%,#16386d_45%,#0f2b56_100%)] p-8 text-white">
              <p className="text-xs uppercase tracking-[0.28em] text-[#d6ad45]">Why Lakshya</p>
              <div className="mt-8 space-y-6">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
                  <p className="text-lg font-semibold">Expert Faculty</p>
                  <p className="mt-2 text-sm leading-7 text-slate-200">
                    Our faculty includes top-rated Chartered Accountants and industry-specific trainers.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
                  <p className="text-lg font-semibold">Curated Syllabus</p>
                  <p className="mt-2 text-sm leading-7 text-slate-200">
                    We value time and money, which is why our learning paths are carefully designed for results.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
                  <p className="text-lg font-semibold">Corporate Readiness</p>
                  <p className="mt-2 text-sm leading-7 text-slate-200">
                    Leadership, corporate behaviour, and effective exam preparation are built into the learning
                    experience.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="about" className="bg-[#f5f7fd]">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-20 lg:px-10">
          <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr]">
            <div className="rounded-3xl bg-[linear-gradient(135deg,#11629d_0%,#164f85_100%)] p-8 text-white shadow-[0_20px_50px_rgba(17,64,109,0.2)]">
              <p className="text-[11px] uppercase tracking-[0.35em] text-[#ffd15c]">About Us</p>
              <h2 className="mt-4 text-4xl font-extrabold tracking-[-0.05em]">Your benchmark for educational success.</h2>
              <p className="mt-6 text-sm leading-7 text-slate-100">
                At Lakshya, yesterday&apos;s success is today&apos;s benchmark, and we intend on providing nothing but
                the best.
              </p>
            </div>

            <div className="rounded-3xl border border-white/70 bg-white px-7 py-8 shadow-[0_18px_45px_rgba(13,22,53,0.06)]">
              <p className="text-base leading-8 text-slate-600">
                Lakshya empowers students to be skilled professionals and helps them address all aspects of educational
                challenges to meet their optimal educational goals. With over a decade as educators and career
                advisors, we mould the careers of students to help them be competent professionals ready to enter into
                the ever-evolving business environment.
              </p>
              <p className="mt-5 text-base leading-8 text-slate-600">
                We understand the importance and value of time and money; which is precisely why we have a team of
                dedicated and knowledgeable learning professionals who have profound subject-matter expertise and
                deliver our well-curated syllabus.
              </p>
              <p className="mt-5 text-base leading-8 text-slate-600">
                Our list of faculties ranges from top-rated Chartered Accountants to industry-specific trainers. We
                believe in equipping our students with powerful soft skills like leadership, corporate behaviour and
                effective exam preparation in our module so that their transition to the corporate world can be
                seamless. We welcome you to Lakshya to explore more and realise your dreams.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="departments" className="bg-[#eef1fb]">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-20 lg:px-10">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold text-[#115b95]">Explore published SOPs by department</p>
              <p className="mt-3 max-w-xl text-base leading-7 text-slate-600">
                Browse the latest department-wise SOP library and open the full directory for deeper access.
              </p>
            </div>

            <Link
              href="/departments"
              className="inline-flex items-center justify-center rounded-xl bg-[#0d1635] px-6 py-3 text-sm font-semibold !text-white transition hover:bg-[#162550] hover:!text-white"
            >
              Browse All SOP Departments
            </Link>
          </div>

          <div className="mt-8 max-w-2xl">
            <p className="text-[11px] uppercase tracking-[0.35em] text-[#b58e39]">SOP</p>
            <h2 className="mt-4 text-4xl font-extrabold tracking-[-0.05em] text-[#0d1635] sm:text-5xl">
              Department-Wise SOP Access
            </h2>
          </div>

          {departments.length === 0 ? (
            <div className="mt-12 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-slate-500">
              No departments available yet.
            </div>
          ) : (
            <div className="mt-12 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
              {departments.map((department) => (
                <article
                  key={department.id}
                  className="rounded-3xl border border-[#dfe7f7] bg-white px-6 py-6 shadow-[0_16px_38px_rgba(13,22,53,0.06)] transition hover:-translate-y-1 hover:shadow-[0_22px_45px_rgba(13,22,53,0.10)]"
                >
                  <p className="text-[10px] uppercase tracking-[0.24em] text-slate-400">
                    {department.code?.trim() || "Department"}
                  </p>
                  <h3 className="mt-4 text-2xl font-bold tracking-[-0.04em] text-[#0d1635]">{department.name}</h3>
                  <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
                    <p className="text-sm font-medium text-slate-500">
                      {department.sopCount} {department.sopCount === 1 ? "SOP" : "SOPs"}
                    </p>
                    <span className="rounded-full bg-[#edf4ff] px-3 py-1 text-xs font-semibold text-[#115b95]">
                      View Directory
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <section id="values" className="bg-[#115b95]">
        <div className="mx-auto max-w-7xl px-4 py-16 text-white sm:px-6 md:py-20 lg:px-10">
          <div className="max-w-4xl">
            <p className="text-[11px] uppercase tracking-[0.35em] text-[#ffd15c]">Core Values</p>
            <h2 className="mt-4 text-5xl font-extrabold tracking-[-0.05em]">Core Values</h2>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-2">
            {coreValues.map((value) => (
              <div
                key={value}
                className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 px-5 py-5 shadow-[0_12px_28px_rgba(4,18,39,0.18)]"
              >
                <span className="text-2xl font-bold text-[#f7bf2a]">&gt;</span>
                <p className="text-2xl font-semibold tracking-[-0.03em]">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#f8f9fe]">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-20 lg:px-10">
          <div className="grid gap-6 xl:grid-cols-2">
            <article
              id="mission"
              className="rounded-3xl bg-[#115b95] px-8 py-10 text-white shadow-[0_22px_55px_rgba(17,64,109,0.18)]"
            >
              <p className="text-[11px] uppercase tracking-[0.35em] text-[#ffd15c]">Mission</p>
              <h2 className="mt-4 text-5xl font-extrabold tracking-[-0.05em]">MISSION</h2>
              <p className="mt-8 max-w-2xl text-xl leading-10 text-slate-100">
                To Transform Lives Through Affordable, Quality &amp; Value-based Education.
              </p>
            </article>

            <article
              id="vision"
              className="rounded-3xl bg-[#115b95] px-8 py-10 text-white shadow-[0_22px_55px_rgba(17,64,109,0.18)]"
            >
              <p className="text-[11px] uppercase tracking-[0.35em] text-[#ffd15c]">Vision</p>
              <h2 className="mt-4 text-5xl font-extrabold tracking-[-0.05em]">VISION</h2>
              <p className="mt-8 max-w-2xl text-xl leading-10 text-slate-100">A Lakshyan in Every Global Brand</p>
            </article>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200/70 bg-[#f6f8fd]">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 text-sm text-slate-500 sm:px-6 lg:grid-cols-[1.4fr_0.7fr_0.7fr] lg:px-10">
          <div>
            <p className="text-lg font-extrabold tracking-[-0.04em] text-[#0d1635]">Lakshya</p>
            <p className="mt-4 max-w-sm leading-7">
              Quality, value-based education designed to help students become confident professionals.
            </p>
            <p className="mt-8 text-xs uppercase tracking-[0.16em] text-slate-400">
              (C) 2026 Lakshya. All rights reserved.
            </p>
          </div>

          <div>
            <p className="text-[11px] uppercase tracking-[0.35em] text-slate-400">Quick Links</p>
            <div className="mt-4 space-y-3">
              <p>About Us</p>
              <p>Mission</p>
              <p>Vision</p>
            </div>
          </div>

          <div>
            <p className="text-[11px] uppercase tracking-[0.35em] text-slate-400">Support</p>
            <div className="mt-4 space-y-3">
              <p>Contact Us</p>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
