# Component Usage Checker — Developer Document

## What I Built

Component Usage Checker is a full-stack developer tool that accepts a zip file of any React + TypeScript codebase, scans every source file, maps out every component that is defined in the project, tracks where each component is imported, and produces a visual dashboard that categorises every component by how heavily it is used.

The problem it solves: in any React project that has been alive for more than a year, there are always components that were created for a feature, the feature was changed or removed, but the component file was never deleted. Nobody knows what is safe to remove. This tool tells you exactly that — and also surfaces which components are the backbone of the entire codebase, so you know what not to touch.

### Four categories of output

**Unused** — defined in the project but never imported anywhere. Safe to delete.

**Rarely Used** — imported in exactly one file. May be a candidate for inlining or removal.

**Normal** — imported in 2 to 4 files. Healthy usage, no action needed.

**Core** — imported in 5 or more files. These are the building blocks of the project. Treat changes to these carefully.

---

## How It Works — End to End

1. User registers or logs in
2. User uploads a `.zip` file of their React + TypeScript project and gives it a name
3. The backend receives the zip via multer, saves it temporarily to `/tmp`
4. A scan record is created in the database with status `"pending"`
5. The zip is opened with `adm-zip` and every `.ts` and `.tsx` file is read into memory as a string — nothing is extracted to disk permanently
6. Every file is scanned for component definitions (exported identifiers starting with a capital letter)
7. Every file is scanned for local import statements (imports from `./` or `../` paths only — not from `node_modules`)
8. The results are combined into a usage map: each component name → which files import it → usage count → label
9. All components are saved to the database as rows linked to the scan
10. The scan status is updated to `"complete"`
11. The zip file is deleted from `/tmp`
12. The user is redirected to the scan result page, which fetches the component list and renders it grouped by label with stat tiles at the top

---

## Architecture Overview

```
Frontend (React + CRA)  →  Backend (Express on Vercel Serverless)  →  PostgreSQL (Supabase)
                                        ↑
                              multer (zip upload)
                              adm-zip (zip extraction)
                              componentFinder + importParser + usageBuilder
                              (all in-memory, no persistent file writes)
```

There are no background jobs or scheduled tasks in this project. Everything happens on-demand when a user makes a request. This is what makes Vercel's serverless model a perfect fit — unlike API Drift Observatory which needed a persistent `node-cron` process, Component Usage Checker only does work when a request comes in.

---

## Repository Structure

