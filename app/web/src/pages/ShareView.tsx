import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";

interface ShareAsset {
  id: string;
  name: string;
  mimeType: string;
  fileSize: string;
  status: string;
  viewUrl: string | null;
}

interface ShareData {
  collection: { id: string; name: string; description?: string };
  downloadAllowed: boolean;
  assets: ShareAsset[];
}

async function getShare(token: string): Promise<ShareData> {
  const { data } = await api.get(`/share/${token}`);
  return data;
}

async function downloadAsset(token: string, assetId: string): Promise<string> {
  const { data } = await api.post(`/share/${token}/download/${assetId}`);
  return data.downloadUrl;
}

export default function ShareViewPage() {
  const { token } = useParams<{ token: string }>();

  const query = useQuery({
    queryKey: ["share", token],
    queryFn: () => getShare(token!),
    enabled: !!token,
  });

  if (query.isLoading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">Loading…</div>;
  if (query.error) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-red-500">This share link has expired or is invalid.</div>;

  const share = query.data!;

  async function handleDownload(assetId: string, name: string) {
    const url = await downloadAsset(token!, assetId);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-8">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Shared collection</p>
          <h1 className="text-3xl font-bold text-gray-900">{share.collection.name}</h1>
          {share.collection.description && <p className="text-gray-500 mt-2">{share.collection.description}</p>}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {share.assets.map((asset) => (
            <div key={asset.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="bg-gray-100 aspect-square flex items-center justify-center overflow-hidden">
                {asset.viewUrl ? (
                  <img src={asset.viewUrl} alt={asset.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl text-gray-400">📄</span>
                )}
              </div>
              <div className="p-3">
                <p className="text-sm font-medium text-gray-900 truncate">{asset.name}</p>
                {share.downloadAllowed && asset.status === "READY" && (
                  <button
                    onClick={() => handleDownload(asset.id, asset.name)}
                    className="mt-2 text-xs text-brand-600 font-medium hover:underline"
                  >
                    Download
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
