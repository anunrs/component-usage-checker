# Component Usage Checker — Developer Document

## What I Built

Component Usage Checker is a full-stack developer tool that accepts a zip file of any React + TypeScript codebase, scans every source file, maps out every component that is defined in the project, tracks where each component is imported, and produces a visual dashboard that categorises every component by how heavily it is used — and whether it is even reachable from the app's entry point.

The problem it solves: in any React project that has been alive for more than a year, there are always components that were created for a feature, the feature was changed or removed, but the component file was never deleted. Nobody knows what is safe to remove. This tool tells you exactly that — and also surfaces which components are the backbone of the entire codebase, so you know what not to touch.

### Five categories of output

**Unreachable** — defined and even imported somewhere, but the import chain never connects back to the app's entry point. This is dead code that *looks* alive. The most dangerous kind.

**Unused** — defined in the project but never imported anywhere. Safe to delete.

**Rarely Used** — imported in exactly one reachable file. May be a candidate for inlining or removal.

**Normal** — imported in 2 to 4 reachable files. Healthy usage, no action needed.

**Core** — imported in 5 or more reachable files. These are the building blocks of the project. Treat changes to these carefully.

> **Note:** Usage counts only count imports from *reachable* files. An unreachable file importing a component does not make that component more "used" — it's dead code importing another component. This is what makes the Core/Normal/etc. labels accurate even in large codebases with dead feature branches.

---

## How It Works — End to End

1. User registers or logs in
2. User uploads a `.zip` file of their React + TypeScript project (any size — full project or just `src/`) and gives it a name
3. **Client-side:** JSZip filters the zip in-browser — strips everything except `.ts`/`.tsx` files (excluding `node_modules` and `.d.ts`), repacks a tiny filtered zip, then uploads that. A 225 MB project zip becomes a 1–2 MB upload.
4. The backend receives the filtered zip via multer, saves it temporarily to `/tmp`
5. A scan record is created in the database with status `"pending"`
6. The zip is opened with `adm-zip` and every `.ts` and `.tsx` file is read into memory
7. Every file is scanned for component definitions using an exhaustive set of export pattern regexes
8. **Reachability analysis:** a file-level import graph is built and BFS is run from the app's entry point (`src/index.tsx`, `src/main.tsx`, etc.) to determine which files are reachable
9. Every file is scanned for local import statements to build the usage map
10. Components in unreachable files are marked `reachable: false`. For reachable components, `usedIn` is filtered to only include reachable importers
11. All components are saved to the database
12. The scan status is updated to `"complete"` and the zip is deleted from `/tmp`
13. The user is redirected to the scan result page, which shows components grouped by label with collapsible sections and a per-component import graph popup

---

## Architecture Overview

```
Frontend (React + CRA)  →  Backend (Express on Vercel Serverless)  →  PostgreSQL (Supabase)
     ↓                               ↑
JSZip filter                 multer (zip upload)
(client-side,                adm-zip (zip extraction)
strips non-TS                graphBuilder (BFS reachability)
before upload)               componentFinder + importParser + usageBuilder
                             (all in-memory, no persistent file writes)
```

---

## Repository Structure

