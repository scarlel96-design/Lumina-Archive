import { createFileRoute } from "@tanstack/react-router";
import { G0 } from "@/lib/g0";
import { ShieldAlert, Box, Lock, Cpu, GitBranch } from "lucide-react";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col gap-10 px-5 py-8 sm:px-8">
      <header className="flex flex-col gap-5 border-b border-line pb-8">
        <p className="text-sm tracking-[0.18em] text-accent uppercase">Phase {G0.phase} · Spec {G0.spec}</p>
        <h1 className="font-display text-4xl leading-tight text-paper sm:text-5xl">Lumina Archive</h1>
        <p className="max-w-2xl text-base leading-relaxed text-muted">
          원작 Windows 아카이브 매니저. 기준은 {G0.baseline}. 이 화면은 압축기가 아니라
          <span className="text-fg"> 헌법 대시보드</span>다. 제품 소스는 WinUI 3 + C++ 엔진이다.
        </p>
        <div className="flex flex-wrap gap-3">
          <span className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-ink">
            {G0.verdict}
          </span>
          <span className="rounded-full border border-line px-4 py-2 text-sm text-fg">
            native {G0.native}
          </span>
        </div>
      </header>

      <section className="grid gap-4 rounded-lg bg-bg-raise p-5 sm:p-6">
        <div className="flex items-center gap-2 text-accent">
          <ShieldAlert className="size-5" aria-hidden />
          <h2 className="text-lg font-medium text-fg">이 미리보기에서 하지 않는 것</h2>
        </div>
        <p className="text-sm leading-relaxed text-muted">
          브라우저에서 ZIP을 만들거나 풀지 않는다. Electron/Tauri로 대체하지도 않는다.
          G0 native는 GitHub windows-latest에서 PASS. G1 실기기 Bandizip 비교는 아직 없다.
          이 화면은 헌법·하네스 상태만 보여 준다.
        </p>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="flex items-center gap-2 text-lg text-fg">
          <Lock className="size-5 text-accent" aria-hidden />
          불변식
        </h2>
        <ol className="grid gap-3">
          {G0.invariants.map((line, i) => (
            <li key={line} className="flex gap-3 rounded-md border border-line bg-bg-raise px-4 py-3">
              <span className="w-6 shrink-0 font-display text-accent">{i + 1}</span>
              <span className="text-sm leading-relaxed text-fg">{line}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="flex items-center gap-2 text-lg text-fg">
          <Cpu className="size-5 text-accent" aria-hidden />
          고정 스택
        </h2>
        <div className="overflow-x-auto rounded-md border border-line">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead className="bg-bg-raise text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">계층</th>
                <th className="px-4 py-3 font-medium">기술</th>
              </tr>
            </thead>
            <tbody>
              {G0.stack.map((row) => (
                <tr key={row.layer} className="border-t border-line">
                  <td className="px-4 py-3 text-accent">{row.layer}</td>
                  <td className="px-4 py-3 text-fg">{row.tech}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="flex items-center gap-2 text-lg text-fg">
          <Box className="size-5 text-accent" aria-hidden />
          핀 버전
        </h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {G0.pins.map((p) => (
            <li key={p.name} className="rounded-md border border-line px-4 py-3">
              <p className="text-fg">
                {p.name} <span className="text-accent">{p.version}</span>
              </p>
              <p className="text-sm text-muted">{p.role}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="flex items-center gap-2 text-lg text-fg">
          <GitBranch className="size-5 text-accent" aria-hidden />
          페이즈
        </h2>
        <ol className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {G0.phases.map((p) => (
            <li
              key={p.id}
              className={`rounded-md border px-3 py-3 ${
                p.state === "in-progress"
                  ? "border-accent bg-bg-raise"
                  : "border-line"
              }`}
            >
              <p className="font-display text-accent">{p.id}</p>
              <p className="text-sm text-fg">{p.title}</p>
              <p className="text-xs text-muted">{p.state}</p>
            </li>
          ))}
        </ol>
      </section>

      <footer className="border-t border-line pt-6 text-sm text-muted">
        G1(벤치 하니스)은 이 게이트가 CONDITIONAL PASS로 닫힌 뒤에만 시작한다. UI 제품 화면은 G6.
      </footer>
    </main>
  );
}
