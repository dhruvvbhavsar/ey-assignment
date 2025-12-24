import { useState, useEffect, useCallback } from 'react';
import { postsAPI } from '../services/api';
import { useWebSocket } from '../context/WebSocketContext';
import toast from 'react-hot-toast';

export function usePosts(userId = null) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const { subscribe, isConnected } = useWebSocket();

  // Fetch posts
  const fetchPosts = useCallback(async (pageNum = 1, append = false) => {
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

      const { posts: newPosts, has_more } = response.data;

      setPosts((prev) => (append ? [...prev, ...newPosts] : newPosts));
      setHasMore(has_more);
      setPage(pageNum);
    } catch (err) {
      console.error('Failed to fetch posts:', err);
      setError('Failed to load posts. Please try again.');
      toast.error('Failed to load posts');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [userId]);

  // Initial load
  useEffect(() => {
    fetchPosts(1, false);
  }, [fetchPosts]);

  // Load more posts
  const loadMore = useCallback(() => {
    if (hasMore && !loadingMore) {
      fetchPosts(page + 1, true);
    }
  }, [hasMore, loadingMore, page, fetchPosts]);

  // Refresh posts
  const refresh = useCallback(() => {
    fetchPosts(1, false);
  }, [fetchPosts]);

  // Add a new post
  const addPost = useCallback((newPost) => {
    setPosts((prev) => [newPost, ...prev]);
  }, []);

  // Remove a post
  const removePost = useCallback((postId) => {
    setPosts((prev) => prev.filter((post) => post.id !== postId));
  }, []);

  // Update a post
  const updatePost = useCallback((updatedPost) => {
    setPosts((prev) =>
      prev.map((post) => (post.id === updatedPost.id ? updatedPost : post))
    );
  }, []);

  // Update like status
  const updateLikeStatus = useCallback((postId, likesCount, isLiked) => {
    setPosts((prev) =>
      prev.map((post) =>
        post.id === postId
          ? { ...post, likes_count: likesCount, is_liked: isLiked }
          : post
      )
    );
  }, []);

  // Update comment count
  const updateCommentCount = useCallback((postId, delta) => {
    setPosts((prev) =>
      prev.map((post) =>
        post.id === postId
          ? { ...post, comments_count: Math.max(0, (post.comments_count || 0) + delta) }
          : post
      )
    );
  }, []);

  // Subscribe to WebSocket events
  useEffect(() => {
    if (!isConnected) return;

    // Handle new posts (only for global feed)
    const unsubNewPost = subscribe('new_post', (data) => {
      if (!userId) {
        setPosts((prev) => {
          const exists = prev.some((p) => p.id === data.id);
          if (exists) return prev;
          return [data, ...prev];
        });
      }
    });

    // Handle like updates
    const unsubLikeUpdate = subscribe('like_update', (data) => {
      setPosts((prev) =>
        prev.map((post) =>
          post.id === data.post_id
            ? { ...post, likes_count: data.likes_count }
            : post
        )
      );
    });

    // Handle post deletion
    const unsubPostDeleted = subscribe('post_deleted', (data) => {
      setPosts((prev) => prev.filter((post) => post.id !== data.post_id));
    });

    // Handle new comments
    const unsubNewComment = subscribe('new_comment', (data) => {
      setPosts((prev) =>
        prev.map((post) =>
          post.id === data.post_id
            ? { ...post, comments_count: (post.comments_count || 0) + 1 }
            : post
        )
      );
    });

    // Handle comment deletion
    const unsubCommentDeleted = subscribe('comment_deleted', (data) => {
      setPosts((prev) =>
        prev.map((post) =>
          post.id === data.post_id
            ? { ...post, comments_count: Math.max(0, (post.comments_count || 1) - 1) }
            : post
        )
      );
    });

    return () => {
      unsubNewPost();
      unsubLikeUpdate();
      unsubPostDeleted();
      unsubNewComment();
      unsubCommentDeleted();
    };
  }, [isConnected, subscribe, userId]);

  return {
    posts,
    loading,
    error,
    hasMore,
    loadingMore,
    loadMore,
    refresh,
    addPost,
    removePost,
    updatePost,
    updateLikeStatus,
    updateCommentCount,
  };
}

export default usePosts;
