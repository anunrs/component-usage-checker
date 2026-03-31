// ComponentCard — one component's name, file path, usage count, and importing files

import ComponentGraph from "./ComponentGraph";
import UsageTag from "./UsageTag";

type Label = "unused" | "rarely-used" | "normal" | "core" | "unreachable";

interface Props {
  name: string;
  definedIn: string;
  usageCount: number;
  usedIn: string[];
  label: Label;
  reachable: boolean;
}

const ACCENT: Record<Label, string> = {
  unreachable:   "border-l-violet-500",
  unused:        "border-l-red-500",
  "rarely-used": "border-l-amber-500",
  normal:        "border-l-sky-500",
  core:          "border-l-emerald-500",
};

export default function ComponentCard({ name, definedIn, usageCount, usedIn, label, reachable }: Props) {
  return (
    <div className={`bg-zinc-900 rounded-xl border border-zinc-800 border-l-4 ${ACCENT[label]} p-4 hover:border-zinc-700 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/30 transition-all duration-200`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="font-mono font-semibold text-zinc-100 text-sm leading-tight break-all">
          {name}
        </span>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <UsageTag label={label} />
          <ComponentGraph
            name={name}
            definedIn={definedIn}
            usedIn={usedIn}
            reachable={reachable}
            label={label}
          />
        </div>
      </div>

      <p className="text-xs text-zinc-600 font-mono mb-3 truncate" title={definedIn}>
        {definedIn}
      </p>

      <div className="flex items-center gap-1.5">
        <span className="text-xl font-bold text-zinc-200">{usageCount}</span>
        <span className="text-xs text-zinc-600">
          {usageCount === 1 ? "import" : "imports"}
        </span>
      </div>

      {usedIn.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-zinc-800 pt-3">
          {usedIn.map((file) => (
            <li key={file} className="text-xs text-zinc-600 font-mono truncate" title={file}>
              {file}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
