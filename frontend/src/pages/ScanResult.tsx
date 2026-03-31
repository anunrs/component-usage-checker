// ScanResult — one scan's components grouped by label

import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import client from "../api/client";
import ComponentCard from "../components/ComponentCard";
import Layout from "../components/Layout";

type Label = "unused" | "rarely-used" | "normal" | "core" | "unreachable";

interface Component {
  id: string;
  name: string;
  definedIn: string;
  usageCount: number;
  usedIn: string[];
  reachable?: boolean; // optional: old scan records won't have this field
}

interface Scan {
  id: string;
  projectName: string;
  status: string;
  components: Component[];
}

// Reachability takes priority: an unreachable component is labelled "unreachable"
// regardless of its import count, since it's dead code.
// Old scans without the reachable field default conservatively to reachable = true.
function getLabel(count: number, reachable: boolean = true): Label {
  if (!reachable) return "unreachable";
  if (count === 0) return "unused";
  if (count === 1) return "rarely-used";
  if (count >= 5)  return "core";
  return "normal";
}

const SECTION_CONFIG: {
  key: Label;
  title: string;
  accent: string;
  statStyle: string;
}[] = [
  { key: "unreachable", title: "Unreachable", accent: "text-violet-400",  statStyle: "bg-violet-950 text-violet-400 ring-1 ring-violet-900" },
  { key: "unused",      title: "Unused",      accent: "text-red-400",     statStyle: "bg-red-950 text-red-400 ring-1 ring-red-900" },
  { key: "rarely-used", title: "Rarely Used", accent: "text-amber-400",   statStyle: "bg-amber-950 text-amber-400 ring-1 ring-amber-900" },
  { key: "normal",      title: "Normal",      accent: "text-sky-400",     statStyle: "bg-sky-950 text-sky-400 ring-1 ring-sky-900" },
  { key: "core",        title: "Core",        accent: "text-emerald-400", statStyle: "bg-emerald-950 text-emerald-400 ring-1 ring-emerald-900" },
];

export default function ScanResult() {
  const { id } = useParams<{ id: string }>();
  const [scan, setScan]   = useState<Scan | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    client
      .get(`/scans/${id}`)
      .then((res) => setScan(res.data))
      .catch(() => setError("Could not load scan."));
  }, [id]);

  if (error) {
    return (
      <Layout>
        <div className="bg-red-950 border border-red-900 text-red-400 rounded-xl px-5 py-4 text-sm">
          {error}
        </div>
      </Layout>
    );
  }

  if (!scan) {
    return (
      <Layout>
        <div className="space-y-4 animate-pulse">
          <div className="h-7 bg-zinc-800 rounded w-1/4" />
          <div className="h-4 bg-zinc-800 rounded w-1/6" />
          <div className="grid grid-cols-5 gap-3 mt-8">
            {[1,2,3,4,5].map(i => <div key={i} className="h-20 bg-zinc-900 rounded-xl border border-zinc-800" />)}
          </div>
          <div className="grid grid-cols-2 gap-4 mt-6">
            {[1,2,3,4].map(i => <div key={i} className="h-32 bg-zinc-900 rounded-xl border border-zinc-800" />)}
          </div>
        </div>
      </Layout>
    );
  }

  const grouped = SECTION_CONFIG.map((s) => ({
    ...s,
    items: scan.components.filter(
      (c) => getLabel(c.usageCount, c.reachable) === s.key
    ),
  }));

  // Only show the stat tile for "unreachable" if at least one component is unreachable
  const hasUnreachable = grouped.find((g) => g.key === "unreachable")!.items.length > 0;
  const statTiles = grouped.filter((g) => g.key !== "unreachable" || hasUnreachable);

  return (
    <Layout>
      {/* Header */}
      <div className="mb-2">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1 text-xs text-zinc-600 hover:text-zinc-300 transition-colors duration-150 mb-4"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
          </svg>
          Back to dashboard
        </Link>
        <h1 className="text-2xl font-semibold text-zinc-100">{scan.projectName}</h1>
        <p className="text-sm text-zinc-500 mt-1">{scan.components.length} components found</p>
      </div>

      {/* Stats row — adapts to 4 or 5 columns depending on whether unreachable exist */}
      <div className={`grid gap-3 my-8 ${hasUnreachable ? "grid-cols-5" : "grid-cols-4"}`}>
        {statTiles.map(({ key, title, statStyle, items }) => (
          <div key={key} className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 text-center">
            <p className="text-2xl font-bold text-zinc-100">{items.length}</p>
            <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full mt-1.5 ${statStyle}`}>
              {title}
            </span>
          </div>
        ))}
      </div>

      {/* Sections */}
      {grouped.map(({ key, title, accent, items }) =>
        items.length === 0 ? null : (
          <div key={key} className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <h2 className={`text-base font-semibold ${accent}`}>{title}</h2>
              <span className="text-sm text-zinc-600">({items.length})</span>
              {key === "unreachable" && (
                <span className="text-xs text-zinc-600 ml-1">
                  — imported somewhere, but not reachable from the app entry point
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {items.map((c) => (
                <ComponentCard
                  key={c.id}
                  name={c.name}
                  definedIn={c.definedIn}
                  usageCount={c.usageCount}
                  usedIn={c.usedIn}
                  label={getLabel(c.usageCount, c.reachable)}
                  reachable={c.reachable ?? true}
                />
              ))}
            </div>
          </div>
        )
      )}
    </Layout>
  );
}
