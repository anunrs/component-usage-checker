// ComponentGraph — import-flow popup rendered in a React Portal.
// Renders outside the ComponentCard DOM tree so card hover transforms
// cannot cause flickering. Left-to-right layout: [importers] → [component].

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";

type Label = "unused" | "rarely-used" | "normal" | "core" | "unreachable";

interface Props {
  name: string;
  definedIn: string;
  usedIn: string[];
  reachable: boolean;
  label: Label;
}

// Ring / accent colour for the component box
const NODE_STROKE: Record<Label, string> = {
  unreachable:   "#7c3aed",
  unused:        "#ef4444",
  "rarely-used": "#f59e0b",
  normal:        "#38bdf8",
  core:          "#34d399",
};

// ── SVG layout constants ───────────────────────────────────────────────────
const SVG_W   = 460;   // total viewBox width
const FILE_X  = 12;    // left edge of importer nodes
const FILE_W  = 165;   // importer node width
const FILE_H  = 38;    // importer node height
const FILE_GAP = 10;   // vertical gap between importer nodes
const PAD_V   = 28;    // top/bottom padding
const COMP_X  = 294;   // left edge of component box
const COMP_W  = 154;   // component box width
const COMP_H  = 64;    // component box height

const MAX_NODES = 8;   // max visible importer nodes before overflow

// Show last two path segments for readability: "Home/index.tsx"
function shortPath(p: string): string {
  const parts = p.split("/");
  return parts.length >= 2 ? parts.slice(-2).join("/") : p;
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + "…";
}

type NodeData =
  | { kind: "file"; path: string }
  | { kind: "overflow"; count: number };

