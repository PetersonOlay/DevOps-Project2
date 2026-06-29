import { useState, FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { login } from "../api/auth";

export default function LoginPage() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { accessToken } = await login(email, password);
      localStorage.setItem("accessToken", accessToken);
      nav("/");
    } catch {
      setError("Invalid email or password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel — brand */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-brand-600 to-brand-700 flex-col justify-center px-12 text-white">
        <div>
          <h2 className="text-5xl font-bold mb-6">DAM</h2>
          <p className="text-xl text-brand-50 mb-12">Manage your digital assets — from anywhere</p>
          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="text-2xl">🎨</div>
              <div>
                <h3 className="font-semibold mb-1">Organize effortlessly</h3>
                <p className="text-sm text-brand-100">Collections and tags keep your assets organized by project or theme</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="text-2xl">🚀</div>
              <div>
                <h3 className="font-semibold mb-1">Upload in bulk</h3>
                <p className="text-sm text-brand-100">Drag and drop multiple files. Automatic thumbnails and previews</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="text-2xl">🔗</div>
              <div>
                <h3 className="font-semibold mb-1">Share with ease</h3>
                <p className="text-sm text-brand-100">Generate public links to collaborate with clients and teams</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="w-full lg:w-1/2 bg-white flex flex-col justify-center px-8 sm:px-12">
        <div className="w-full max-w-sm mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Sign in to DAM</h1>
          <p className="text-gray-600 text-sm mb-8">Access your team's asset library</p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">Password</label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-500 hover:bg-brand-600 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-sm text-center text-gray-600">
            No account?{" "}
            <Link to="/register" className="text-brand-600 font-semibold hover:text-brand-700">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
