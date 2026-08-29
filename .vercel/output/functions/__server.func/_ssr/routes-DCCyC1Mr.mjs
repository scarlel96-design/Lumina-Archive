import { v as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as Cpu, i as GitBranch, n as ShieldAlert, o as Box, r as Lock } from "../_libs/lucide-react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-DCCyC1Mr.js
var import_jsx_runtime = require_jsx_runtime();
var G0 = {
	phase: "G0",
	spec: "v0.2",
	product: "Lumina Archive",
	verdict: "CONDITIONAL PASS",
	native: "BLOCKED BY ENVIRONMENT",
	baseline: "Bandizip 7.46",
	stack: [
		{
			layer: "Lumina.Win",
			tech: "C# / .NET 10.0.11 / WinUI 3 / WASDK 2.4.0"
		},
		{
			layer: "Domain",
			tech: "C# job/policy models"
		},
		{
			layer: "Supervisor",
			tech: "C# + Job Object + Named Pipe IPC"
		},
		{
			layer: "lumina-engine.exe",
			tech: "C++20 worker — codecs live only here"
		},
		{
			layer: "lumina-preview.exe",
			tech: "separate WIC process (G7)"
		},
		{
			layer: "lumina-shell.dll",
			tech: "IExplorerCommand, no parser"
		}
	],
	pins: [
		{
			name: "7-Zip",
			version: "26.02",
			role: "unmodified 7z.dll"
		},
		{
			name: "minizip-ng",
			version: "4.2.2",
			role: "ZIP container"
		},
		{
			name: "zlib-ng",
			version: "2.3.3",
			role: "Deflate fast path"
		},
		{
			name: "ISA-L",
			version: "2.32.1",
			role: "optional x64 accel"
		},
		{
			name: "libdeflate",
			version: "1.25",
			role: "bench-gated"
		},
		{
			name: "libarchive",
			version: "3.8.9",
			role: "TAR/ISO, not ZIP hot path"
		},
		{
			name: "zstd / LZ4 / XZ / BLAKE3",
			version: "1.5.7 / 1.10.0 / 5.8.3 / 1.8.7",
			role: "codecs / hash"
		}
	],
	invariants: [
		"웹·Electron·Tauri·Python GUI로 제품을 대체하지 않는다.",
		"코덱을 새로 구현하지 않는다.",
		"암호는 argv/환경변수/일반 로그에 넣지 않는다. 생산 경로는 7z.dll 콜백.",
		"UI와 Explorer에 파서를 로드하지 않는다.",
		"아카이브 경로는 전부 불신 입력이다.",
		"성능 주장은 bench/RESULTS.md 숫자만 사용한다.",
		"Gate가 PASS가 아니면 다음 Phase로 가지 않는다."
	],
	phases: [
		{
			id: "G0",
			title: "Constitution",
			state: "in-progress"
		},
		{
			id: "G1",
			title: "Bench harness",
			state: "blocked"
		},
		{
			id: "G2",
			title: "IPC + Supervisor",
			state: "planned"
		},
		{
			id: "G3",
			title: "7z.dll core",
			state: "planned"
		},
		{
			id: "G4",
			title: "Safe Extract",
			state: "planned"
		},
		{
			id: "G5",
			title: "Adaptive ZIP",
			state: "planned"
		},
		{
			id: "G6",
			title: "WinUI shell",
			state: "planned"
		},
		{
			id: "G7",
			title: "Power features",
			state: "planned"
		},
		{
			id: "G8",
			title: "Explorer / MSIX",
			state: "planned"
		},
		{
			id: "G9",
			title: "RC hardening",
			state: "planned"
		}
	]
};
function Home() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "mx-auto flex min-h-dvh max-w-5xl flex-col gap-10 px-5 py-8 sm:px-8",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "flex flex-col gap-5 border-b border-line pb-8",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-sm tracking-[0.18em] text-accent uppercase",
						children: [
							"Phase ",
							G0.phase,
							" · Spec ",
							G0.spec
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "font-display text-4xl leading-tight text-paper sm:text-5xl",
						children: "Lumina Archive"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "max-w-2xl text-base leading-relaxed text-muted",
						children: [
							"원작 Windows 아카이브 매니저. 기준은 ",
							G0.baseline,
							". 이 화면은 압축기가 아니라",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-fg",
								children: " 헌법 대시보드"
							}),
							"다. 제품 소스는 WinUI 3 + C++ 엔진이다."
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-ink",
							children: G0.verdict
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "rounded-full border border-line px-4 py-2 text-sm text-fg",
							children: ["native ", G0.native]
						})]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "grid gap-4 rounded-lg bg-bg-raise p-5 sm:p-6",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2 text-accent",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldAlert, {
						className: "size-5",
						"aria-hidden": true
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "text-lg font-medium text-fg",
						children: "이 미리보기에서 하지 않는 것"
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm leading-relaxed text-muted",
					children: "브라우저에서 ZIP을 만들거나 풀지 않는다. Electron/Tauri로 대체하지도 않는다. Windows MSVC와 .NET 10이 없는 이 호스트에서는 네이티브 빌드를 실행할 수 없어 게이트를 PASS로 쓰지 않는다."
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "flex flex-col gap-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
					className: "flex items-center gap-2 text-lg text-fg",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Lock, {
						className: "size-5 text-accent",
						"aria-hidden": true
					}), "불변식"]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
					className: "grid gap-3",
					children: G0.invariants.map((line, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "flex gap-3 rounded-md border border-line bg-bg-raise px-4 py-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "w-6 shrink-0 font-display text-accent",
							children: i + 1
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-sm leading-relaxed text-fg",
							children: line
						})]
					}, line))
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "flex flex-col gap-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
					className: "flex items-center gap-2 text-lg text-fg",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cpu, {
						className: "size-5 text-accent",
						"aria-hidden": true
					}), "고정 스택"]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "overflow-x-auto rounded-md border border-line",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
						className: "w-full min-w-[32rem] text-left text-sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
							className: "bg-bg-raise text-muted",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-4 py-3 font-medium",
								children: "계층"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-4 py-3 font-medium",
								children: "기술"
							})] })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: G0.stack.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
							className: "border-t border-line",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-4 py-3 text-accent",
								children: row.layer
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-4 py-3 text-fg",
								children: row.tech
							})]
						}, row.layer)) })]
					})
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "flex flex-col gap-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
					className: "flex items-center gap-2 text-lg text-fg",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Box, {
						className: "size-5 text-accent",
						"aria-hidden": true
					}), "핀 버전"]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "grid gap-2 sm:grid-cols-2",
					children: G0.pins.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "rounded-md border border-line px-4 py-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-fg",
							children: [
								p.name,
								" ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-accent",
									children: p.version
								})
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm text-muted",
							children: p.role
						})]
					}, p.name))
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "flex flex-col gap-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
					className: "flex items-center gap-2 text-lg text-fg",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(GitBranch, {
						className: "size-5 text-accent",
						"aria-hidden": true
					}), "페이즈"]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
					className: "grid grid-cols-2 gap-2 sm:grid-cols-5",
					children: G0.phases.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: `rounded-md border px-3 py-3 ${p.state === "in-progress" ? "border-accent bg-bg-raise" : "border-line"}`,
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "font-display text-accent",
								children: p.id
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-sm text-fg",
								children: p.title
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs text-muted",
								children: p.state
							})
						]
					}, p.id))
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("footer", {
				className: "border-t border-line pt-6 text-sm text-muted",
				children: "G1(벤치 하니스)은 이 게이트가 CONDITIONAL PASS로 닫힌 뒤에만 시작한다. UI 제품 화면은 G6."
			})
		]
	});
}
//#endregion
export { Home as component };
