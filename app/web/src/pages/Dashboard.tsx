import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { listAssets, Asset } from "../api/assets";
import { listTags } from "../api/tags";
import { listCollections, createCollection } from "../api/collections";
import Navbar from "../components/Navbar";
import AssetCard from "../components/AssetCard";
import TagFilter from "../components/TagFilter";
import UploadZone from "../components/UploadZone";

export default function DashboardPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [showNewCollection, setShowNewCollection] = useState(false);
  const [newColName, setNewColName] = useState("");

  const assetsQuery = useQuery({
    queryKey: ["assets", selectedTag],
    queryFn: () => listAssets(selectedTag ? { tagId: selectedTag } : undefined),
  });

  const tagsQuery = useQuery({ queryKey: ["tags"], queryFn: listTags });
  const collectionsQuery = useQuery({ queryKey: ["collections"], queryFn: listCollections });

  async function handleCreateCollection(e: React.FormEvent) {
    e.preventDefault();
    await createCollection(newColName.trim());
    setNewColName("");
    setShowNewCollection(false);
    qc.invalidateQueries({ queryKey: ["collections"] });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-7xl mx-auto px-6 py-8 flex gap-8">

        {/* Sidebar */}
        <aside className="w-56 flex-shrink-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Collections</p>
          <ul className="space-y-1 mb-4">
            {collectionsQuery.data?.map((col) => (
              <li key={col.id}>
                <button
                  onClick={() => nav(`/collections/${col.id}`)}
                  className="w-full text-left text-sm px-3 py-1.5 rounded-lg text-gray-700 hover:bg-gray-100 truncate"
                >
                  {col.name}
                  <span className="ml-1 text-gray-400 text-xs">({col._count?.assets ?? 0})</span>
                </button>
              </li>
            ))}
          </ul>
          {showNewCollection ? (
            <form onSubmit={handleCreateCollection} className="flex gap-1">
              <input
                autoFocus
                value={newColName}
                onChange={(e) => setNewColName(e.target.value)}
                placeholder="Collection name"
                className="text-xs border border-gray-300 rounded px-2 py-1 flex-1 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              <button type="submit" className="text-xs bg-brand-500 text-white px-2 rounded">+</button>
            </form>
          ) : (
            <button
              onClick={() => setShowNewCollection(true)}
              className="text-xs text-brand-600 hover:underline px-3"
            >
              + New collection
            </button>
          )}
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0">
          <div className="mb-6">
            <UploadZone onUploaded={() => qc.invalidateQueries({ queryKey: ["assets"] })} />
          </div>

          {/* Tag filter */}
          {tagsQuery.data && tagsQuery.data.length > 0 && (
            <div className="mb-5">
              <TagFilter tags={tagsQuery.data} selected={selectedTag} onSelect={setSelectedTag} />
            </div>
          )}

          {/* Asset grid */}
          {assetsQuery.isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="bg-gray-200 rounded-xl aspect-square animate-pulse" />
              ))}
            </div>
          ) : assetsQuery.data?.length === 0 ? (
            <p className="text-gray-400 text-sm text-center mt-16">No assets yet — upload something above.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
              {assetsQuery.data?.map((asset: Asset) => (
                <AssetCard key={asset.id} asset={asset} onClick={() => {/* TODO: open detail modal */}} />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
