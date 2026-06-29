import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { getCollection, createShareLink, requestExport, pollJob, addAssetToCollection, removeAssetFromCollection } from "../api/collections";
import { listAssets } from "../api/assets";
import Navbar from "../components/Navbar";
import AssetCard from "../components/AssetCard";
import { Asset } from "../api/assets";

export default function CollectionViewPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedAssets, setSelectedAssets] = useState<string[]>([]);

  const query = useQuery({
    queryKey: ["collection", id],
    queryFn: () => getCollection(id!),
    enabled: !!id,
  });

  const allAssetsQuery = useQuery({
    queryKey: ["assets"],
    queryFn: () => listAssets(),
  });

  const addAssetMutation = useMutation({
    mutationFn: async (assetId: string) => addAssetToCollection(id!, assetId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["collection", id] });
    },
  });

  const removeAssetMutation = useMutation({
    mutationFn: async (assetId: string) => removeAssetFromCollection(id!, assetId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["collection", id] });
    },
  });

  const col = query.data;
  const allAssets = allAssetsQuery.data ?? [];

  async function handleShare() {
    const { token } = await createShareLink(id!);
    setShareToken(token);
  }

  async function handleExport() {
    setExportStatus("Queuing…");
    setExportUrl(null);
    const { jobId } = await requestExport(id!);

    const poll = async () => {
      const job = await pollJob(jobId);
      if (job.status === "DONE" && job.downloadUrl) {
        setExportStatus("Ready");
        setExportUrl(job.downloadUrl);
      } else if (job.status === "FAILED") {
        setExportStatus("Export failed");
      } else {
        setExportStatus("Preparing zip…");
        setTimeout(poll, 2000);
      }
    };
    setTimeout(poll, 1000);
  }

  async function handleAddAssets() {
    for (const assetId of selectedAssets) {
      await addAssetMutation.mutateAsync(assetId);
    }
    setSelectedAssets([]);
    setShowAddModal(false);
  }

  function handleRemoveAsset(assetId: string) {
    removeAssetMutation.mutate(assetId);
  }

  if (query.isLoading) return <div className="min-h-screen bg-gray-50"><Navbar /><p className="p-8 text-gray-400">Loading…</p></div>;
  if (!col) return null;

  const assets = (col.assets as Array<{ asset: Asset }>).map((ca) => ca.asset);
  const assetsInCollection = new Set(assets.map((a) => a.id));
  const addableAssets = allAssets.filter((a) => !assetsInCollection.has(a.id));

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{col.name}</h1>
            {col.description && <p className="text-gray-500 text-sm mt-1">{col.description}</p>}
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowAddModal(true)}
              className="text-sm px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              + Add assets
            </button>
            <button
              onClick={handleShare}
              className="text-sm px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Share link
            </button>
            <button
              onClick={handleExport}
              disabled={!!exportStatus && exportStatus !== "Export failed"}
              className="text-sm px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50"
            >
              {exportStatus ?? "Export zip"}
            </button>
          </div>
        </div>

        {shareToken && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-sm">
            <div className="flex justify-between items-center gap-3">
              <div>
                <p className="font-medium text-green-900 mb-2">Share link created!</p>
                <p className="text-green-800 break-all">{window.location.origin}/share/{shareToken}</p>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/share/${shareToken}`)
                    .then(() => alert("Link copied to clipboard!"))
                    .catch(() => alert("Failed to copy. Please copy manually."));
                }}
                className="flex-shrink-0 text-xs px-3 py-2 bg-white border border-green-300 rounded hover:bg-green-100 font-medium text-green-700 whitespace-nowrap"
              >
                📋 Copy
              </button>
            </div>
          </div>
        )}

        {exportUrl && (
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm">
            <p className="font-medium text-blue-900 mb-2">Export ready!</p>
            <a
              href={exportUrl}
              download
              className="inline-flex items-center gap-2 px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 font-medium"
            >
              ⬇️ Download zip
            </a>
          </div>
        )}

        {assets.length === 0 ? (
          <div className="text-center mt-16">
            <p className="text-gray-400 text-sm mb-4">No assets in this collection yet.</p>
            <button onClick={() => setShowAddModal(true)} className="text-brand-600 text-sm font-medium hover:text-brand-700">Add assets →</button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
            {assets.map((asset) => (
              <div key={asset.id} className="relative group">
                <AssetCard asset={asset} onClick={() => {}} />
                <button
                  onClick={() => handleRemoveAsset(asset.id)}
                  className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-sm hover:bg-red-600"
                  title="Remove from collection"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add assets modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowAddModal(false)} />
          <div className="relative bg-white w-full sm:w-96 rounded-t-2xl sm:rounded-lg shadow-lg max-h-96 overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Add assets</h2>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-6 space-y-3 max-h-72 overflow-y-auto">
              {addableAssets.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">All assets are already in this collection</p>
              ) : (
                addableAssets.map((asset) => (
                  <label key={asset.id} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedAssets.includes(asset.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedAssets([...selectedAssets, asset.id]);
                        } else {
                          setSelectedAssets(selectedAssets.filter((id) => id !== asset.id));
                        }
                      }}
                      className="w-4 h-4"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{asset.name}</p>
                      <p className="text-xs text-gray-500">{(Number(asset.fileSize) / 1024 / 1024).toFixed(1)} MB</p>
                    </div>
                  </label>
                ))
              )}
            </div>
            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex gap-3">
              <button onClick={() => setShowAddModal(false)} className="flex-1 px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-white">Cancel</button>
              <button
                onClick={handleAddAssets}
                disabled={selectedAssets.length === 0}
                className="flex-1 px-4 py-2 text-sm bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50"
              >
                Add selected ({selectedAssets.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
