export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-slate-200 bg-slate-950 p-4">
      <h1 className="text-4xl font-bold mb-2">404 - Page Not Found</h1>
      <p className="text-slate-400 mb-4">The requested resource could not be found.</p>
      <a href="/" className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white font-medium">
        Return Home
      </a>
    </div>
  );
}
