import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteAsset, patchAsset } from "../api/assets";
import { Asset } from "../api/assets";

interface AssetModalProps {
  asset: Asset;
  isOpen: boolean;
  onClose: () => void;
}

export default function AssetModal({ asset, isOpen, onClose }: AssetModalProps) {
  const qc = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(asset.name);

  const updateMutation = useMutation({
    mutationFn: (name: string) => patchAsset(asset.id, { name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assets"] });
      qc.invalidateQueries({ queryKey: ["collection"] });
      setIsEditing(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteAsset(asset.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assets"] });
      qc.invalidateQueries({ queryKey: ["collection"] });
      onClose();
    },
  });

  if (!isOpen) return null;

  const fileSize = Number(asset.fileSize);
  const fileSizeMB = fileSize / 1024 / 1024;
  const fileSizeDisplay = fileSizeMB > 1024 ? `${(fileSizeMB / 1024).toFixed(1)} GB` : `${fileSizeMB.toFixed(1)} MB`;

  const statusColors = {
    READY: "bg-green-100 text-green-800",
    PROCESSING: "bg-yellow-100 text-yellow-800",
    FAILED: "bg-red-100 text-red-800",
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />

      {/* Modal slide-over */}
      <div className="fixed right-0 top-0 h-full w-96 bg-white shadow-2xl overflow-y-auto z-50 flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Asset details</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {/* Preview */}
          <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
            {asset.viewUrl ? (
              <img src={asset.viewUrl} alt={asset.name} className="w-full h-full object-cover" />
            ) : (
              <div className="text-4xl">
                {asset.mimeType.startsWith("video") ? "🎬" : asset.mimeType === "application/pdf" ? "📄" : "📁"}
              </div>
            )}
          </div>

          {/* File name (editable) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">File name</label>
            {isEditing ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  autoFocus
                />
                <button
                  onClick={() => updateMutation.mutate(editName)}
                  disabled={updateMutation.isPending}
                  className="px-3 py-2 bg-brand-500 text-white rounded-lg text-sm hover:bg-brand-600 disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditName(asset.name);
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-900 break-all">{asset.name}</p>
                <button onClick={() => setIsEditing(true)} className="text-xs text-brand-600 hover:text-brand-700 ml-2 flex-shrink-0">
                  Edit
                </button>
              </div>
            )}
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${statusColors[asset.status as keyof typeof statusColors]}`}>
              {asset.status}
            </span>
            {asset.status === "PROCESSING" && (
              <p className="text-xs text-gray-500 mt-2">Your file is being processed. Thumbnails and previews will appear shortly.</p>
            )}
            {asset.status === "FAILED" && (
              <p className="text-xs text-red-600 mt-2">Processing failed. Try re-uploading the file.</p>
            )}
          </div>

          {/* File info */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
            <div>
              <p className="text-xs text-gray-500 mb-1">File size</p>
              <p className="text-sm font-medium text-gray-900">{fileSizeDisplay}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Type</p>
              <p className="text-sm font-medium text-gray-900">{asset.mimeType.split("/")[1]?.toUpperCase()}</p>
            </div>
            {asset.width && asset.height && (
              <>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Dimensions</p>
                  <p className="text-sm font-medium text-gray-900">{asset.width}×{asset.height}</p>
                </div>
              </>
            )}
            <div>
              <p className="text-xs text-gray-500 mb-1">Uploaded</p>
              <p className="text-sm font-medium text-gray-900">{new Date(asset.createdAt).toLocaleDateString()}</p>
            </div>
          </div>

          {/* Tags */}
          {asset.tags && asset.tags.length > 0 && (
            <div className="pt-4 border-t border-gray-200">
              <p className="text-sm font-medium text-gray-700 mb-3">Tags</p>
              <div className="flex flex-wrap gap-2">
                {asset.tags.map((at) => (
                  <span
                    key={at.tag.id}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium text-white"
                    style={{ backgroundColor: at.tag.color }}
                  >
                    {at.tag.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Delete button at bottom */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4">
          <button
            onClick={() => {
              if (confirm("Delete this asset?")) {
                deleteMutation.mutate();
              }
            }}
            disabled={deleteMutation.isPending}
            className="w-full px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm hover:bg-red-100 disabled:opacity-50 font-medium"
          >
            Delete asset
          </button>
        </div>
      </div>
    </>
  );
}