```
component-usage-checker/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma              # 3 models: User, Scan, Component
│   │   ├── migrations/                # SQL migration history (gitignored in this project)
│   │   └── migration_lock.toml
│   ├── prisma.config.ts               # Prisma v7 config — loads DATABASE_URL via dotenv
│   ├── src/
│   │   ├── index.ts                   # Express app entry point — exported for Vercel, listen() guarded
│   │   ├── generated/                 # Prisma generated client (gitignored — regenerated on deploy)
│   │   ├── uploads/                   # Local dev fallback folder (unused in production — /tmp used instead)
│   │   ├── lib/
│   │   │   └── prisma.ts              # Singleton PrismaClient with pg Pool adapter + SSL config
│   │   ├── middleware/
│   │   │   └── auth.ts                # JWT verification — adds userId to AuthRequest
│   │   ├── routes/
│   │   │   ├── auth.ts                # POST /auth/register, POST /auth/login
│   │   │   └── scans.ts               # POST /scans/upload, GET /scans, GET /scans/:id
│   │   └── services/
│   │       ├── zipExtractor.ts        # Opens zip, returns { filePath, content }[] for .ts/.tsx files
│   │       ├── componentFinder.ts     # Finds exported component names in a file via regex
│   │       ├── importParser.ts        # Finds locally imported component names in a file via regex
│   │       └── usageBuilder.ts        # Combines finder + parser output into ComponentUsage[]
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
│   │   │   ├── ComponentCard.tsx      # One component — name, file, count, importing files
│   │   │   └── UsageTag.tsx           # Pill badge — Unused / Rarely used / Normal / Core
│   │   └── pages/
│   │       ├── Login.tsx
│   │       ├── Register.tsx
│   │       ├── Dashboard.tsx          # Past scans list with skeleton loading + empty state
│   │       ├── UploadPage.tsx         # Styled file drop zone + project name input
│   │       └── ScanResult.tsx         # Stat tiles + grouped component cards
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

**TypeScript compiler config (`tsconfig.json`):**
- Target: `ES2020`
- Module: `commonjs`
- Strict mode: on
- Source: `src/` → compiled to `dist/`
- `skipLibCheck: true` — avoids type errors in generated Prisma client

### Database

| Technology | Details |
|---|---|
| PostgreSQL | Hosted on Supabase |
| Supabase | Managed PostgreSQL — NANO tier (Mumbai, ap-south-1) |
| Connection mode | Session pooler via `aws-0-ap-south-1.pooler.supabase.com:5432` |

**Why the session pooler specifically (not direct, not transaction pooler):**

Three connection options exist on Supabase. Each has a critical reason why it was or wasn't used:

- **Direct connection** (`db.xxxx.supabase.co:5432`) — DNS does not resolve on the NANO tier. The hostname simply doesn't exist from the outside world. This caused `P1001: Can't reach database server` errors. Do not use for NANO projects.
- **Transaction pooler** (`aws-0-region.pooler.supabase.com:6543`) — Routes through PgBouncer in transaction mode. Prisma uses **prepared statements** internally and PgBouncer's transaction mode does not support them. This causes runtime query errors. Do not use with Prisma.
- **Session pooler** (`aws-0-region.pooler.supabase.com:5432`) — Routes through PgBouncer in session mode, which does support prepared statements. This works for both migrations (`prisma migrate dev`) and the running application. **This is the correct choice.**

