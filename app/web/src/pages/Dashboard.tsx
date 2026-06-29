import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { listAssets, deleteAsset, Asset } from "../api/assets";
import { listTags } from "../api/tags";
import { listCollections, createCollection, deleteCollection } from "../api/collections";
import Navbar from "../components/Navbar";
import AssetCard from "../components/AssetCard";
import AssetModal from "../components/AssetModal";
import TagFilter from "../components/TagFilter";
import UploadZone from "../components/UploadZone";
import WelcomeBanner from "../components/WelcomeBanner";

export default function DashboardPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [showNewCollection, setShowNewCollection] = useState(false);
  const [newColName, setNewColName] = useState("");
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const assetsQuery = useQuery({
    queryKey: ["assets", selectedTag],
    queryFn: () => listAssets(selectedTag ? { tagId: selectedTag } : undefined),
  });

  const tagsQuery = useQuery({ queryKey: ["tags"], queryFn: listTags });
  const collectionsQuery = useQuery({ queryKey: ["collections"], queryFn: listCollections });

  const deleteMutation = useMutation({
    mutationFn: (assetId: string) => deleteAsset(assetId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assets"] });
      setSelectedAsset(null);
    },
  });

  const deleteCollectionMutation = useMutation({
    mutationFn: (collectionId: string) => deleteCollection(collectionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["collections"] });
    },
  });

  async function handleCreateCollection(e: React.FormEvent) {
    e.preventDefault();
    if (!newColName.trim()) return;
    await createCollection(newColName.trim());
    setNewColName("");
    setShowNewCollection(false);
    qc.invalidateQueries({ queryKey: ["collections"] });
  }

  const filteredAssets = (assetsQuery.data || []).filter((asset) =>
    asset.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const assets = assetsQuery.data || [];
  const collections = collectionsQuery.data || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-7xl mx-auto px-6 py-8 flex gap-8">

        {/* Sidebar */}
        <aside className="w-64 flex-shrink-0">
          <div className="space-y-6">
            {/* Collections section */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Collections</p>
              {collections.length === 0 ? (
                <p className="text-sm text-gray-500 mb-3">Create your first collection →</p>
              ) : (
                <ul className="space-y-1 mb-4">
                  {collections.map((col) => (
                    <li key={col.id} className="group flex items-center">
                      <button
                        onClick={() => nav(`/collections/${col.id}`)}
                        className="flex-1 text-left text-sm px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 truncate"
                      >
                        {col.name}
                        <span className="ml-1 text-gray-400 text-xs">({col._count?.assets ?? 0})</span>
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete collection "${col.name}"?`)) {
                            deleteCollectionMutation.mutate(col.id);
                          }
                        }}
                        className="opacity-0 group-hover:opacity-100 px-2 py-1 text-gray-400 hover:text-red-600 transition-opacity"
                        title="Delete collection"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {showNewCollection ? (
                <form onSubmit={handleCreateCollection} className="flex gap-1">
                  <input
                    autoFocus
                    aria-label="Collection name"
                    value={newColName}
                    onChange={(e) => setNewColName(e.target.value)}
                    placeholder="Collection name"
                    className="text-xs border border-gray-300 rounded px-2 py-1 flex-1 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                  <button type="submit" aria-label="Create collection" className="text-xs bg-brand-500 text-white px-2 rounded hover:bg-brand-600">✓</button>
                  <button type="button" onClick={() => { setShowNewCollection(false); setNewColName(""); }} className="text-xs border border-gray-300 px-2 rounded hover:bg-gray-50">✕</button>
                </form>
              ) : (
                <button
                  onClick={() => setShowNewCollection(true)}
                  className="text-xs text-brand-600 hover:text-brand-700 font-medium px-3 py-2"
                >
                  + New collection
                </button>
              )}
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0">
          {/* Welcome banner */}
          {assets.length === 0 && <WelcomeBanner />}

          {/* Upload zone */}
          <div className="mb-6">
            <UploadZone onUploaded={() => qc.invalidateQueries({ queryKey: ["assets"] })} />
          </div>

          {/* Search & filters */}
          {assets.length > 0 && (
            <div className="mb-6 flex flex-col sm:flex-row gap-4">
              <input
                type="text"
                placeholder="Search assets…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              {tagsQuery.data && tagsQuery.data.length > 0 && (
                <div className="flex-1">
                  <TagFilter tags={tagsQuery.data} selected={selectedTag} onSelect={setSelectedTag} />
                </div>
              )}
            </div>
          )}

          {/* Asset grid */}
          {assetsQuery.isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="bg-gray-200 rounded-xl aspect-square animate-pulse" />
              ))}
            </div>
          ) : filteredAssets.length === 0 && assets.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-gray-400 text-sm">No assets yet</p>
              <p className="text-gray-500 text-xs mt-1">Upload your first file above to get started</p>
            </div>
          ) : filteredAssets.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-400 text-sm">No assets match your search</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
              {filteredAssets.map((asset) => (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  onClick={() => setSelectedAsset(asset)}
                  onDelete={() => {
                    if (confirm("Delete this asset?")) {
                      deleteMutation.mutate(asset.id);
                    }
                  }}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Asset detail modal */}
      {selectedAsset && (
        <AssetModal
          asset={selectedAsset}
          isOpen={!!selectedAsset}
          onClose={() => setSelectedAsset(null)}
        />
      )}
    </div>
  );
}
