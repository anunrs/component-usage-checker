// UsageTag — pill badge for a component's usage label

type Label = "unused" | "rarely-used" | "normal" | "core";

const STYLES: Record<Label, string> = {
  unused:        "bg-red-950 text-red-400 ring-1 ring-red-900",
  "rarely-used": "bg-amber-950 text-amber-400 ring-1 ring-amber-900",
  normal:        "bg-sky-950 text-sky-400 ring-1 ring-sky-900",
  core:          "bg-emerald-950 text-emerald-400 ring-1 ring-emerald-900",
};

const LABELS: Record<Label, string> = {
  unused: "Unused",
  "rarely-used": "Rarely used",
  normal: "Normal",
  core: "Core",
};

export default function UsageTag({ label }: { label: Label }) {
  return (
    <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${STYLES[label]}`}>
      {LABELS[label]}
    </span>
  );
}