**Database schema — 3 models:**

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
  usedIn      Json     // array of file paths that import this component
}
```

**Important:** The `label` field (unused / rarely-used / normal / core) is **not stored in the database**. It is computed on the frontend at render time from `usageCount`. This was a deliberate decision — storing a derived value that can always be recalculated from existing data is unnecessary. If the label thresholds ever change, no migration is needed.

**Prisma client generation:**
The client is generated to `src/generated/prisma` and is gitignored. It must be regenerated after every `npm install` via a `postinstall` script in `package.json`. This is what allows Vercel to regenerate it during deployment without the files being committed to the repo.

### Frontend

| Technology | Version | Purpose |
|---|---|---|
| React | 19.x | UI framework |
| TypeScript | 4.x | Type safety |
| Create React App (react-scripts) | 5.x | Build tooling and dev server |
| React Router DOM | 7.x | Client-side routing |
| Axios | 1.x | HTTP client for API calls |
| TailwindCSS | Via CDN | Utility CSS styling |
| Inter | Via Google Fonts | Typography |

**Why TailwindCSS via CDN:**
CRA manages its own internal PostCSS pipeline and does not allow custom `postcss.config.js` overrides without ejecting. Tailwind v4 requires PostCSS integration which conflicts with CRA's internals. The simplest and most reliable solution is loading Tailwind from the CDN `<script>` tag in `public/index.html`. This works identically in development and production.

**Routing structure:**
- `/` → redirects to `/login`
- `/login` → Login page (public)
- `/register` → Register page (public)
- `/dashboard` → Scan list (protected)
- `/upload` → Zip upload form (protected)
- `/scans/:id` → Scan result detail (protected)
- `*` → redirects to `/login`

Protected routes use a `PrivateRoute` component that checks for a JWT in `localStorage`. If absent, it redirects to `/login` using React Router's `<Navigate>`.

---

## Core Logic Deep Dive

### zipExtractor.ts

Accepts the file path of the uploaded zip (in `/tmp`). Uses `adm-zip` to open the zip and calls `getEntries()` which returns every item inside — both files and directories.

For each entry:
- Skip if `entry.isDirectory` is true
- Skip if the file path doesn't end in `.ts` or `.tsx`
- Skip if the file path includes `node_modules`
- Otherwise: call `entry.getData().toString("utf8")` to get the file content as a string

`getData()` returns a `Buffer` (raw bytes). `.toString("utf8")` converts it to a readable string — the same way reading a text file works. This all happens in memory. Nothing is written to disk.

Returns: `ExtractedFile[]` where each object is `{ filePath: string, content: string }`.

```ts
// Example output:
[
  { filePath: "src/components/Button.tsx", content: "export const Button = ..." },
  { filePath: "src/pages/Home.tsx", content: "import { Button } from ..." },
  ...
]
```

### componentFinder.ts

Accepts the text content of a single file as a string. Splits it into lines and tests each line against three regex patterns:

```ts
/export\s+function\s+([A-Z][a-zA-Z0-9]*)/        // export function MyComponent
/export\s+const\s+([A-Z][a-zA-Z0-9]*)\s*=/       // export const MyComponent =
/export\s+default\s+function\s+([A-Z][a-zA-Z0-9]*)/ // export default function MyComponent
```

The capital letter constraint (`[A-Z]`) is what distinguishes React components from regular exported utilities. React components always start with a capital letter by convention — this is also a requirement for JSX to recognise them as components rather than HTML elements.

Uses a `Set<string>` to collect names so duplicates are automatically ignored. Returns `string[]` of component names found in that file.

No AST (Abstract Syntax Tree) parser is used. This is intentional — a full TypeScript compiler or parser like `@typescript-eslint/parser` would be accurate but complex to set up and overkill for v1. Plain regex scanning covers the vast majority of real-world component definitions.

### importParser.ts

Accepts the text content of a single file as a string. Uses a single global regex to find all import statements:

```ts
/import\s+(?:(\w+)|(?:\{([^}]+)\}))\s+from\s+['"]([^'"]+)['"]/g
```

This regex captures three groups:
- `match[1]` — default import name (e.g. `Button` from `import Button from "..."`)
- `match[2]` — named imports as a raw string (e.g. `Button, Modal` from `import { Button, Modal } from "..."`)
- `match[3]` — the import source path (e.g. `"../components/Button"`)

For each match:
1. Check `match[3]` (the source path) — if it doesn't start with `./` or `../`, skip it. This filters out all `node_modules` imports like `react`, `axios`, etc.
2. If a default import exists and starts with a capital letter → add to results
3. If named imports exist → split by comma → trim each → add any that start with a capital letter

The capital letter filter excludes lowercase imports like `useState`, `useEffect`, `classnames` etc. — only component names (PascalCase) are collected.

**Critical detail — resetting `lastIndex`:**
The regex uses the `g` (global) flag. In JavaScript, a global regex is stateful — it remembers the position it left off at between calls via a `lastIndex` property. If `lastIndex` is not reset to `0` after processing each file, the next file's search starts from the wrong position and matches are silently missed. This is one of the most common and subtle bugs with global regexes in JavaScript. The fix is one line: `IMPORT_PATTERN.lastIndex = 0` at the end of the function.

Returns: `string[]` of component names imported in that file.

### usageBuilder.ts

The orchestrator. Takes the full list of `ExtractedFile[]` from `zipExtractor` and runs a two-pass algorithm:

**Pass 1 — Build the definition map**

Iterates every file, calls `findComponents(file.content)` for each one. Collects results into a `Map<componentName, filePath>`.

```ts
// e.g. { "Button": "src/components/Button.tsx", "Modal": "src/components/Modal.tsx" }
```

If the same component name is defined in multiple files, the last one wins (this is an edge case — component names in a real project are almost always unique).

**Pass 2 — Build the usage map**

Iterates every file again, calls `parseImports(file.content)` for each one. For each imported name, records which file it was imported into.

```ts
// e.g. { "Button": ["src/pages/Home.tsx", "src/pages/Dashboard.tsx", "src/App.tsx"] }
```

**Combine**

Iterates the definition map. For each component:
- Look up its usages in the usage map (default to `[]` if not found — meaning it's unused)
- Count the array length as `usageCount`
- Compute the label
- Build the final `ComponentUsage` object

```ts
interface ComponentUsage {
  name: string;
  definedIn: string;
  usedIn: string[];
  usageCount: number;
  label: "unused" | "rarely-used" | "normal" | "core";
}
```

**Why two passes instead of one:** In a single pass, when you process a file you haven't yet seen the definitions in files that come later. You can't know if an import refers to something defined in a file you haven't read yet. The two-pass approach ensures all definitions are known before usages are attributed.

**Label thresholds:**
```ts
usageCount === 0  → "unused"
usageCount === 1  → "rarely-used"
usageCount >= 5   → "core"
default           → "normal"   // 2, 3, or 4
```

---

## The Scan Pipeline — Full Request Lifecycle

```
POST /scans/upload
  │
  ├── authenticateToken middleware (validates JWT, attaches userId)
  │
  ├── multer middleware
  │     - reads multipart/form-data
  │     - saves zip to /tmp/timestamp-filename.zip
  │     - attaches file info to req.file
  │
  ├── check req.file exists (400 if not)
  │
  ├── read projectName from req.body (default: "Untitled Project")
  │
  ├── prisma.scan.create({ status: "pending" })
  │
  ├── try:
  │     extractZip(req.file.path)
  │       → reads zip from /tmp
  │       → returns ExtractedFile[]
  │
  │     buildUsageMap(files)
  │       → findComponents() on every file
  │       → parseImports() on every file
  │       → returns ComponentUsage[]
  │
  │     prisma.component.createMany(...)
  │       → one row per component
  │
  │     prisma.scan.update({ status: "complete" })
  │
  │     fs.unlinkSync(req.file.path)
  │       → deletes zip from /tmp
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
All scans routes are protected via `router.use(authenticateToken)` at the top of the router file — one declaration covers all routes below it.

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /scans/upload | Yes | Upload zip, run scan, save results |
| GET | /scans | Yes | List all scans for the logged-in user (ordered by createdAt desc) |
| GET | /scans/:id | Yes | Get one scan with full component list (includes: { components: true }) |

