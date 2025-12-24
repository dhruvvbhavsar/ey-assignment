import { useState, useCallback, useRef } from "react";
import CreatePost from "../components/CreatePost";
import Feed from "../components/Feed";

function HomePage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const feedRef = useRef(null);

  // Handle post created - the feed will update via WebSocket,
  // but we can also manually add it for immediate feedback
  const handlePostCreated = useCallback((newPost) => {
    // Force a small refresh key update to ensure feed gets the new post
    // The WebSocket should handle this, but this is a fallback
    setRefreshKey((prev) => prev + 1);

    // Scroll to top to see the new post
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Home</h1>
      </div>

      {/* Create Post Section */}
      <CreatePost onPostCreated={handlePostCreated} />

      {/* Feed Section */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <span>📰</span>
          Latest Posts
        </h2>
        <Feed key={refreshKey} ref={feedRef} />
      </div>
    </div>
  );
}

export default HomePage;