```
component-usage-checker/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma              # 3 models: User, Scan, Component
│   │   ├── migrations/                # SQL migration history
│   │   └── migration_lock.toml
│   ├── prisma.config.ts               # Prisma v7 config — loads DATABASE_URL via dotenv
│   ├── src/
│   │   ├── index.ts                   # Express app entry point — exported for Vercel, listen() guarded
│   │   ├── generated/                 # Prisma generated client (gitignored — regenerated on deploy)
│   │   ├── lib/
│   │   │   └── prisma.ts              # Singleton PrismaClient with pg Pool adapter + SSL config
│   │   ├── middleware/
│   │   │   └── auth.ts                # JWT verification — adds userId to AuthRequest
│   │   ├── routes/
│   │   │   ├── auth.ts                # POST /auth/register, POST /auth/login
│   │   │   └── scans.ts               # POST /scans/upload, GET /scans, GET /scans/:id
│   │   └── services/
│   │       ├── zipExtractor.ts        # Opens zip, returns { filePath, content }[] for .ts/.tsx files
│   │       ├── graphBuilder.ts        # Builds file import graph + BFS reachability from entry point
│   │       ├── componentFinder.ts     # Finds exported component names in a file via regex (exhaustive)
│   │       ├── importParser.ts        # Finds locally imported component names in a file via regex
│   │       └── usageBuilder.ts        # Combines finder + parser + reachability into ComponentUsage[]
│   ├── vercel.json                    # Vercel serverless config — routes all traffic to src/index.ts
│   ├── tsconfig.json
│   ├── package.json
│   └── .gitignore
│
├── frontend/
│   ├── public/
│   │   └── index.html                 # Tailwind CDN + Inter font loaded here
│   ├── src/
│   │   ├── App.tsx                    # Router setup with PrivateRoute wrapper
│   │   ├── api/
│   │   │   └── client.ts              # Axios instance with JWT interceptor
│   │   ├── components/
│   │   │   ├── Layout.tsx             # Shared nav — logo, New Scan button, Logout
│   │   │   ├── ComponentCard.tsx      # One component — name, file, count, importing files, graph icon
│   │   │   ├── ComponentGraph.tsx     # Portal-based import graph popup (left-to-right SVG)
│   │   │   └── UsageTag.tsx           # Pill badge — Unreachable / Unused / Rarely used / Normal / Core
│   │   └── pages/
│   │       ├── Login.tsx
│   │       ├── Register.tsx
│   │       ├── Dashboard.tsx          # Past scans list with skeleton loading + empty state
│   │       ├── UploadPage.tsx         # Drop zone + JSZip client-side filter + project name input
│   │       └── ScanResult.tsx         # Stat tiles + collapsible grouped component sections
│   ├── .env                           # REACT_APP_API_URL (gitignored)
│   ├── package.json
│   └── .gitignore
│
├── .gitignore                         # Root-level — covers .DS_Store
└── DEVLOG.md                          # This file
```

---

## Full Tech Stack

### Backend

| Technology | Version | Purpose |
|---|---|---|
| Node.js | 22.x | Runtime |
| TypeScript | 6.x | Type safety |
| Express | 5.x | HTTP server and routing |
| Prisma | 7.x | ORM — database access and migrations |
| @prisma/adapter-pg | 7.x | Required Prisma v7 adapter for PostgreSQL |
| pg (node-postgres) | 8.x | PostgreSQL driver used by Prisma adapter |
| multer | 2.x | Multipart form data handling — reads zip file from HTTP request |
| adm-zip | 0.5.x | Opens and reads zip file contents in memory |
| bcryptjs | 3.x | Password hashing |
| jsonwebtoken | 9.x | JWT creation and verification |
| cors | 2.x | Cross-Origin Resource Sharing middleware |
| dotenv | 17.x | Loads .env into process.env |
| ts-node | 10.x | Run TypeScript directly in dev |
| nodemon | 3.x | Auto-restart dev server on file save |

### Frontend

| Technology | Version | Purpose |
|---|---|---|
| React | 19.x | UI framework |
| TypeScript | 4.x | Type safety |
| Create React App (react-scripts) | 5.x | Build tooling and dev server |
| React Router DOM | 7.x | Client-side routing |
| Axios | 1.x | HTTP client for API calls |
| JSZip | 3.x | Client-side zip filtering before upload |
| TailwindCSS | Via CDN | Utility CSS styling |
| Inter | Via Google Fonts | Typography |

### Database

| Technology | Details |
|---|---|
| PostgreSQL | Hosted on Supabase |
| Supabase | Managed PostgreSQL — NANO tier (Mumbai, ap-south-1) |
| Connection mode | Session pooler via `aws-0-ap-south-1.pooler.supabase.com:5432` |

**Why the session pooler specifically (not direct, not transaction pooler):**

