// UploadPage — zip file picker with styled drop zone

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import client from "../api/client";
import Layout from "../components/Layout";

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [projectName, setProjectName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setError("");
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("zipFile", file);
      formData.append("projectName", projectName || "Untitled Project");
      const res = await client.post("/scans/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      navigate(`/scans/${res.data.scanId}`);
    } catch {
      setError("Upload failed. Make sure the file is a valid .zip.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout>
      <div className="max-w-lg mx-auto">
        <h1 className="text-2xl font-semibold text-zinc-100 mb-1">New Scan</h1>
        <p className="text-sm text-zinc-500 mb-2">
          Zip your project's <span className="font-mono text-zinc-400">src/</span> folder and upload it — we'll map every component.
        </p>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 mb-8 text-xs text-zinc-500 leading-relaxed">
          <span className="text-zinc-400 font-medium">How to zip correctly:</span> right-click your{" "}
          <span className="font-mono text-zinc-400">src/</span> folder → Compress (Mac) or Send to → Compressed folder (Windows).
          Do <span className="text-zinc-300">not</span> zip the whole project — that includes{" "}
          <span className="font-mono">node_modules</span> and will be too large to upload.
        </div>

        {error && (
          <div className="bg-red-950 border border-red-900 text-red-400 text-sm rounded-xl px-4 py-3 mb-6">
            {error}
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
              className={`flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-150 ${
                file
                  ? "border-indigo-500 bg-indigo-600/10"
                  : "border-zinc-700 bg-zinc-900 hover:border-zinc-500 hover:bg-zinc-800/50"
              }`}
            >
              {file ? (
                <div className="text-center px-4">
                  <div className="w-10 h-10 bg-indigo-600/20 rounded-xl flex items-center justify-center mx-auto mb-2">
                    <svg className="w-5 h-5 text-indigo-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-indigo-300 truncate max-w-xs">{file.name}</p>
                  <p className="text-xs text-indigo-500 mt-0.5">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              ) : (
                <div className="text-center px-4">
                  <div className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center mx-auto mb-2">
                    <svg className="w-5 h-5 text-zinc-500" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M9.25 13.25a.75.75 0 001.5 0V4.636l2.955 3.129a.75.75 0 001.09-1.03l-4.25-4.5a.75.75 0 00-1.09 0l-4.25 4.5a.75.75 0 101.09 1.03L9.25 4.636v8.614z" />
                      <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
                    </svg>
                  </div>
                  <p className="text-sm text-zinc-400 font-medium">Click to select a zip file</p>
                  <p className="text-xs text-zinc-600 mt-0.5">.zip only · max 4 MB · zip your src/ folder</p>
                </div>
              )}
              <input
                type="file"
                accept=".zip"
                className="hidden"
                onChange={(e) => {
                  const picked = e.target.files?.[0] ?? null;
                  if (picked && picked.size > 4 * 1024 * 1024) {
                    setError(
                      `File is ${(picked.size / 1024 / 1024).toFixed(0)} MB — the limit is 4 MB. ` +
                      "Please zip only your src/ folder, not the whole project."
                    );
                    setFile(null);
                    e.target.value = "";
                    return;
                  }
                  setError("");
                  setFile(picked);
                }}
                required
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={loading || !file}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors duration-150"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Scanning...
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
