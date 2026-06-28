import { useRef, useState, DragEvent } from "react";
import { getUploadUrl, uploadToS3, confirmUpload } from "../api/assets";

interface Props {
  onUploaded: () => void;
}

export default function UploadZone({ onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  async function handleFiles(files: FileList) {
    setUploading(true);
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setProgress(`Uploading ${file.name} (${i + 1}/${files.length})`);
      try {
        const { assetId, uploadUrl } = await getUploadUrl({
          name: file.name,
          mimeType: file.type || "application/octet-stream",
          fileSize: file.size,
        });
        await uploadToS3(uploadUrl, file);
        await confirmUpload(assetId);
      } catch (err) {
        console.error("Upload failed for", file.name, err);
      }
    }
    setProgress(null);
    setUploading(false);
    onUploaded();
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => !uploading && inputRef.current?.click()}
      className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
        ${dragging ? "border-brand-500 bg-brand-50" : "border-gray-300 hover:border-brand-400"}`}
    >
      <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => e.target.files && handleFiles(e.target.files)} />
      {uploading ? (
        <p className="text-sm text-gray-600 animate-pulse">{progress}</p>
      ) : (
        <>
          <p className="text-gray-500 text-sm font-medium">Drop files here or click to upload</p>
          <p className="text-gray-400 text-xs mt-1">Images, videos, PDFs, and more — up to 5 GB each</p>
        </>
      )}
    </div>
  );
}
