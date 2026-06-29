import { useNavigate, Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { logout, getMe } from "../api/auth";

export default function Navbar() {
  const nav = useNavigate();
  const loc = useLocation();
  const { data: user } = useQuery({ queryKey: ["me"], queryFn: getMe });

  const isCollectionView = loc.pathname.startsWith("/collections/");

  async function handleLogout() {
    await logout();
    nav("/login");
  }

  const userInitial = user?.email?.charAt(0).toUpperCase() ?? "?";

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link to="/" className="text-lg font-bold text-brand-600">DAM</Link>

        {/* Breadcrumb */}
        <div className="flex-1 ml-8 text-sm text-gray-600">
          <Link to="/" className="hover:text-gray-900 font-medium">Assets</Link>
          {isCollectionView && (
            <>
              <span className="mx-2 text-gray-400">/</span>
              <span className="text-gray-900">{loc.pathname.split("/").pop()}</span>
            </>
          )}
        </div>

        {/* User menu */}
        <div className="flex items-center gap-3">
          {user && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50">
              <div className="w-7 h-7 rounded-full bg-brand-500 text-white flex items-center justify-center text-xs font-semibold">
                {userInitial}
              </div>
              <div className="text-xs hidden sm:block">
                <p className="font-medium text-gray-900">{user.org?.name}</p>
                <p className="text-gray-600">{user.email}</p>
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="text-sm px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </nav>
  );
}
