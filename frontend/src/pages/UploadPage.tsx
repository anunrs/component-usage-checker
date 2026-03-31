// UploadPage — zip file picker with client-side filtering
// Uses JSZip to strip everything except .ts/.tsx files (and node_modules)
// before uploading, so even a 200+ MB project zip becomes a tiny upload.

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import JSZip from "jszip";
import client from "../api/client";
import Layout from "../components/Layout";

type PickState =
  | { stage: "idle" }
  | { stage: "processing" }
  | { stage: "ready"; blob: Blob; fileCount: number; sizeKB: number }
  | { stage: "error"; message: string };

export default function UploadPage() {
  const [projectName, setProjectName] = useState("");
  const [pick, setPick]               = useState<PickState>({ stage: "idle" });
  const [uploading, setUploading]     = useState(false);
  const [uploadError, setUploadError] = useState("");
  const navigate = useNavigate();

  // Filter the picked zip in-browser: keep only .ts / .tsx outside node_modules,
  // repack into a new zip, and store the resulting Blob in state.
  async function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.files?.[0];
    if (!raw) return;

    setUploadError("");
    setPick({ stage: "processing" });

    try {
      const original = await JSZip.loadAsync(raw);
      const filtered = new JSZip();
      let fileCount  = 0;

      const tasks: Promise<void>[] = [];

      original.forEach((path, entry) => {
        if (entry.dir)                         return; // skip directories
        if (path.includes("node_modules"))     return; // skip deps
        if (!path.endsWith(".ts") && !path.endsWith(".tsx")) return; // only TS

        tasks.push(
          entry.async("arraybuffer").then((data) => {
            filtered.file(path, data);
            fileCount++;
          })
        );
      });

      await Promise.all(tasks);

      if (fileCount === 0) {
        setPick({
          stage: "error",
          message:
            "No .ts or .tsx files found in the zip. Make sure you're uploading a TypeScript / React project.",
        });
        e.target.value = "";
        return;
      }

      const blob   = await filtered.generateAsync({ type: "blob", compression: "DEFLATE" });
      const sizeKB = Math.round(blob.size / 1024);

      setPick({ stage: "ready", blob, fileCount, sizeKB });
    } catch {
      setPick({
        stage: "error",
        message: "Could not read the zip file. Make sure it's a valid .zip archive.",
      });
      e.target.value = "";
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pick.stage !== "ready") return;

    setUploadError("");
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("zipFile", pick.blob, "upload.zip");
      formData.append("projectName", projectName || "Untitled Project");
      const res = await client.post("/scans/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      navigate(`/scans/${res.data.scanId}`);
    } catch {
      setUploadError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  const canSubmit = pick.stage === "ready" && !uploading;

  return (
    <Layout>
      <div className="max-w-lg mx-auto">
        <h1 className="text-2xl font-semibold text-zinc-100 mb-1">New Scan</h1>
        <p className="text-sm text-zinc-500 mb-8">
          Upload a zip of your React + TypeScript project — any size. We'll filter it down
          to just the source files before uploading.
        </p>

        {uploadError && (
          <div className="bg-red-950 border border-red-900 text-red-400 text-sm rounded-xl px-4 py-3 mb-6">
            {uploadError}
          </div>
        )}

        {pick.stage === "error" && (
          <div className="bg-red-950 border border-red-900 text-red-400 text-sm rounded-xl px-4 py-3 mb-6">
            {pick.message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Project name</label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="e.g. My Work Project"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-150"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Zip file</label>
            <label
              className={`flex flex-col items-center justify-center w-full h-44 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-150 ${
                pick.stage === "ready"
                  ? "border-indigo-500 bg-indigo-600/10"
                  : pick.stage === "processing"
                  ? "border-zinc-600 bg-zinc-900"
                  : "border-zinc-700 bg-zinc-900 hover:border-zinc-500 hover:bg-zinc-800/50"
              }`}
            >
              {pick.stage === "processing" && (
                <div className="flex flex-col items-center gap-2 text-zinc-400">
                  <svg className="animate-spin w-6 h-6 text-indigo-400" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span className="text-sm">Filtering TypeScript files…</span>
                </div>
              )}

              {pick.stage === "ready" && (
                <div className="text-center px-4">
                  <div className="w-10 h-10 bg-indigo-600/20 rounded-xl flex items-center justify-center mx-auto mb-2">
                    <svg className="w-5 h-5 text-indigo-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-indigo-300">Ready to upload</p>
                  <p className="text-xs text-indigo-400 mt-1">
                    {pick.fileCount} TypeScript file{pick.fileCount !== 1 ? "s" : ""} · {pick.sizeKB} KB
                  </p>
                  <p className="text-xs text-zinc-600 mt-2">Click to pick a different file</p>
                </div>
              )}

              {(pick.stage === "idle" || pick.stage === "error") && (
                <div className="text-center px-4">
                  <div className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center mx-auto mb-2">
                    <svg className="w-5 h-5 text-zinc-500" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M9.25 13.25a.75.75 0 001.5 0V4.636l2.955 3.129a.75.75 0 001.09-1.03l-4.25-4.5a.75.75 0 00-1.09 0l-4.25 4.5a.75.75 0 101.09 1.03L9.25 4.636v8.614z" />
                      <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
                    </svg>
                  </div>
                  <p className="text-sm text-zinc-400 font-medium">Click to select a zip file</p>
                  <p className="text-xs text-zinc-600 mt-0.5">Any size · full project or src/ folder</p>
                </div>
              )}

              <input
                type="file"
                accept=".zip"
                className="hidden"
                onChange={handleFilePick}
                required
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors duration-150"
          >
            {uploading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Scanning…
              </span>
            ) : (
              "Upload & Scan"
            )}
          </button>
        </form>
      </div>
    </Layout>
  );
}
