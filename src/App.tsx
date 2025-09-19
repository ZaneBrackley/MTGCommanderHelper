import { Link, Routes, Route, Navigate } from "react-router-dom";
import { DataProvider } from "./state/DataContext";
import SearchPage from "./views/SearchPage";
import ChallengePage from "./views/ChallengePage";

export default function App() {
  return (
    // ⬇️ let the app own the full viewport and grow vertically
    <div className="min-h-screen flex flex-col bg-neutral-950 text-neutral-100">
      <header className="sticky top-0 z-10 backdrop-blur bg-neutral-950/70 border-b border-neutral-800">
        {/* ⬇️ remove mx-auto/max-w; keep some padding */}
        <div className="px-4 py-4 flex items-center gap-4">
          <span className="text-lg font-semibold">Commander Picker</span>
          <nav className="ml-auto flex gap-4 text-sm">
            <Link className="hover:underline" to="/search">Search</Link>
            <Link className="hover:underline" to="/challenge">32-Deck Challenge</Link>
          </nav>
        </div>
      </header>

      {/* ⬇️ flex-1 makes main fill the remaining height; px keeps edge padding */}
      <main className="flex-1 px-4 py-8">
        <DataProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/search" replace />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/challenge" element={<ChallengePage />} />
            <Route path="*" element={<div>Not found</div>} />
          </Routes>
        </DataProvider>
      </main>
    </div>
  );
}