- **Direct connection** (`db.xxxx.supabase.co:5432`) — DNS does not resolve on the NANO tier. Causes `P1001: Can't reach database server`. Do not use.
- **Transaction pooler** (`aws-0-region.pooler.supabase.com:6543`) — PgBouncer transaction mode does not support Prisma's prepared statements. Causes runtime query errors. Do not use with Prisma.
- **Session pooler** (`aws-0-region.pooler.supabase.com:5432`) — PgBouncer session mode supports prepared statements. Works for migrations and the running app. **This is the correct choice.**

---

## Database Schema

```prisma
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  password  String
  scans     Scan[]
  createdAt DateTime @default(now())
}

model Scan {
  id           String      @id @default(uuid())
  userId       String
  user         User        @relation(fields: [userId], references: [id])
  projectName  String
  status       String      @default("pending")  // "pending" | "complete" | "failed"
  createdAt    DateTime    @default(now())
  components   Component[]
}

model Component {
  id          String   @id @default(uuid())
  scanId      String
  scan        Scan     @relation(fields: [scanId], references: [id])
  name        String   // e.g. "ButtonPrimary"
  definedIn   String   // file path inside the zip e.g. "src/components/Button.tsx"
  usageCount  Int      @default(0)
  usedIn      Json     // array of file paths that import this component (reachable importers only)
  reachable   Boolean  @default(true)  // false = not reachable from app entry point
}
```

**Key design decisions:**

- `label` is **not stored** — it is computed on the frontend from `usageCount`. Storing a derived value means running a migration when thresholds change. Since `usageCount` is always stored, the label can always be recalculated.
- `reachable` defaults to `true` — conservative default. Old scan records and scans where no entry point was detectable are treated as fully reachable. This avoids false positives.
- `usedIn` stores only **reachable importers** for reachable components. For unreachable components, all importers are stored (to show dead-code structure in the graph).

---

## Core Logic Deep Dive

### zipExtractor.ts

Accepts the file path of the uploaded zip (in `/tmp`). Uses `adm-zip` to open it and iterates all entries. For each entry:
- Skip if `entry.isDirectory`
- Skip if path doesn't end in `.ts` or `.tsx`
- Skip if path ends in `.d.ts` — **declaration files are type stubs, not component implementations.** Including them caused false-positive component entries from things like `export declare const MyThing`.
- Skip if path includes `node_modules`
- Otherwise: read content with `entry.getData().toString("utf8")`

Returns: `ExtractedFile[]` — `{ filePath: string, content: string }[]`.

### graphBuilder.ts

The reachability engine. Builds a file-level import graph and runs BFS from the app's entry point.

**Step 1 — Find the entry point**

Searches for known entry point files in priority order:
```
src/index.tsx, src/index.ts, src/main.tsx, src/main.ts, src/App.tsx, src/App.ts
index.tsx, index.ts, main.tsx, main.ts
```

Uses suffix matching (e.g. `filePath.endsWith("/src/index.tsx")`) so zips with a root folder prefix (`my-app/src/index.tsx`) are found correctly.

If no entry point is found: returns `null`. The caller (`usageBuilder`) treats `null` as "skip reachability — all components are reachable." This is the conservative false-positive prevention — better to show everything as reachable than to incorrectly mark live components as dead.

**Step 2 — Parse import paths**

A separate regex (not the same as `importParser`) extracts only the file path string from each import — not the component names:
```ts
/from\s+['"]([^'"]+)['"]/g
```
Filters to only `./` and `../` local imports.

**Step 3 — Resolve import paths to actual file paths**

Given a source file `my-app/src/pages/Home.tsx` importing `../components/Button`:
- Compute: `path.posix.join("my-app/src/pages", "../components/Button")` → `my-app/src/components/Button`
- Try extensions in order: `.tsx`, `.ts`, `.jsx`, `.js`, `/index.tsx`, `/index.ts`, `/index.jsx`, `/index.js`
- Return the first candidate that exists in the file set

This handles both bare imports (`Button`) and index imports (`Button/index.tsx`).

**Step 4 — BFS**

