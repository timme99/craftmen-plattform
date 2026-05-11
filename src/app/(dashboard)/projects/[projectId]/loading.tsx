export default function ProjectLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-64 bg-gray-200 rounded" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 h-20" />
        ))}
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-5 h-48" />
    </div>
  );
}
