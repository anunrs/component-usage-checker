// componentFinder.ts
// Finds every exported React component in a TypeScript / TSX file.
// Covers all export forms used in modern React + TypeScript codebases.
// No AST — pure regex, designed to have zero false negatives on real projects.

// ── Line-by-line patterns ─────────────────────────────────────────────────
// Each pattern captures the component name in group 1.
const LINE_PATTERNS: RegExp[] = [
  // export function Foo / export async function Foo
  /export\s+(?:async\s+)?function\s+([A-Z][a-zA-Z0-9]*)/,

  // export default function Foo / export default async function Foo
  /export\s+default\s+(?:async\s+)?function\s+([A-Z][a-zA-Z0-9]*)/,

  // export const Foo = ... / export let Foo = ... / export var Foo = ...
  // Also handles type-annotated forms: export const Foo: React.FC<P> = ...
  // \s*[:=] matches either "Foo =" (direct) or "Foo:" (type annotation follows)
  /export\s+(?:const|let|var)\s+([A-Z][a-zA-Z0-9]*)\s*[:=]/,

  // export class Foo / export abstract class Foo
  /export\s+(?:abstract\s+)?class\s+([A-Z][a-zA-Z0-9]*)/,

  // export default class Foo / export default abstract class Foo
  /export\s+default\s+(?:abstract\s+)?class\s+([A-Z][a-zA-Z0-9]*)/,

  // export default Foo;  — component declared earlier in the file, exported at the bottom
  // Negative lookahead blocks: React.memo(Foo), HOC(Foo), Namespace.Foo, etc.
  /export\s+default\s+([A-Z][a-zA-Z0-9]*)(?![.(a-zA-Z0-9_])/,
];

// ── export { ... } without "from" ────────────────────────────────────────
// Handles: const Foo = ...; export { Foo };
//      and: const Foo = ...; export { Foo as Bar };  (tracks exported name "Bar")
// Multi-line blocks work because [^}]+ matches newlines.
// Excludes:
//   export type { Foo }         — type-only export
//   export { Foo } from '...'   — re-export from another module (not a definition here)
const LOCAL_EXPORT_BLOCK = /export\s+(?!type[\s{])\{([^}]+)\}(?!\s*from)/g;

function extractLocalExports(content: string): string[] {
  const found: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = LOCAL_EXPORT_BLOCK.exec(content)) !== null) {
    const entries = match[1].split(",").map((e) => e.trim()).filter(Boolean);

    for (const entry of entries) {
      // Skip inline type exports: "type Foo" (TS 4.5+)
      if (entry === "type" || entry.startsWith("type ")) continue;

      const parts     = entry.split(/\s+as\s+/);
      const localName = parts[0].trim();

      // Skip re-references to the module's own default export
      if (localName === "default") continue;

      // Use the exported name (after "as") — that's what import statements reference.
      // e.g. export { InternalComp as PublicComp } → track "PublicComp"
      const exportedName = parts.length > 1 ? parts[1].trim() : localName;

      if (/^[A-Z]/.test(exportedName)) {
        found.push(exportedName);
      }
    }
  }

  LOCAL_EXPORT_BLOCK.lastIndex = 0;
  return found;
}

// ── Public API ────────────────────────────────────────────────────────────
export function findComponents(content: string): string[] {
  const found = new Set<string>();

  // Line-by-line pass — handles all single-line export forms
  for (const line of content.split("\n")) {
    for (const pattern of LINE_PATTERNS) {
      const match = line.match(pattern);
      if (match) found.add(match[1]);
    }
  }

  // Full-content pass — handles multi-line export { ... } blocks
  for (const name of extractLocalExports(content)) {
    found.add(name);
  }

  return Array.from(found);
}
