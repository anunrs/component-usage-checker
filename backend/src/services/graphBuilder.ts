// graphBuilder.ts
// Builds a file-level dependency graph and runs BFS from the app entry point.
// Returns the set of file paths that are reachable from the entry, or null if
// no entry point can be detected (caller should treat everything as reachable).

import path from "path";
import { ExtractedFile } from "./zipExtractor";

// --- import path extraction ---------------------------------------------------

const IMPORT_PATH_PATTERN = /from\s+['"]([^'"]+)['"]/g;

function parseImportPaths(content: string): string[] {
  const paths: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = IMPORT_PATH_PATTERN.exec(content)) !== null) {
    const source = match[1];
    if (source.startsWith("./") || source.startsWith("../")) {
      paths.push(source);
    }
  }
  IMPORT_PATH_PATTERN.lastIndex = 0;
  return paths;
}

// --- path resolution ---------------------------------------------------------

// Try to match a bare resolved path against real file paths.
// adm-zip preserves the zip's internal structure, so paths like
// "my-project/src/components/Button" need the same extension-probing logic.
function resolveImport(
  fromFile: string,
  importPath: string,
  fileSet: Set<string>
): string | null {
  const dir = path.posix.dirname(fromFile);
  const base = path.posix.normalize(path.posix.join(dir, importPath));

  const candidates = [
    base,
    `${base}.tsx`,
    `${base}.ts`,
    `${base}.jsx`,
    `${base}.js`,
    `${base}/index.tsx`,
    `${base}/index.ts`,
    `${base}/index.jsx`,
    `${base}/index.js`,
  ];

  for (const c of candidates) {
    if (fileSet.has(c)) return c;
  }
  return null;
}

// --- entry point detection ---------------------------------------------------

// Known entry point suffixes — checked in priority order.
// We use endsWith() so that zips with a root folder (e.g. "my-app/src/index.tsx")
// are matched the same way as bare zips ("src/index.tsx").
const ENTRY_SUFFIXES = [
  "src/index.tsx",
  "src/index.ts",
  "src/main.tsx",
  "src/main.ts",
  "src/App.tsx",
  "src/App.ts",
  // bare fallbacks (zip root == project root)
  "index.tsx",
  "index.ts",
  "main.tsx",
  "main.ts",
];

function findEntryPoint(files: ExtractedFile[]): string | null {
  for (const suffix of ENTRY_SUFFIXES) {
    for (const file of files) {
      // exact match OR path ends with /<suffix>
      if (file.filePath === suffix || file.filePath.endsWith(`/${suffix}`)) {
        return file.filePath;
      }
    }
  }
  return null;
}

// --- BFS reachability --------------------------------------------------------

export function buildReachabilitySet(files: ExtractedFile[]): Set<string> | null {
  const entryPoint = findEntryPoint(files);
  if (!entryPoint) {
    // No recognisable entry point — skip reachability entirely.
    // Caller will default every component to reachable: true.
    return null;
  }

  const fileMap = new Map<string, string>(files.map((f) => [f.filePath, f.content]));
  const fileSet = new Set(fileMap.keys());

  const reachable = new Set<string>();
  const queue: string[] = [entryPoint];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (reachable.has(current)) continue;
    reachable.add(current);

    const content = fileMap.get(current);
    if (!content) continue;

    for (const importPath of parseImportPaths(content)) {
      const resolved = resolveImport(current, importPath, fileSet);
      if (resolved && !reachable.has(resolved)) {
        queue.push(resolved);
      }
    }
  }

  return reachable;
}