export default function ComponentGraph({ name, definedIn, usedIn, reachable, label }: Props) {
  const [open, setOpen]         = useState(false);
  const [animated, setAnimated] = useState(false);

  // Staggered entry animation
  useEffect(() => {
    if (!open) { setAnimated(false); return; }
    const id = requestAnimationFrame(() => setAnimated(true));
    return () => cancelAnimationFrame(id);
  }, [open]);

  // Escape key
  useEffect(() => {
    if (!open) return;
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [open]);

  // Prevent body scroll
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else      document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // Build node list
  const overflow = Math.max(0, usedIn.length - MAX_NODES);
  const nodes: NodeData[] = [
    ...usedIn.slice(0, MAX_NODES).map((path): NodeData => ({ kind: "file", path })),
    ...(overflow > 0 ? [{ kind: "overflow" as const, count: overflow }] : []),
  ];

  // SVG dimensions
  const svgH   = Math.max(140, nodes.length * (FILE_H + FILE_GAP) - FILE_GAP + PAD_V * 2);
  const compY  = (svgH - COMP_H) / 2;
  const compCY = compY + COMP_H / 2;
  const stroke = NODE_STROKE[label];

  return (
    <>
      {/* ── Trigger icon button ── */}
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        title="View import graph"
        className="p-1 rounded text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 transition-colors duration-150 flex-shrink-0"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <circle cx="8"    cy="2.5"  r="1.5" fill="currentColor" stroke="none" />
          <circle cx="2.5"  cy="13.5" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="13.5" cy="13.5" r="1.5" fill="currentColor" stroke="none" />
          <line x1="8"  y1="4"    x2="3.2"  y2="12.2" />
          <line x1="8"  y1="4"    x2="12.8" y2="12.2" />
          <line x1="4"  y1="13.5" x2="12"   y2="13.5" />
        </svg>
      </button>

      {/* ── Modal (Portal — renders outside card DOM, no hover-transform interference) ── */}
      {open && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Dialog card */}
          <div className="relative bg-zinc-950 rounded-2xl border border-zinc-800 w-full max-w-md z-10 shadow-2xl shadow-black/60">

            {/* Header */}
            <div className="flex items-start justify-between px-5 pt-5 pb-3">
              <div className="min-w-0 pr-3">
                <p className="text-xs text-zinc-500 font-mono truncate mb-0.5" title={definedIn}>
                  {definedIn}
                </p>
                <h3 className="text-sm font-semibold text-zinc-100 font-mono">{name}</h3>
              </div>
              {/* Solid 32×32 close button — easy to hit */}
              <button
                onClick={() => setOpen(false)}
                className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors duration-150"
              >
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
              </button>
            </div>

            {/* Unreachable warning */}
            {!reachable && (
              <div className="mx-5 mb-3 px-3 py-2 rounded-lg bg-violet-950 border border-violet-900 text-violet-300 text-xs leading-relaxed">
                <span className="font-semibold text-violet-200">Dead code detected.</span>{" "}
                Not reachable from the app's entry point.
              </div>
            )}

            {/* Graph */}
            <div className="px-5 pb-5 pt-0">
              {usedIn.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-28 text-zinc-600 text-xs gap-2">
                  <svg className="w-6 h-6 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 8v4m0 4h.01" strokeLinecap="round" />
                  </svg>
                  No files import this component
                </div>
              ) : (
                <svg viewBox={`0 0 ${SVG_W} ${svgH}`} className="w-full h-auto">
                  <defs>
                    <marker id="cg-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
                      <path d="M0,0 L0,7 L7,3.5 Z" fill="#52525b" />
                    </marker>
                  </defs>

                  {/* Bezier lines: importer → component */}
                  {nodes.map((_, i) => {
                    const fileCY = PAD_V + i * (FILE_H + FILE_GAP) + FILE_H / 2;
                    const x1 = FILE_X + FILE_W;
                    const x2 = COMP_X - 6; // stop just before arrowhead tip
                    const mx = x1 + (x2 - x1) * 0.5;
                    return (
                      <path
                        key={`line-${i}`}
                        d={`M${x1} ${fileCY} C${mx} ${fileCY} ${mx} ${compCY} ${x2} ${compCY}`}
                        fill="none"
                        stroke="#3f3f46"
                        strokeWidth="1.5"
                        markerEnd="url(#cg-arrow)"
                        style={{
                          opacity:    animated ? 0.65 : 0,
                          transition: `opacity 0.35s ease ${i * 0.06}s`,
                        }}
                      />
                    );
                  })}

                  {/* Component box (right) */}
                  <g style={{ opacity: animated ? 1 : 0, transition: `opacity 0.3s ease ${nodes.length * 0.06 + 0.1}s` }}>
                    <rect x={COMP_X} y={compY} width={COMP_W} height={COMP_H} rx={10} fill={stroke} style={{ opacity: 0.1 }} />
                    <rect x={COMP_X} y={compY} width={COMP_W} height={COMP_H} rx={10} fill="none" stroke={stroke} strokeWidth="1.5" />
                    <text
                      x={COMP_X + COMP_W / 2} y={compY + COMP_H / 2 - 9}
                      textAnchor="middle" dominantBaseline="middle"
                      fill="#f4f4f5" fontSize="10" fontFamily="ui-monospace,monospace" fontWeight="600"
                    >
                      {truncate(name, 16)}
                    </text>
                    <text
                      x={COMP_X + COMP_W / 2} y={compY + COMP_H / 2 + 9}
                      textAnchor="middle" dominantBaseline="middle"
                      fill={stroke} fontSize="8.5" fontFamily="ui-monospace,monospace"
                    >
                      {usedIn.length} {usedIn.length === 1 ? "import" : "imports"}
                    </text>
                  </g>

                  {/* Importer nodes (left) */}
                  {nodes.map((node, i) => {
                    const fileY   = PAD_V + i * (FILE_H + FILE_GAP);
                    const fileCY2 = fileY + FILE_H / 2;
                    const isOver  = node.kind === "overflow";
                    const display = isOver
                      ? `+${(node as { kind: "overflow"; count: number }).count} more`
                      : truncate(shortPath((node as { kind: "file"; path: string }).path), 24);
                    const tooltip = isOver
                      ? `${(node as { kind: "overflow"; count: number }).count} more importers`
                      : (node as { kind: "file"; path: string }).path;
                    return (
                      <g
                        key={`node-${i}`}
                        style={{ opacity: animated ? 1 : 0, transition: `opacity 0.35s ease ${i * 0.06}s` }}
                      >
                        <title>{tooltip}</title>
                        <rect
                          x={FILE_X} y={fileY} width={FILE_W} height={FILE_H} rx={7}
                          fill={isOver ? "#27272a" : "#1c1c1f"}
                          stroke={isOver ? "#52525b" : "#3f3f46"}
                          strokeWidth="1"
                          strokeDasharray={isOver ? "4 3" : undefined}
                        />
                        <text
                          x={FILE_X + FILE_W / 2} y={fileCY2}
                          textAnchor="middle" dominantBaseline="middle"
                          fill={isOver ? "#71717a" : "#d4d4d8"}
                          fontSize="8" fontFamily="ui-monospace,monospace"
                        >
                          {display}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
