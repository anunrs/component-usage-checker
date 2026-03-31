// Layout — shared nav wrapper for all authenticated pages

import React from "react";
import { Link, useNavigate } from "react-router-dom";

export default function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();

  function handleLogout() {
    localStorage.removeItem("token");
    navigate("/login");
  }

  return (
    <div className="min-h-screen bg-zinc-950 font-sans">
      <nav className="bg-zinc-900 border-b border-zinc-800 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="1" y="1" width="5" height="5" rx="1" fill="white" />
                <rect x="8" y="1" width="5" height="5" rx="1" fill="white" fillOpacity="0.6" />
                <rect x="1" y="8" width="5" height="5" rx="1" fill="white" fillOpacity="0.6" />
                <rect x="8" y="8" width="5" height="5" rx="1" fill="white" fillOpacity="0.3" />
              </svg>
            </div>
            <span className="font-semibold text-zinc-100 text-sm tracking-tight">
              Component Checker
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              to="/upload"
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors duration-150"
            >
              + New Scan
            </Link>
            <button
              onClick={handleLogout}
              className="text-sm text-zinc-500 hover:text-zinc-200 transition-colors duration-150"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-10">{children}</main>
    </div>
  );
}
