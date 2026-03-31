// zipExtractor.ts
// Takes the file path of an uploaded zip and returns an array of { filePath, content }
// for every .ts and .tsx file found inside the zip.
// Files are read into memory as strings — nothing is written to disk.

import AdmZip from "adm-zip";

export interface ExtractedFile {
  filePath: string; // the path of the file inside the zip e.g. "src/components/Button.tsx"
  content: string;  // the full text content of that file
}

export function extractZip(zipFilePath: string): ExtractedFile[] {
  const zip = new AdmZip(zipFilePath);
  const entries = zip.getEntries();

  const results: ExtractedFile[] = [];

  for (const entry of entries) {
    // Skip directories
    if (entry.isDirectory) continue;
    // Skip non-TS files
    if (!entry.entryName.endsWith(".ts") && !entry.entryName.endsWith(".tsx")) continue;
    // Skip declaration files — they contain type stubs, not component implementations
    if (entry.entryName.endsWith(".d.ts")) continue;
    // Skip node_modules — we only care about the project's own source files
    if (entry.entryName.includes("node_modules")) continue;

    const content = entry.getData().toString("utf8");
    results.push({ filePath: entry.entryName, content });
  }

  return results;
}
