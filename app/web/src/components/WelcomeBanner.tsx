import { useState, useEffect } from "react";

export default function WelcomeBanner() {
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem("dam_welcome_dismissed");
    if (dismissed) setIsDismissed(true);
  }, []);

  if (isDismissed) return null;

  const handleDismiss = () => {
    localStorage.setItem("dam_welcome_dismissed", "true");
    setIsDismissed(true);
  };

  return (
    <div className="mb-6 p-6 bg-gradient-to-r from-brand-50 to-brand-100 border border-brand-200 rounded-xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Welcome to DAM</h2>
          <p className="text-sm text-gray-600">Here's how to get started</p>
        </div>
        <button
          onClick={handleDismiss}
          className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
        >
          ×
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="flex gap-3">
          <div className="text-2xl flex-shrink-0">📁</div>
          <div>
            <p className="font-medium text-gray-900 text-sm">Create a collection</p>
            <p className="text-xs text-gray-600 mt-1">Use the left sidebar to group assets by project, campaign, or client</p>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="text-2xl flex-shrink-0">📤</div>
          <div>
            <p className="font-medium text-gray-900 text-sm">Upload your files</p>
            <p className="text-xs text-gray-600 mt-1">Drag and drop files or click the upload zone above. Files are processed automatically</p>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="text-2xl flex-shrink-0">🔗</div>
          <div>
            <p className="font-medium text-gray-900 text-sm">Share with others</p>
            <p className="text-xs text-gray-600 mt-1">Open a collection and create a share link. Anyone with the link can view your assets</p>
          </div>
        </div>
      </div>
    </div>
  );
}