### Health
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /health | No | Returns `{ status: "ok" }` — used to verify the server is running |

---

## Authentication Flow

**Registration / Login:**
The server hashes the password with `bcrypt` (cost factor 10) and stores the hash. On login, `bcrypt.compare()` verifies the password against the stored hash. If valid, a JWT is signed with the user's `id` as payload and `JWT_SECRET` as the signing key. The token expires in 7 days. The token is returned to the client.

**On the frontend:**
The token is stored in `localStorage`. The Axios client in `src/api/client.ts` has a request interceptor that reads the token from `localStorage` on every request and attaches it as `Authorization: Bearer <token>`. No manual token handling is needed in any page component.

**On the backend:**
The `authenticateToken` middleware in `src/middleware/auth.ts` reads the `Authorization` header, extracts the token after `"Bearer "`, and calls `jwt.verify()`. If valid, it attaches `userId` to the request via a custom `AuthRequest` interface that extends Express's `Request`. If the token is missing or invalid, it returns 401 or 403 immediately.

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
| Input background | `bg-zinc-800` | #27272a |
| Primary button | `bg-indigo-600` | #4f46e5 |
| Primary button hover | `bg-indigo-500` | #6366f1 |

### Label Color System (dark mode)

| Label | Background | Text | Ring |
|---|---|---|---|
| unused | `bg-red-950` | `text-red-400` | `ring-red-900` |
| rarely-used | `bg-amber-950` | `text-amber-400` | `ring-amber-900` |
| normal | `bg-sky-950` | `text-sky-400` | `ring-sky-900` |
| core | `bg-emerald-950` | `text-emerald-400` | `ring-emerald-900` |

### ComponentCard Left Border Accent

Each card has a `border-l-4` accent that matches its label section:
- unused → `border-l-red-500`
- rarely-used → `border-l-amber-500`
- normal → `border-l-sky-500`
- core → `border-l-emerald-500`

This makes sections scannable at a glance without needing to read the badge.

### Interaction Patterns

