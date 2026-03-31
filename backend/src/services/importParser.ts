// importParser.ts
// Given the text content of a single file, finds all local import statements
// (imports from ./ or ../ paths — not from node_modules).
// Returns a list of component names (PascalCase) that are imported in this file.

// Captures the entire import clause + source path.
// [^'"]+? matches across newlines so multi-line imports work.
// The leading (type\s+)? detects "import type { ... }" blocks to skip them.
const IMPORT_PATTERN = /import\s+(type\s+)?([^'"]+?)\s+from\s+['"]([^'"]+)['"]/g;

export function parseImports(content: string): string[] {
  const importedComponents: string[] = [];

  let match: RegExpExecArray | null;

  while ((match = IMPORT_PATTERN.exec(content)) !== null) {
    const isTypeOnlyImport = !!match[1]; // "import type { ... }" — skip entirely
    const importClause     = match[2];   // everything between "import [type]" and "from"
    const source           = match[3];   // the path string

    if (isTypeOnlyImport) continue;
    if (!source.startsWith("./") && !source.startsWith("../")) continue;

    // ── Default import ────────────────────────────────────────────────────────
    // Strip the named-import block to isolate the default identifier.
    // "Button, { IconLeft }" → "Button"
    // "{ Button }"           → "" (no default)
    const withoutNamed = importClause.replace(/\{[^}]*\}/, "").replace(/,/g, "").trim();
    if (withoutNamed && /^[A-Z]/.test(withoutNamed)) {
      importedComponents.push(withoutNamed);
    }

    // ── Named imports ─────────────────────────────────────────────────────────
    // Handles: { Button, Modal }
    //          { Button as Btn }          → record original name "Button"
    //          { type ButtonProps, Btn }  → skip "type ButtonProps", record "Btn"
    const namedBlock = importClause.match(/\{([^}]+)\}/);
    if (namedBlock) {
      const names = namedBlock[1].split(",").map((n) => n.trim()).filter(Boolean);
      for (const name of names) {
        // Strip inline type keyword: "type ButtonProps" → skip
        if (name === "type" || name.startsWith("type ")) continue;

        // Handle alias: "Button as Btn" → use "Button" (the export name)
        const originalName = name.split(/\s+as\s+/)[0].trim();

        if (/^[A-Z]/.test(originalName)) {
          importedComponents.push(originalName);
        }
      }
    }
  }

  // Reset regex state (global regexes are stateful in JS)
  IMPORT_PATTERN.lastIndex = 0;

  return importedComponents;
}
