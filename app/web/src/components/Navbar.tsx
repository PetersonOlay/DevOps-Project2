import { useNavigate, Link } from "react-router-dom";
import { logout } from "../api/auth";

export default function Navbar() {
  const nav = useNavigate();

  async function handleLogout() {
    await logout();
    nav("/login");
  }

  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
      <Link to="/" className="text-lg font-bold text-brand-600">DAM</Link>
      <div className="flex items-center gap-4">
        <Link to="/" className="text-sm text-gray-600 hover:text-gray-900">Assets</Link>
        <button
          onClick={handleLogout}
          className="text-sm text-gray-500 hover:text-gray-900"
        >
          Sign out
        </button>
      </div>
    </nav>
  );
}