- Cards: `hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/30 transition-all duration-200`
- Buttons: `transition-colors duration-150`
- Skeleton loading: `animate-pulse` on placeholder divs while data is fetching
- Upload zone: highlighted with `border-indigo-500 bg-indigo-600/10` when a file is selected
- Submit button: shows an animated SVG spinner while scanning is in progress

---

## Environment Variables

### Backend (`.env` / Vercel dashboard)

```
DATABASE_URL=postgresql://postgres.PROJECTREF:PASSWORD@aws-0-ap-south-1.pooler.supabase.com:5432/postgres
JWT_SECRET=<long random string>
PORT=3000
ALLOWED_ORIGINS=https://your-frontend.vercel.app
```

`ALLOWED_ORIGINS` accepts a comma-separated list. The backend splits it with `.split(",")` and passes the resulting array to the `cors()` middleware. This allows both localhost and production origins to be listed without code changes.

### Frontend (`.env` / Vercel dashboard)

```
REACT_APP_API_URL=https://your-backend.vercel.app
```

The `REACT_APP_` prefix is required by CRA to expose env variables to the browser bundle. Variables without this prefix are not included in the compiled JS. Vercel injects these at **build time** — they are baked into the compiled static assets, not read at runtime. This means changing an env var on Vercel requires a redeploy to take effect.

---

## Deployment

### Backend — Vercel (Serverless)

