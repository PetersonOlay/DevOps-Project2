import { Asset } from "../api/assets";

interface Props {
  asset: Asset;
  onClick: () => void;
}

const STATUS_BADGE: Record<string, string> = {
  READY: "bg-green-100 text-green-700",
  PROCESSING: "bg-yellow-100 text-yellow-700",
  FAILED: "bg-red-100 text-red-700",
};

function humanSize(bytes: string): string {
  const n = parseInt(bytes);
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

export default function AssetCard({ asset, onClick }: Props) {
  return (
    <div
      onClick={onClick}
      className="group bg-white rounded-xl border border-gray-200 overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
    >
      {/* Thumbnail */}
      <div className="bg-gray-100 aspect-square flex items-center justify-center overflow-hidden">
        {asset.viewUrl ? (
          <img src={asset.viewUrl} alt={asset.name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-3xl text-gray-400">
            {asset.mimeType.startsWith("video/") ? "🎬" :
             asset.mimeType === "application/pdf" ? "📄" : "📁"}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="text-sm font-medium text-gray-900 truncate">{asset.name}</p>
        <div className="flex items-center justify-between mt-1">
          <p className="text-xs text-gray-400">{humanSize(asset.fileSize)}</p>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[asset.status]}`}>
            {asset.status}
          </span>
        </div>
        {/* Tags */}
        {asset.tags && asset.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {asset.tags.slice(0, 3).map(({ tag }) => (
              <span
                key={tag.id}
                style={{ backgroundColor: tag.color + "22", color: tag.color }}
                className="text-[10px] font-medium px-1.5 py-0.5 rounded"
              >
                {tag.name}
              </span>
            ))}
            {asset.tags.length > 3 && (
              <span className="text-[10px] text-gray-400">+{asset.tags.length - 3}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
