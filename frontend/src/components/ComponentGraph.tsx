// ComponentGraph — graph icon trigger + radial SVG popup modal
// Shows a force-radial map of which files import a given component.
// Zero external dependencies — pure React + inline SVG.

import React, { useState, useEffect } from "react";

type Label = "unused" | "rarely-used" | "normal" | "core" | "unreachable";

interface Props {
  name: string;
  definedIn: string;
  usedIn: string[];
  reachable: boolean;
  label: Label;
}

// Center node ring/glow color per label
const NODE_STROKE: Record<Label, string> = {
  unreachable:   "#7c3aed",
  unused:        "#ef4444",
  "rarely-used": "#f59e0b",
  normal:        "#38bdf8",
  core:          "#34d399",
};

const MAX_NODES = 8; // max peripheral nodes shown

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + "…";
}

function basename(p: string): string {
  return p.split("/").pop() ?? p;
}

export default function ComponentGraph({ name, definedIn, usedIn, reachable, label }: Props) {
  const [open, setOpen]         = useState(false);
  const [animated, setAnimated] = useState(false);

  // Staggered fade-in: defer one frame after open so CSS transitions fire
  useEffect(() => {
    if (!open) { setAnimated(false); return; }
    const id = requestAnimationFrame(() => setAnimated(true));
    return () => cancelAnimationFrame(id);
  }, [open]);

  const overflow     = Math.max(0, usedIn.length - MAX_NODES);
  const visibleNodes = usedIn.slice(0, MAX_NODES);
  // If there are extra files, add one "+N more" placeholder node
  const nodeCount    = visibleNodes.length + (overflow > 0 ? 1 : 0);

  // SVG coordinate system
  const CX = 210, CY = 195, RADIUS = 138;
  const angleOffset = -Math.PI / 2; // start from 12-o'clock

  const positions = Array.from({ length: nodeCount }, (_, i) => {
    const angle = angleOffset + (i / nodeCount) * 2 * Math.PI;
    return {
      x: CX + RADIUS * Math.cos(angle),
      y: CY + RADIUS * Math.sin(angle),
    };
  });

  const stroke = NODE_STROKE[label];

  return (
    <>
      {/* ── Trigger icon button ── */}
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        title="View import graph"
        className="p-1 rounded text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 transition-colors duration-150 flex-shrink-0"
      >
        {/* three-node graph icon */}
        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <circle cx="8"   cy="2.5"  r="1.5" fill="currentColor" stroke="none" />
          <circle cx="2.5" cy="13.5" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="13.5" cy="13.5" r="1.5" fill="currentColor" stroke="none" />
          <line x1="8"   y1="4"    x2="3.2"  y2="12.2" />
          <line x1="8"   y1="4"    x2="12.8" y2="12.2" />
          <line x1="4"   y1="13.5" x2="12"   y2="13.5" />
        </svg>
      </button>

      {/* ── Modal ── */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Dialog card */}
          <div className="relative bg-zinc-950 rounded-2xl border border-zinc-800 w-full max-w-md z-10 overflow-hidden shadow-2xl shadow-black/60">

            {/* Header */}
            <div className="flex items-start justify-between px-5 pt-5 pb-0">
              <div className="min-w-0 mr-3">
                <p className="text-xs text-zinc-500 font-mono truncate mb-0.5" title={definedIn}>
                  {definedIn}
                </p>
                <h3 className="text-sm font-semibold text-zinc-100 font-mono">{name}</h3>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="flex-shrink-0 text-zinc-600 hover:text-zinc-300 transition-colors duration-150 p-1 -mr-1 -mt-1 rounded"
              >
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
              </button>
            </div>

            {/* Unreachable warning banner */}
            {!reachable && (
              <div className="mx-5 mt-3 px-3 py-2 rounded-lg bg-violet-950 border border-violet-900 text-violet-300 text-xs leading-relaxed">
                <span className="font-semibold text-violet-200">Dead code detected.</span>{" "}
                This component is not reachable from the app's entry point — it may be imported
                only by other unreachable files.
              </div>
            )}

            {/* Graph or empty state */}
            <div className="px-5 pb-5 pt-2">
              {usedIn.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-36 text-zinc-600 text-xs gap-2">
                  <svg className="w-7 h-7 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 8v4m0 4h.01" strokeLinecap="round" />
                  </svg>
                  No files import this component
                </div>
              ) : (
                <svg viewBox="0 0 420 390" className="w-full h-auto">

                  {/* Lines — rendered first so they're under the nodes */}
                  {positions.map((pos, i) => (
                    <line
                      key={`line-${i}`}
                      x1={CX} y1={CY} x2={pos.x} y2={pos.y}
                      stroke="#3f3f46"
                      strokeWidth="1.5"
                      style={{
                        opacity:    animated ? 0.6 : 0,
                        transition: `opacity 0.4s ease ${i * 0.06}s`,
                      }}
                    />
                  ))}

                  {/* Center node */}
                  <g
                    style={{
                      opacity:    animated ? 1 : 0,
                      transition: "opacity 0.3s ease 0s",
                    }}
                  >
                    {/* Soft glow fill */}
                    <circle cx={CX} cy={CY} r={30} fill={stroke} style={{ opacity: 0.12 }} />
                    {/* Ring */}
                    <circle cx={CX} cy={CY} r={30} fill="none" stroke={stroke} strokeWidth="1.5" />
                    {/* Component name */}
                    <text
                      x={CX} y={CY - 5}
                      textAnchor="middle" dominantBaseline="middle"
                      fill="#f4f4f5" fontSize="9" fontFamily="ui-monospace, monospace" fontWeight="600"
                    >
                      {truncate(name, 11)}
                    </text>
                    {/* Import count sub-label */}
                    <text
                      x={CX} y={CY + 10}
                      textAnchor="middle" dominantBaseline="middle"
                      fill={stroke} fontSize="7.5" fontFamily="ui-monospace, monospace"
                      style={{ opacity: 0.85 }}
                    >
                      {usedIn.length} {usedIn.length === 1 ? "import" : "imports"}
                    </text>
                  </g>

                  {/* Peripheral nodes */}
                  {positions.map((pos, i) => {
                    const isOverflowNode = overflow > 0 && i === positions.length - 1;
                    const filePath       = isOverflowNode ? undefined : visibleNodes[i];
                    const nodeLabel      = isOverflowNode
                      ? `+${overflow} more`
                      : truncate(basename(filePath!), 12);
                    const tooltip        = isOverflowNode
                      ? `${overflow} more file${overflow > 1 ? "s" : ""}`
                      : filePath;
                    const delay          = 0.08 + i * 0.07;

                    return (
                      <g
                        key={`node-${i}`}
                        style={{
                          opacity:    animated ? 1 : 0,
                          transition: `opacity 0.4s ease ${delay}s`,
                          cursor:     "default",
                        }}
                      >
                        <title>{tooltip}</title>
                        {/* Node circle */}
                        <circle
                          cx={pos.x} cy={pos.y} r={22}
                          fill={isOverflowNode ? "#27272a" : "#18181b"}
                          stroke={isOverflowNode ? "#52525b" : "#3f3f46"}
                          strokeWidth="1"
                        />
                        {/* Filename label */}
                        <text
                          x={pos.x} y={pos.y}
                          textAnchor="middle" dominantBaseline="middle"
                          fill={isOverflowNode ? "#a1a1aa" : "#d4d4d8"}
                          fontSize="7" fontFamily="ui-monospace, monospace"
                        >
                          {nodeLabel}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
