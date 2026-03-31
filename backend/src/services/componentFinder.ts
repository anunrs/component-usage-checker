// componentFinder.ts
// Given the text content of a single .ts/.tsx file, finds all React component definitions.
// A component is any exported identifier that starts with a capital letter.
// Uses simple line-by-line regex matching — no AST or compiler involved.

const COMPONENT_PATTERNS = [
  /export\s+function\s+([A-Z][a-zA-Z0-9]*)/,        // export function MyComponent
  /export\s+const\s+([A-Z][a-zA-Z0-9]*)\s*=/,       // export const MyComponent =
  /export\s+default\s+function\s+([A-Z][a-zA-Z0-9]*)/, // export default function MyComponent
];

export function findComponents(content: string): string[] {
  const lines = content.split("\n");
  const found = new Set<string>();

  for (const line of lines) {
    for (const pattern of COMPONENT_PATTERNS) {
      const match = line.match(pattern);
      if (match) {
        found.add(match[1]); // match[1] is the captured component name
      }
    }
  }

  return Array.from(found);
}
