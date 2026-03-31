// componentFinder.ts
// Given the text content of a single .ts/.tsx file, finds all React component definitions.
// A component is any exported identifier that starts with a capital letter.

const COMPONENT_PATTERNS = [
  // export function MyComponent
  /export\s+function\s+([A-Z][a-zA-Z0-9]*)/,
  // export default function MyComponent
  /export\s+default\s+function\s+([A-Z][a-zA-Z0-9]*)/,
  // export const MyComponent = ...  OR  export const MyComponent: React.FC<P> = ...
  // The \s*[:=] handles both the plain assignment and type-annotated forms.
  /export\s+const\s+([A-Z][a-zA-Z0-9]*)\s*[:=]/,
  // export class MyComponent (class components)
  /export\s+class\s+([A-Z][a-zA-Z0-9]*)/,
  // export default class MyComponent
  /export\s+default\s+class\s+([A-Z][a-zA-Z0-9]*)/,
  // export default MyComponent  (declared earlier in the file, then exported at the bottom)
  // Negative lookahead prevents false positives from React.memo(...), withRouter(...) etc.
  /export\s+default\s+([A-Z][a-zA-Z0-9]*)(?![.(a-zA-Z0-9_])/,
];

export function findComponents(content: string): string[] {
  const lines = content.split("\n");
  const found = new Set<string>();

  for (const line of lines) {
    for (const pattern of COMPONENT_PATTERNS) {
      const match = line.match(pattern);
      if (match) {
        found.add(match[1]);
      }
    }
  }

  return Array.from(found);
}