Standard breadth-first search from the entry point file. Visits each file once, resolves all its imports, enqueues unvisited resolved files. Returns `Set<string>` of all reachable file paths.

**Why BFS and not DFS:** Both work for reachability. BFS was chosen because it naturally finds shortest paths (useful for future "show path from root" feature) and processes files in a predictable level-by-level order.

### componentFinder.ts

Exhaustive regex-based component detection. Covers every export form TypeScript supports:

```ts
// Named function — with or without async
/export\s+(?:async\s+)?function\s+([A-Z][a-zA-Z0-9]*)/

// Default function — with or without async
/export\s+default\s+(?:async\s+)?function\s+([A-Z][a-zA-Z0-9]*)/

// Variable declaration — const, let, or var; plain or type-annotated
// export const Foo = ...   AND   export const Foo: React.FC<P> = ...
// The \s*[:=] is the key fix — allows a colon (type annotation) before =
/export\s+(?:const|let|var)\s+([A-Z][a-zA-Z0-9]*)\s*[:=]/

// Class — with or without abstract
/export\s+(?:abstract\s+)?class\s+([A-Z][a-zA-Z0-9]*)/

// Default class — with or without abstract
/export\s+default\s+(?:abstract\s+)?class\s+([A-Z][a-zA-Z0-9]*)/

// Default identifier — the most commonly missed pattern
// const Foo = ...; export default Foo;
// Negative lookahead prevents false positives from React.memo(Foo), HOC(Foo), Foo.Bar
/export\s+default\s+([A-Z][a-zA-Z0-9]*)(?![.(a-zA-Z0-9_])/
```

Additionally, `export { Foo }` and `export { Foo as Bar }` (without `from`) are handled separately via a full-content scan with a global regex. This covers the "declare at top, export at bottom" pattern:
```ts
const MyComponent = () => { ... };
// ... other code ...
export { MyComponent };         // tracked as "MyComponent"
export { MyComponent as Pub };  // tracked as "Pub" (the exported name)
```

`export type { Foo }` and `export { Foo } from '...'` (re-exports from other files) are explicitly excluded — they are not new definitions.

No AST parser is used. Regex scanning is fast and covers all real-world React patterns. The capital letter constraint (`[A-Z]`) is what distinguishes React components from utilities.

### importParser.ts

Finds locally imported component names in a file. The regex captures the entire import clause in one match, then parses the parts separately:

```ts
/import\s+(type\s+)?([^'"]+?)\s+from\s+['"]([^'"]+)['"]/g
```

- `match[1]` — `"type "` if it's an `import type { ... }` — these are skipped entirely
- `match[2]` — the full import clause: `Button`, `Button, { IconLeft }`, `{ Button, Modal }`, etc.
- `match[3]` — the source path

For each match where source starts with `./` or `../`:

**Default import:** Strip the `{ ... }` block from the clause, remove commas. What remains is the default import name. Check for capital letter.

**Named imports:** Extract the `{ ... }` block. Split by comma. For each entry:
- Skip if it starts with `"type "` — inline type imports (TS 4.5+): `import { type ButtonProps, Button }`
- Handle aliases: `"Button as Btn"` → split by ` as ` → use `"Button"` (the original export name, not the local alias). This is critical: the componentFinder records the export name, so the importer must also reference the export name for the match to work.

**Multi-line imports** work automatically: `[^'"]+?` in the import pattern and `[^}]+` in the named block match newline characters since these are character class patterns, not `.`.

### usageBuilder.ts

Orchestrates the full pipeline. Takes `ExtractedFile[]` and a `Set<string> | null` reachable file set.

**Pass 1 — Definitions map:** `componentFinder` on every file → `Map<componentName, filePath>`

**Pass 2 — Usages map:** `importParser` on every file → `Map<componentName, filePath[]>`

**Combine with reachability:**
```ts
for (const [name, definedIn] of definitions) {
  const allUsedIn = usages.get(name) ?? [];
  const definedInReachable = reachableFiles === null ? true : reachableFiles.has(definedIn);

  // Reachable components: filter usedIn to only reachable importers
  // Unreachable components: keep all importers (to show dead-code structure)
  const usedIn = (reachableFiles !== null && definedInReachable)
    ? allUsedIn.filter(f => reachableFiles.has(f))
    : allUsedIn;
}
```

