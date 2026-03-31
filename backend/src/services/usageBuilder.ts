// usageBuilder.ts
// Combines the output of componentFinder and importParser across all extracted files.
// Builds a complete map of every component → which files use it → usage label.

import { ExtractedFile } from "./zipExtractor";
import { findComponents } from "./componentFinder";
import { parseImports } from "./importParser";

export interface ComponentUsage {
  name: string;
  definedIn: string;
  usedIn: string[];
  usageCount: number;
  label: "unused" | "rarely-used" | "normal" | "core";
  reachable: boolean;
}

function getLabel(count: number): ComponentUsage["label"] {
  if (count === 0) return "unused";
  if (count === 1) return "rarely-used";
  if (count >= 5) return "core";
  return "normal";
}

export function buildUsageMap(
  files: ExtractedFile[],
  reachableFiles: Set<string> | null
): ComponentUsage[] {
  // Step 1 — find every component definition across all files
  // Result: { "Button": "src/components/Button.tsx", ... }
  const definitions = new Map<string, string>();

  for (const file of files) {
    const components = findComponents(file.content);
    for (const name of components) {
      definitions.set(name, file.filePath);
    }
  }

  // Step 2 — find every import across all files
  // Result: { "Button": ["src/pages/Home.tsx", "src/pages/Dashboard.tsx"], ... }
  const usages = new Map<string, string[]>();

  for (const file of files) {
    const imported = parseImports(file.content);
    for (const name of imported) {
      if (!usages.has(name)) usages.set(name, []);
      usages.get(name)!.push(file.filePath);
    }
  }

  // Step 3 — combine into final result
  const result: ComponentUsage[] = [];

  for (const [name, definedIn] of definitions) {
    const allUsedIn = usages.get(name) ?? [];
    const definedInReachable = reachableFiles === null ? true : reachableFiles.has(definedIn);

    // For reachable components: only count imports from reachable files.
    // This prevents dead-code files from inflating usage labels (e.g. a
    // component shouldn't be "Core" just because 10 unreachable files import it).
    // For unreachable components: keep all importers so the graph still shows
    // the dead-code structure (e.g. ButtonSection imported by SubMenuPage).
    const usedIn =
      reachableFiles !== null && definedInReachable
        ? allUsedIn.filter((f) => reachableFiles.has(f))
        : allUsedIn;

    const usageCount = usedIn.length;

    result.push({
      name,
      definedIn,
      usedIn,
      usageCount,
      label: getLabel(usageCount),
      reachable: definedInReachable,
    });
  }

  return result;
}
