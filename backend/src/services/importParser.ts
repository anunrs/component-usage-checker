// importParser.ts
// Given the text content of a single file, finds all local import statements
// (imports from ./ or ../ paths — not from node_modules).
// Returns a list of component names that are imported in this file.

const IMPORT_PATTERN = /import\s+(?:(\w+)|(?:\{([^}]+)\}))\s+from\s+['"]([^'"]+)['"]/g;

export function parseImports(content: string): string[] {
  const importedComponents: string[] = [];

  let match: RegExpExecArray | null;

  while ((match = IMPORT_PATTERN.exec(content)) !== null) {
    const source = match[3]; // the "from" path e.g. "../components/Button"

    // Only care about local imports
    if (!source.startsWith("./") && !source.startsWith("../")) continue;

    const defaultImport = match[1];  // e.g. import Button from "..."
    const namedImports = match[2];   // e.g. import { Button, Modal } from "..."

    if (defaultImport && /^[A-Z]/.test(defaultImport)) {
      importedComponents.push(defaultImport);
    }

    if (namedImports) {
      const names = namedImports.split(",").map((n) => n.trim());
      for (const name of names) {
        if (/^[A-Z]/.test(name)) {
          importedComponents.push(name);
        }
      }
    }
  }

  // Reset regex state (global regexes are stateful in JS)
  IMPORT_PATTERN.lastIndex = 0;

  return importedComponents;
}
