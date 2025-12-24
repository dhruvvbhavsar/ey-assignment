import { useState, useEffect, useCallback, useRef } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { postsAPI } from "../services/api";
import { useWebSocket } from "../context/WebSocketContext";
import { useAuth } from "../context/AuthContext";
import Post from "./Post";
import toast from "react-hot-toast";

function Feed({ userId = null, onPostCreated }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [newPostsCount, setNewPostsCount] = useState(0);
  const { subscribe, isConnected } = useWebSocket();
  const { user } = useAuth();
  const observerRef = useRef(null);
  const loadMoreRef = useRef(null);
  const isMountedRef = useRef(true);

  // Track mounted state for async operations
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Fetch posts
  const fetchPosts = useCallback(
    async (pageNum = 1, append = false) => {
      try {
        if (pageNum === 1) {
          setLoading(true);
        } else {
          setLoadingMore(true);
        }
        setError(null);

        const response = userId
          ? await postsAPI.getUserPosts(userId, pageNum)
          : await postsAPI.getFeed(pageNum);

        // Check if component is still mounted
        if (!isMountedRef.current) return;

        const { posts: newPosts, has_more } = response.data;

        setPosts((prev) => (append ? [...prev, ...newPosts] : newPosts));
        setHasMore(has_more);
        setPage(pageNum);
      } catch (err) {
        if (!isMountedRef.current) return;

        console.error("Failed to fetch posts:", err);
        const message =
          err.response?.data?.detail ||
          "Failed to load posts. Please try again.";
        setError(message);

        // Only show toast on initial load failure
        if (pageNum === 1) {
          toast.error(message);
        }
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [userId],
  );

  // Initial load and reload when userId changes
  useEffect(() => {
    setPosts([]);
    setPage(1);
    setHasMore(true);
    setNewPostsCount(0);
    fetchPosts(1, false);
  }, [fetchPosts, userId]);

  // WebSocket handlers for real-time updates
  useEffect(() => {
    if (!isConnected) return;

    const unsubscribers = [];

    // Handle new posts (only for global feed)
    const unsubNewPost = subscribe("new_post", (data) => {
      if (!isMountedRef.current) return;

      // Only add to feed if viewing global feed (not user profile)
      // Or if viewing a profile and the post is from that user
      const shouldAdd = !userId || (userId && data.author_id === userId);

      if (!shouldAdd) return;

      setPosts((prev) => {
        // Don't add if already exists (e.g., user just created it)
        const exists = prev.some((p) => p.id === data.id);
        if (exists) return prev;

        // If user is scrolled to top, add post immediately
        // Otherwise, increment new posts counter
        if (window.scrollY < 100) {
          return [data, ...prev];
        } else {
          setNewPostsCount((count) => count + 1);
          return prev;
        }
      });
    });
    unsubscribers.push(unsubNewPost);

    // Handle like updates
    const unsubLikeUpdate = subscribe("like_update", (data) => {
      if (!isMountedRef.current) return;

      setPosts((prev) =>
        prev.map((post) => {
          if (post.id === data.post_id) {
            return {
              ...post,
              likes_count: data.likes_count,
              // Update is_liked if the current user performed the action
              ...(user &&
                data.user?.id === user.id && {
                  is_liked: data.isLike,
                }),
            };
          }
          return post;
        }),
      );
    });
    unsubscribers.push(unsubLikeUpdate);

    // Handle post deletion
    const unsubPostDeleted = subscribe("post_deleted", (data) => {
      if (!isMountedRef.current) return;
      setPosts((prev) => prev.filter((post) => post.id !== data.post_id));
    });
    unsubscribers.push(unsubPostDeleted);

    // Handle new comments (update comment count)
    const unsubNewComment = subscribe("new_comment", (data) => {
      if (!isMountedRef.current) return;

      setPosts((prev) =>
        prev.map((post) => {
          if (post.id === data.post_id) {
            return {
              ...post,
              comments_count: (post.comments_count || 0) + 1,
            };
          }
          return post;
        }),
      );
    });
    unsubscribers.push(unsubNewComment);

    // Handle comment deletion
    const unsubCommentDeleted = subscribe("comment_deleted", (data) => {
      if (!isMountedRef.current) return;

      setPosts((prev) =>
        prev.map((post) => {
          if (post.id === data.post_id) {
            return {
              ...post,
              comments_count: Math.max(0, (post.comments_count || 1) - 1),
            };
          }
          return post;
        }),
      );
    });
    unsubscribers.push(unsubCommentDeleted);

    // Cleanup all subscriptions
    return () => {
      unsubscribers.forEach((unsub) => {
        if (typeof unsub === "function") {
          unsub();
        }
      });
    };
  }, [isConnected, subscribe, userId, user]);

  // Infinite scroll with Intersection Observer
  useEffect(() => {
    if (loading || !hasMore || loadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          hasMore &&
          !loadingMore &&
          isMountedRef.current
        ) {
          fetchPosts(page + 1, true);
        }
      },
      {
        threshold: 0.1,
        rootMargin: "100px", // Start loading before reaching the element
      },
    );

    observerRef.current = observer;

    const currentRef = loadMoreRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [loading, hasMore, loadingMore, page, fetchPosts]);

  // Handle new post created locally (from CreatePost component)
  const handleLocalPostCreated = useCallback(
    (newPost) => {
      setPosts((prev) => {
        // Prevent duplicates
        const exists = prev.some((p) => p.id === newPost.id);
        if (exists) return prev;
        return [newPost, ...prev];
      });

      // Call parent handler if provided
      if (onPostCreated) {
        onPostCreated(newPost);
      }
    },
    [onPostCreated],
  );

  // Handle post deletion
  const handlePostDeleted = useCallback((postId) => {
    setPosts((prev) => prev.filter((post) => post.id !== postId));
  }, []);

  // Handle post update
  const handlePostUpdated = useCallback((updatedPost) => {
    setPosts((prev) =>
      prev.map((post) =>
        post.id === updatedPost.id ? { ...post, ...updatedPost } : post,
      ),
    );
  }, []);

  // Load new posts when clicking banner
  const loadNewPosts = useCallback(() => {
    setNewPostsCount(0);
    fetchPosts(1, false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [fetchPosts]);

  // Refresh feed
  const handleRefresh = useCallback(() => {
    setNewPostsCount(0);
    fetchPosts(1, false);
  }, [fetchPosts]);

  // Loading state
  if (loading && posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
        <p className="text-gray-500">Loading posts...</p>
      </div>
    );
  }

  // Error state
  if (error && posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center">
          <span className="text-3xl">😕</span>
        </div>
        <p className="text-red-500 text-center max-w-sm">{error}</p>
        <button
          onClick={() => fetchPosts(1, false)}
          className="btn btn-primary"
        >
          Try Again
        </button>
      </div>
    );
  }

  // Empty state
  if (!loading && posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
          <span className="text-3xl">📝</span>
        </div>
        <h3 className="text-lg font-semibold text-gray-900">No posts yet</h3>
        <p className="text-gray-500 max-w-sm">
          {userId
            ? "This user hasn't posted anything yet."
            : "Be the first to share something with the community!"}
        </p>
        <button onClick={handleRefresh} className="btn btn-outline btn-sm mt-2">
          <RefreshCw size={16} className="mr-2" />
          Refresh
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* New posts banner */}
      {newPostsCount > 0 && (
        <button
          onClick={loadNewPosts}
          className="w-full py-3 bg-primary-50 text-primary-600 rounded-xl font-medium hover:bg-primary-100 transition-colors flex items-center justify-center gap-2 animate-fade-in"
        >
          <RefreshCw size={18} />
          {newPostsCount === 1 ? "1 new post" : `${newPostsCount} new posts`}
        </button>
      )}

      {/* Refresh button (only for main feed) */}
      {newPostsCount === 0 && !userId && (
        <div className="flex justify-center">
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-500 hover:text-primary-500 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      )}

      {/* Posts list */}
      <div className="space-y-4">
        {posts.map((post) => (
          <Post
            key={post.id}
            post={post}
            onDelete={handlePostDeleted}
            onUpdate={handlePostUpdated}
          />
        ))}
      </div>

      {/* Load more trigger */}
      {hasMore && (
        <div ref={loadMoreRef} className="flex justify-center py-8">
          {loadingMore ? (
            <div className="flex items-center gap-2 text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Loading more...</span>
            </div>
          ) : (
            <button
              onClick={() => fetchPosts(page + 1, true)}
              className="btn btn-outline"
            >
              Load More
            </button>
          )}
        </div>
      )}

      {/* End of feed message */}
      {!hasMore && posts.length > 0 && (
        <div className="text-center py-8 text-gray-500">
          <p>You've reached the end! 🎉</p>
        </div>
      )}
    </div>
  );
}

export default Feed;