This is the key insight: if `FederationList` (unreachable) imports `ColorContext` (reachable/core), that import should NOT count toward ColorContext's usage score. The tool is measuring how embedded a component is in the *live* application — not in dead feature branches.

---

## Client-Side Zip Filtering

Vercel serverless functions have a hard 4.5 MB request body limit. A typical zipped React project (including `node_modules`) is 100–300 MB. Even a `src/`-only zip of a large codebase can exceed the limit.

**Solution:** Filter the zip in the browser before uploading using JSZip.

```ts
const original = await JSZip.loadAsync(rawFile);
const filtered = new JSZip();

original.forEach((path, entry) => {
  if (entry.dir)                       return;
  if (path.includes("node_modules"))   return;
  if (path.endsWith(".d.ts"))          return;  // type stubs, not source
  if (!path.endsWith(".ts") && !path.endsWith(".tsx")) return;
  // add to filtered zip
});

const blob = await filtered.generateAsync({ type: "blob", compression: "DEFLATE" });
```

The UI shows the result before upload: "312 TypeScript files · 847 KB". A 225 MB project zip typically filters down to under 2 MB. The upload button is disabled until filtering completes.

This also means users can upload their entire project zip without worrying about what to include — the tool handles the filtering automatically.

---

## The Scan Pipeline — Full Request Lifecycle

```
POST /scans/upload
  │
  ├── authenticateToken middleware
  │
  ├── multer middleware (saves filtered zip to /tmp)
  │
  ├── prisma.scan.create({ status: "pending" })
  │
  ├── try:
  │     extractZip(req.file.path)
  │       → skips dirs, non-.ts/.tsx, .d.ts, node_modules
  │       → returns ExtractedFile[]
  │
  │     buildReachabilitySet(files)
  │       → finds entry point (src/index.tsx etc.)
  │       → builds file import graph
  │       → BFS from entry point
  │       → returns Set<string> of reachable file paths (or null if no entry point)
  │
  │     buildUsageMap(files, reachableFiles)
  │       → findComponents() on every file (exhaustive export patterns)
  │       → parseImports() on every file
  │       → cross-references with reachableFiles
  │       → returns ComponentUsage[] with reachable boolean per component
  │
  │     prisma.component.createMany(...)
  │       → one row per component, includes reachable field
  │
  │     prisma.scan.update({ status: "complete" })
  │
  │     fs.unlinkSync(req.file.path)
  │
  │     res.status(201).json({ scanId })
  │
  └── catch:
        prisma.scan.update({ status: "failed" })
        res.status(500).json({ error: "Scan failed" })
```

---

## API Endpoints

### Auth (`/auth`)
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /auth/register | No | Create account, returns JWT |
| POST | /auth/login | No | Verify credentials, returns JWT |

### Scans (`/scans`)
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /scans/upload | Yes | Upload zip, run scan, save results |
| GET | /scans | Yes | List all scans for the logged-in user |
| GET | /scans/:id | Yes | Get one scan with full component list |

### Health
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /health | No | Returns `{ status: "ok" }` |

---

## Authentication Flow

**Registration / Login:** bcrypt (cost factor 10) hashes passwords. JWT signed with `JWT_SECRET`, expires in 7 days.

**Frontend:** Token stored in `localStorage`. Axios request interceptor attaches it as `Authorization: Bearer <token>` on every request.

**Backend:** `authenticateToken` middleware verifies the token, attaches `userId` to `AuthRequest`. Applied once at the top of the scans router with `router.use(authenticateToken)` — covers all routes below it.

---

## Frontend Design System

### Dark Theme Color Palette

