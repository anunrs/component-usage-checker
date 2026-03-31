// Dashboard — lists all past scans for the logged-in user

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import client from "../api/client";
import Layout from "../components/Layout";

interface Scan {
  id: string;
  projectName: string;
  status: string;
  createdAt: string;
}

const STATUS_STYLES: Record<string, string> = {
  complete: "bg-emerald-950 text-emerald-400 ring-1 ring-emerald-900",
  failed:   "bg-red-950 text-red-400 ring-1 ring-red-900",
  pending:  "bg-amber-950 text-amber-400 ring-1 ring-amber-900",
};

export default function Dashboard() {
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    client
      .get("/scans")
      .then((res) => setScans(res.data))
      .catch(() => {
        localStorage.removeItem("token");
        navigate("/login");
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  return (
    <Layout>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-zinc-100">Your Scans</h1>
        <p className="text-sm text-zinc-500 mt-1">
          {loading ? "" : scans.length === 0
            ? "No scans yet — upload a zip to get started."
            : `${scans.length} scan${scans.length !== 1 ? "s" : ""} total`}
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-zinc-900 rounded-xl border border-zinc-800 p-5 animate-pulse">
              <div className="h-4 bg-zinc-800 rounded w-1/3 mb-2" />
              <div className="h-3 bg-zinc-800 rounded w-1/5" />
            </div>
          ))}
        </div>
      ) : scans.length === 0 ? (
        <div className="bg-zinc-900 rounded-2xl border border-dashed border-zinc-700 p-16 text-center">
          <div className="w-12 h-12 bg-indigo-600/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-indigo-400">
              <path d="M12 4v16m8-8H4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <p className="text-zinc-300 font-medium mb-1">No scans yet</p>
          <p className="text-zinc-600 text-sm mb-6">Upload a zip of your React project to get started</p>
          <Link
            to="/upload"
            className="inline-flex items-center bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors duration-150"
          >
            Upload your first project
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {scans.map((scan) => (
            <Link
              key={scan.id}
              to={`/scans/${scan.id}`}
              className="flex items-center justify-between bg-zinc-900 rounded-xl border border-zinc-800 px-5 py-4 hover:border-zinc-700 hover:bg-zinc-800/50 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/30 transition-all duration-200 group"
            >
              <div>
                <p className="font-medium text-zinc-200 group-hover:text-indigo-400 transition-colors duration-150">
                  {scan.projectName}
                </p>
                <p className="text-xs text-zinc-600 mt-0.5">
                  {new Date(scan.createdAt).toLocaleDateString("en-US", {
                    month: "short", day: "numeric", year: "numeric",
                  })}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_STYLES[scan.status] ?? STATUS_STYLES.pending}`}>
                  {scan.status}
                </span>
                <svg className="w-4 h-4 text-zinc-700 group-hover:text-indigo-400 transition-colors duration-150" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      )}
    </Layout>
  );
}
