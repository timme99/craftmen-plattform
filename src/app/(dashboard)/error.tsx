"use client";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isDev = process.env.NODE_ENV === "development";
  const message = isDev && error.message
    ? error.message
    : "Ein Fehler ist aufgetreten. Bitte versuche es erneut oder lade die Seite neu.";

  return (
    <div className="flex flex-col items-center justify-center min-h-64 gap-4">
      <p className="text-gray-500 text-sm text-center max-w-sm">{message}</p>
      {error.digest && (
        <p className="text-xs text-gray-400">Fehlercode: {error.digest}</p>
      )}
      <button
        onClick={reset}
        className="text-sm font-medium text-green-700 border border-green-200 px-4 py-1.5 rounded-lg hover:bg-green-50 transition-colors"
      >
        Neu laden
      </button>
    </div>
  );
}