| Element | Tailwind class | Hex |
|---|---|---|
| Page background | `bg-zinc-950` | #09090b |
| Cards / nav surface | `bg-zinc-900` | #18181b |
| Borders (default) | `border-zinc-800` | #27272a |
| Borders (hover) | `border-zinc-700` | #3f3f46 |
| Primary text | `text-zinc-100` | #f4f4f5 |
| Secondary text | `text-zinc-500` | #71717a |
| Muted / file paths | `text-zinc-600` | #52525b |
| Primary button | `bg-indigo-600` | #4f46e5 |

### Label Color System

| Label | Background | Text | Ring | Left border |
|---|---|---|---|---|
| unreachable | `bg-violet-950` | `text-violet-400` | `ring-violet-900` | `border-l-violet-500` |
| unused | `bg-red-950` | `text-red-400` | `ring-red-900` | `border-l-red-500` |
| rarely-used | `bg-amber-950` | `text-amber-400` | `ring-amber-900` | `border-l-amber-500` |
| normal | `bg-sky-950` | `text-sky-400` | `ring-sky-900` | `border-l-sky-500` |
| core | `bg-emerald-950` | `text-emerald-400` | `ring-emerald-900` | `border-l-emerald-500` |

### Import Graph Popup (ComponentGraph.tsx)

Each component card has a graph icon button. Clicking it opens a modal showing which files import that component.

**Layout:** Left-to-right SVG — importer file nodes on the left, bezier curves flowing right, the component box on the right with its label colour as the ring colour.

**Portal rendering:** The modal is rendered via `ReactDOM.createPortal` into `document.body`, completely outside the ComponentCard's DOM tree. This is critical — the card has `hover:-translate-y-0.5` applied, and without the portal, any mouse movement over the card while the modal is open would retrigger the transform, causing the modal to flicker and shift. The portal breaks that DOM relationship entirely.

**UX details:**
- Escape key closes the modal
- `document.body.style.overflow = "hidden"` prevents background scroll while open
- Close button is a solid 32×32 bg-zinc-900 target (not just an icon)
- Staggered opacity animation: file nodes fade in left-to-right, component box last
- Overflow: if more than 8 importers, remaining shown as a dashed "+N more" node
- Empty state: shown if no files import the component
- Unreachable warning banner shown if `reachable === false`

### Collapsible Sections (ScanResult.tsx)

Each section (Unreachable / Unused / Rarely Used / Normal / Core) can be independently collapsed by clicking the section header or the corresponding stat tile. State is tracked as `Set<Label>` in component state. A "Collapse all / Expand all" control appears when there are multiple non-empty sections. Chevron icon rotates to indicate state.

---

## Environment Variables

### Backend
```
DATABASE_URL=postgresql://postgres.PROJECTREF:PASSWORD@aws-0-ap-south-1.pooler.supabase.com:5432/postgres
JWT_SECRET=<long random string>
PORT=3000
ALLOWED_ORIGINS=https://your-frontend.vercel.app
```

### Frontend
```
REACT_APP_API_URL=https://your-backend.vercel.app
```

---

## Deployment

### Backend — Vercel (Serverless)

`vercel.json` routes all traffic to `src/index.ts`. `app.listen()` is guarded by `NODE_ENV !== "production"` so it only runs locally. `export default app` is what Vercel's `@vercel/node` builder picks up.

`postinstall: "prisma generate"` in `package.json` regenerates the Prisma client after `npm install` on Vercel's build servers (the generated client is gitignored).

Uploaded zips go to `/tmp` — the only writable location in Vercel's ephemeral containers. They are deleted immediately after scanning.

### Frontend — Vercel

CRA app with Tailwind via CDN. Auto-deploys on push to `main`. Both backend and frontend are separate Vercel projects pointing at different root directories of the same monorepo.

---

## Known Gotchas & Decisions

**Reachability is conservative by default:**
If no entry point file can be detected (e.g. the zip doesn't contain `src/index.tsx` or `src/main.tsx`), `buildReachabilitySet` returns `null` and all components default to `reachable: true`. Better to show everything as potentially live than to incorrectly nuke live components.

**Reachability runs on the filtered zip:**
The client-side JSZip filter strips non-TypeScript files before upload. `graphBuilder` only ever sees `.ts`/`.tsx` files — it can't follow imports into `.js` or `.css` files. If a project's entry point is a `.js` file, it won't be detected. This is a known limitation for non-TypeScript projects (which aren't the target audience anyway).

