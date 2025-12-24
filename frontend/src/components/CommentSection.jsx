import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Send, Loader2, Trash2, MoreHorizontal } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { commentsAPI } from '../services/api';
import Avatar from './Avatar';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

function CommentSection({ postId, onCommentCountChange }) {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeMenu, setActiveMenu] = useState(null);

  // Load comments on mount
  useEffect(() => {
    loadComments();
  }, [postId]);

  const loadComments = async () => {
    try {
      setIsLoading(true);
      const response = await commentsAPI.getPostComments(postId);
      setComments(response.data.comments || []);
    } catch (error) {
      console.error('Failed to load comments:', error);
      toast.error('Failed to load comments');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const trimmedComment = newComment.trim();
    if (!trimmedComment) return;

    if (trimmedComment.length > 300) {
      toast.error('Comment must be 300 characters or less');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await commentsAPI.createComment(postId, trimmedComment);
      setComments((prev) => [...prev, response.data]);
      setNewComment('');

      // Update comment count in parent
      if (onCommentCountChange) {
        onCommentCountChange((prev) => prev + 1);
      }
    } catch (error) {
      console.error('Failed to create comment:', error);
      const message = error.response?.data?.detail || 'Failed to post comment';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (commentId) => {
    if (!window.confirm('Are you sure you want to delete this comment?')) {
      return;
    }

    try {
      await commentsAPI.deleteComment(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));

      // Update comment count in parent
      if (onCommentCountChange) {
        onCommentCountChange((prev) => Math.max(0, prev - 1));
      }

      toast.success('Comment deleted');
    } catch (error) {
      console.error('Failed to delete comment:', error);
      toast.error('Failed to delete comment');
    } finally {
      setActiveMenu(null);
    }
  };

  const formatDate = (dateString) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return 'Just now';
    }
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (activeMenu && !event.target.closest('.comment-menu')) {
        setActiveMenu(null);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [activeMenu]);

  return (
    <div className="mt-4 pt-4 border-t border-gray-100">
      {/* Comment Input */}
      <form onSubmit={handleSubmit} className="flex gap-3 mb-4">
        <Avatar
          src={user?.avatar_url}
          alt={user?.display_name || user?.username}
          fallbackText={user?.display_name || user?.username}
          size="sm"
        />

        <div className="flex-1 flex gap-2">
          <input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Write a comment..."
            className="input py-2 text-sm flex-1"
            disabled={isSubmitting}
            maxLength={300}
          />
          <button
            type="submit"
            disabled={!newComment.trim() || isSubmitting}
            className="btn btn-primary btn-sm px-3"
          >
            {isSubmitting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Send size={16} />
            )}
          </button>
        </div>
      </form>

      {/* Comments List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 size={24} className="animate-spin text-gray-400" />
          </div>
        ) : comments.length === 0 ? (
          <p className="text-center text-gray-500 py-4 text-sm">
            No comments yet. Be the first to comment!
          </p>
        ) : (
          comments.map((comment) => (
            <div
              key={comment.id}
              className="flex gap-3 p-3 bg-gray-50 rounded-lg animate-fade-in"
            >
              <Link to={`/profile/${comment.author_id}`}>
                <Avatar
                  src={comment.author?.avatar_url}
                  alt={comment.author?.display_name || comment.author?.username}
                  fallbackText={comment.author?.display_name || comment.author?.username}
                  size="sm"
                  className="hover:opacity-80 transition-opacity"
                />
              </Link>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Link
                      to={`/profile/${comment.author_id}`}
                      className="font-medium text-gray-900 hover:underline truncate"
                    >
                      {comment.author?.display_name || comment.author?.username}
                    </Link>
                    <span className="text-xs text-gray-500">
                      {formatDate(comment.created_at)}
                    </span>
                  </div>

                  {/* Comment Menu (for author only) */}
                  {user?.id === comment.author_id && (
                    <div className="relative comment-menu">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenu(activeMenu === comment.id ? null : comment.id);
                        }}
                        className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-full transition-colors"
                      >
                        <MoreHorizontal size={16} />
                      </button>

                      {activeMenu === comment.id && (
                        <div className="absolute right-0 mt-1 w-32 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                          <button
                            onClick={() => handleDelete(comment.id)}
                            className="dropdown-item-danger flex items-center gap-2 w-full text-sm"
                          >
                            <Trash2 size={14} />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap break-word">
                  {comment.content}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default CommentSection;
