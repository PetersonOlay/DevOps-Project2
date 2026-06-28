import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getCollection, createShareLink, requestExport, pollJob } from "../api/collections";
import Navbar from "../components/Navbar";
import AssetCard from "../components/AssetCard";
import { Asset } from "../api/assets";

export default function CollectionViewPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [exportUrl, setExportUrl] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["collection", id],
    queryFn: () => getCollection(id!),
    enabled: !!id,
  });

  const col = query.data;

  async function handleShare() {
    const { token } = await createShareLink(id!);
    setShareToken(token);
  }

  async function handleExport() {
    setExportStatus("Queuing…");
    setExportUrl(null);
    const { jobId } = await requestExport(id!);

    // Poll until done
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

  if (query.isLoading) return <div className="min-h-screen bg-gray-50"><Navbar /><p className="p-8 text-gray-400">Loading…</p></div>;
  if (!col) return null;

  const assets = (col.assets as Array<{ asset: Asset }>).map((ca) => ca.asset);

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
            Share URL:{" "}
            <a href={`/share/${shareToken}`} target="_blank" rel="noreferrer" className="text-brand-600 font-medium underline">
              {window.location.origin}/share/{shareToken}
            </a>
          </div>
        )}

        {exportUrl && (
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm">
            <a href={exportUrl} download className="text-brand-600 font-medium underline">Download zip</a>
          </div>
        )}

        {assets.length === 0 ? (
          <p className="text-gray-400 text-sm text-center mt-16">No assets in this collection yet.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
            {assets.map((asset) => (
              <AssetCard key={asset.id} asset={asset} onClick={() => {}} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