**Type-annotated `export const` was the biggest miss in v1:**
`export const Button: React.FC<Props> = ...` has a `:` between the name and `=`. The original pattern `\s*=` never matched. Changed to `\s*[:=]` which accepts either `=` (direct assignment) or `:` (type annotation). This was the primary reason many TypeScript-heavy components were invisible to the scanner.

**`export default Identifier` is extremely common:**
```ts
const MyComponent = () => { ... };
export default MyComponent;
```
This pattern — declare first, export separately — was not detected in v1. Negative lookahead `(?![.(a-zA-Z0-9_])` is used to prevent capturing `React` from `export default React.memo(...)` or HOC names from `export default withRouter(...)`.

**Combined imports require separate parsing:**
`import Button, { IconLeft } from '../components'` — the original regex used exclusive OR and only captured either the default OR the named imports. Restructured to strip the `{ ... }` block to get the default, then extract the `{ ... }` block separately.

**Aliased imports must resolve to the export name:**
`import { Button as Btn }` — if we store `"Btn"` as the imported name, it never matches the definition `"Button"`. The correct behaviour is to store `"Button"` (the original export name). This ensures the usage map correctly attributes the import to the component definition.

**`.d.ts` files must be excluded:**
Declaration files end in `.d.ts` which also ends in `.ts`. Without explicit exclusion, `vite-env.d.ts`, `global.d.ts`, and bundled library declarations generate false component entries from patterns like `export declare const MyThing`.

**Global regex `lastIndex` must be reset:**
Both `importParser` and `graphBuilder` use global regexes. After each file is processed, `PATTERN.lastIndex = 0` must be called. Without this, the next file's search starts from a non-zero position and matches are silently missed.

**Unreachable importers must not inflate labels:**
If `FederationList` (unreachable) imports `ColorContext` (core), that import is dead code. Without filtering, `ColorContext` might show 15 imports but only 8 of them are from live files — making it appear more embedded than it is. The fix: for reachable components, `usedIn` is filtered to only include files that are themselves reachable.

**Portal prevents modal flicker:**
ComponentCard has `hover:-translate-y-0.5`. If the graph modal renders inside the card's DOM tree, mouse movement over the card while the modal is open retriggers the hover transform, causing the modal to shift/flicker. `ReactDOM.createPortal(modal, document.body)` breaks the DOM relationship — the modal renders at body level and is immune to any transform on its logical parent.

**Prisma v7 adapter requirement:**
```ts
const pool = new Pool({ connectionString: process.env.DATABASE_URL!, ssl: { rejectUnauthorized: false } });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
```
`new PrismaClient()` with no arguments doesn't connect to anything in v7.

**SSL: `rejectUnauthorized: false` on Pool, not in URL:**
`?sslmode=require` in the DATABASE_URL causes `pg` to treat it as `verify-full`, overriding the Pool ssl config. Remove it from the URL and rely solely on `ssl: { rejectUnauthorized: false }` on the Pool object.

**Monorepo + Vercel = two separate Vercel projects:**
Same GitHub repo, different Root Directory settings. Both auto-deploy on push to `main`.

**`https://` must be in all URL env vars:**
`REACT_APP_API_URL` and `ALLOWED_ORIGINS` must include the protocol. Without `https://`, the frontend builds malformed request URLs and CORS origin matching fails.

**CRA creates its own `.git` folder:**
`create-react-app` initialises a git repo inside `frontend/`. Fix: `rm -rf frontend/.git`, then `git rm --cached -f frontend`, re-stage.

**Label is not stored in the database:**
Computed at render time from `usageCount`. No migration needed if thresholds change.

**No keep-alive needed:**
Vercel serverless wakes in milliseconds. No UptimeRobot or ping service required (unlike Render free tier).