**Why Vercel instead of Render (the previous project's choice):**
Render's free tier only allows one active web service per account. Since API Drift Observatory was already deployed there, a second service would have required a paid plan. Vercel supports Node.js Express apps as serverless functions and has no such limit on free accounts.

**Why serverless works for this project but not the previous one:**
API Drift Observatory ran `node-cron` jobs that need to execute on a timer even when no user is making a request. A serverless function only runs when a request comes in — there is no persistent process. Component Usage Checker has no background jobs. Every piece of work it does is triggered by a user request, making it a perfect fit for serverless.

**`vercel.json`:**
```json
{
  "version": 2,
  "builds": [
    { "src": "src/index.ts", "use": "@vercel/node" }
  ],
  "routes": [
    { "src": "/(.*)", "dest": "src/index.ts" }
  ]
}
```
This tells Vercel: compile `src/index.ts` using the `@vercel/node` builder (which handles TypeScript automatically), and route every incoming request to it.

**`app.listen()` guard in `src/index.ts`:**
```ts
if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}
export default app;
```
On Vercel, `NODE_ENV` is set to `"production"` automatically, so `app.listen()` never runs — Vercel handles the listening itself. Locally, `NODE_ENV` is not set (or is `"development"`), so `app.listen()` runs as normal. The `export default app` is what Vercel's `@vercel/node` builder picks up to handle requests.

**`postinstall` script in `package.json`:**
```json
"postinstall": "prisma generate"
```
The Prisma generated client is gitignored. Vercel clones the repo fresh on every deployment and runs `npm install`. The `postinstall` hook runs automatically after `npm install` completes, regenerating the Prisma client before any code runs. Without this, the import `from '../generated/prisma/client'` fails with "Cannot find module".

**`/tmp` for file uploads:**
Vercel's serverless functions run in ephemeral containers with no writable filesystem except `/tmp`. Multer is configured to write uploaded files to `/tmp` instead of `src/uploads/`. Since the zip is deleted immediately after scanning (`fs.unlinkSync()`), the temporary write to `/tmp` is all that's ever needed.

**Vercel project settings:**
- Repository: `anunrs/component-usage-checker`
- Root Directory: `backend`
- Framework: Other (auto-detected as Node.js)
- Build: handled by `vercel.json`

---

### Frontend — Vercel

**Vercel project settings:**
- Repository: `anunrs/component-usage-checker` (same monorepo, different root directory)
- Root Directory: `frontend`
- Framework Preset: Create React App (auto-detected)
- Build Command: `react-scripts build` (auto-detected)
- Output Directory: `build` (auto-detected)

**Deployment trigger:** Vercel auto-deploys on every push to `main` for both the backend and frontend projects. Both are connected to the same GitHub repo but watch different root directories.

---

### Git / GitHub

- Repository: `https://github.com/anunrs/component-usage-checker`
- Structure: Monorepo — one repo, `backend/` and `frontend/` as subfolders
- Remote connection: HTTPS
- Branch: `main`

**Important gotcha — CRA creates its own `.git` folder:**
`create-react-app` initialises a git repository inside the `frontend/` folder automatically. When trying to add `frontend/` to the parent repo, Git treats it as a submodule and refuses to include its contents normally. The fix was to delete `frontend/.git` before the first commit, then force-remove the cached submodule reference with `git rm --cached -f frontend` and re-stage everything.

**`.gitignore` excludes:**
- `node_modules/` (backend and frontend)
- `.env` (backend and frontend)
- `dist/` (compiled TypeScript output)
- `src/generated/` (Prisma generated client — regenerated on deploy)
- `src/uploads/` (local upload temp folder)
- `build/` (CRA production build output)

---

## Local Development

### Prerequisites
- Node.js 18+
- A Supabase project with the session pooler connection string

### Backend
```bash
cd backend
npm install           # also runs postinstall → prisma generate
npx prisma migrate dev --name init   # creates tables in Supabase
npm run dev           # starts nodemon + ts-node on port 3000
```

### Frontend
```bash
cd frontend
npm install
npm start             # starts CRA dev server on port 3001
```

The frontend reads `REACT_APP_API_URL` from `frontend/.env`. If not set, it falls back to `http://localhost:3000` (the backend dev server).

---

## Known Gotchas & Decisions

**Prisma v7 adapter requirement:**
Prisma v7 no longer includes a built-in database driver. You must install `@prisma/adapter-pg` and `pg` and pass an adapter instance to `PrismaClient`. The old `new PrismaClient()` with no arguments no longer connects to anything.

```ts
const pool = new Pool({ connectionString: process.env.DATABASE_URL!, ssl: { rejectUnauthorized: false } });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
```

**SSL with Supabase — `rejectUnauthorized: false` must be on the Pool, not the URL:**
Supabase uses a certificate from a CA that is not in Node's default trust store. Setting `ssl: { rejectUnauthorized: false }` tells Node to accept the certificate chain without verifying it. This must be set on the `pg.Pool` config object. If `?sslmode=require` is added to the `DATABASE_URL` string instead, the newer `pg` library treats it as strict certificate verification (`verify-full`), which overrides the Pool's ssl config and causes `self-signed certificate in certificate chain` errors. The solution is to remove `?sslmode=require` from the URL and rely solely on the Pool config.

**Global regex `lastIndex` must be reset:**
The import parser regex uses the `g` flag. JavaScript global regexes maintain state between calls via `lastIndex`. After each file is parsed, `IMPORT_PATTERN.lastIndex = 0` must be called. Without this, parsing the second and subsequent files starts from a non-zero position and silently misses imports.

**Label is not stored in the database:**
The `label` field is computed on the frontend from `usageCount`. Storing a derived value in the database would mean needing a migration if thresholds change. Since `usageCount` is always stored, the label can always be recalculated.

**CORS `ALLOWED_ORIGINS` env var:**
The backend reads `ALLOWED_ORIGINS` as a comma-separated string and splits it into an array. This means both local and production origins can be whitelisted without touching code. When updating this on Vercel, the backend project must be redeployed for the new env var to take effect.

**`https://` must be included in all URLs:**
When setting `REACT_APP_API_URL` and `ALLOWED_ORIGINS` in Vercel, the protocol (`https://`) must be included. Without it, the frontend constructs malformed request URLs (appending the API URL as a path segment of the current host) and CORS origin matching fails.

**Monorepo + Vercel = two separate Vercel projects:**
Even though backend and frontend live in the same GitHub repo, they are two completely separate Vercel projects, each configured with a different Root Directory. Renaming them in Vercel's project settings (to `component-usage-checker-backend` and `component-usage-checker-frontend`) is cosmetic only — it doesn't affect deployment.

**No keep-alive needed (unlike API Drift Observatory):**
Since this project uses Vercel serverless instead of Render's free tier, there is no spin-down problem. Vercel functions wake up in milliseconds on demand. UptimeRobot is not needed.
