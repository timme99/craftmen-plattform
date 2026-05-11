"use client";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-64 gap-4">
      <p className="text-gray-500 text-sm">{error.message || "Ein Fehler ist aufgetreten."}</p>
      <button
        onClick={reset}
        className="text-sm font-medium text-green-700 border border-green-200 px-4 py-1.5 rounded-lg hover:bg-green-50 transition-colors"
      >
        Neu laden
      </button>
    </div>
  );
}
