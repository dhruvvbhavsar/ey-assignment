import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import {
  Heart,
  MessageCircle,
  Share2,
  MoreHorizontal,
  Trash2,
  Edit3,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { likesAPI, postsAPI } from '../services/api';
import Avatar from './Avatar';
import CommentSection from './CommentSection';
import toast from 'react-hot-toast';

function Post({ post, onDelete, onUpdate }) {
  const { user } = useAuth();
  const [isLiked, setIsLiked] = useState(post.is_liked || false);
  const [likesCount, setLikesCount] = useState(post.likes_count || 0);
  const [commentsCount, setCommentsCount] = useState(post.comments_count || 0);
  const [showComments, setShowComments] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [likeAnimation, setLikeAnimation] = useState(false);

  const isAuthor = user?.id === post.author_id;

  // Update local state when post prop changes
  useEffect(() => {
    setIsLiked(post.is_liked || false);
    setLikesCount(post.likes_count || 0);
    setCommentsCount(post.comments_count || 0);
  }, [post]);

  const handleLike = async () => {
    if (isLiking) return;

    setIsLiking(true);
    const previousIsLiked = isLiked;
    const previousCount = likesCount;

    // Optimistic update
    setIsLiked(!isLiked);
    setLikesCount(isLiked ? likesCount - 1 : likesCount + 1);

    if (!isLiked) {
      setLikeAnimation(true);
      setTimeout(() => setLikeAnimation(false), 600);
    }

    try {
      await likesAPI.toggleLike(post.id);
    } catch (error) {
      // Revert on error
      setIsLiked(previousIsLiked);
      setLikesCount(previousCount);
      toast.error('Failed to update like');
    } finally {
      setIsLiking(false);
    }
  };

  const handleDelete = async () => {
    if (isDeleting) return;

    if (!window.confirm('Are you sure you want to delete this post?')) {
      return;
    }

    setIsDeleting(true);
    try {
      await postsAPI.deletePost(post.id);
      toast.success('Post deleted');
      if (onDelete) {
        onDelete(post.id);
      }
    } catch (error) {
      toast.error('Failed to delete post');
    } finally {
      setIsDeleting(false);
      setShowMenu(false);
    }
  };

  const handleEdit = async () => {
    if (!editContent.trim()) {
      toast.error('Post content cannot be empty');
      return;
    }

    try {
      const response = await postsAPI.updatePost(post.id, editContent);
      toast.success('Post updated');
      setIsEditing(false);
      if (onUpdate) {
        onUpdate(response.data);
      }
    } catch (error) {
      toast.error('Failed to update post');
    }
  };

  const handleShare = async () => {
    const postUrl = `${window.location.origin}/post/${post.id}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Check out this post',
          text: post.content.substring(0, 100),
          url: postUrl,
        });
      } catch (error) {
        // User cancelled or share failed
        if (error.name !== 'AbortError') {
          copyToClipboard(postUrl);
        }
      }
    } else {
      copyToClipboard(postUrl);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success('Link copied to clipboard');
    }).catch(() => {
      toast.error('Failed to copy link');
    });
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
      if (showMenu && !event.target.closest('.post-menu')) {
        setShowMenu(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showMenu]);

  return (
    <article className="card p-4 animate-fade-in">
      {/* Post Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to={`/profile/${post.author_id}`}>
            <Avatar
              src={post.author?.avatar_url}
              alt={post.author?.display_name || post.author?.username}
              fallbackText={post.author?.display_name || post.author?.username}
              size="md"
              className="hover:opacity-80 transition-opacity"
            />
          </Link>

          <div className="min-w-0">
            <Link
              to={`/profile/${post.author_id}`}
              className="font-semibold text-gray-900 hover:underline truncate block"
            >
              {post.author?.display_name || post.author?.username}
            </Link>
            <div className="flex items-center gap-1 text-sm text-gray-500">
              <Link
                to={`/profile/${post.author_id}`}
                className="hover:underline"
              >
                @{post.author?.username}
              </Link>
              <span>·</span>
              <time
                dateTime={post.created_at}
                className="hover:underline"
                title={new Date(post.created_at).toLocaleString()}
              >
                {formatDate(post.created_at)}
              </time>
            </div>
          </div>
        </div>

        {/* Post Menu */}
        {isAuthor && (
          <div className="relative post-menu">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
            >
              <MoreHorizontal size={20} />
            </button>

            {showMenu && (
              <div className="dropdown-menu">
                <button
                  onClick={() => {
                    setIsEditing(true);
                    setShowMenu(false);
                  }}
                  className="dropdown-item flex items-center gap-2"
                >
                  <Edit3 size={16} />
                  Edit
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="dropdown-item-danger flex items-center gap-2"
                >
                  <Trash2 size={16} />
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Post Content */}
      <div className="mt-3">
        {isEditing ? (
          <div className="space-y-3">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="textarea min-h-[100px]"
              maxLength={500}
              placeholder="What's on your mind?"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setIsEditing(false);
                  setEditContent(post.content);
                }}
                className="btn btn-secondary btn-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleEdit}
                className="btn btn-primary btn-sm"
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <p className="text-gray-900 whitespace-pre-wrap break-word">
            {post.content}
          </p>
        )}
      </div>

      {/* Post Image */}
      {post.image_url && (
        <div className="mt-3 rounded-xl overflow-hidden border border-gray-200">
          <img
            src={post.image_url}
            alt="Post attachment"
            className="w-full max-h-[500px] object-cover"
            loading="lazy"
          />
        </div>
      )}

      {/* Post Actions */}
      <div className="mt-4 flex items-center gap-6 pt-3 border-t border-gray-100">
        {/* Like Button */}
        <button
          onClick={handleLike}
          disabled={isLiking}
          className={`flex items-center gap-2 transition-colors ${
            isLiked
              ? 'text-red-500'
              : 'text-gray-500 hover:text-red-500'
          }`}
        >
          <Heart
            size={20}
            fill={isLiked ? 'currentColor' : 'none'}
            className={likeAnimation ? 'animate-heart-beat' : ''}
          />
          <span className="text-sm font-medium">{likesCount}</span>
        </button>

        {/* Comment Button */}
        <button
          onClick={() => setShowComments(!showComments)}
          className={`flex items-center gap-2 transition-colors ${
            showComments
              ? 'text-primary-500'
              : 'text-gray-500 hover:text-primary-500'
          }`}
        >
          <MessageCircle size={20} />
          <span className="text-sm font-medium">{commentsCount}</span>
        </button>

        {/* Share Button */}
        <button
          onClick={handleShare}
          className="flex items-center gap-2 text-gray-500 hover:text-primary-500 transition-colors"
        >
          <Share2 size={20} />
          <span className="text-sm font-medium hidden sm:inline">Share</span>
        </button>
      </div>

      {/* Comments Section */}
      {showComments && (
        <CommentSection
          postId={post.id}
          onCommentCountChange={setCommentsCount}
        />
      )}
    </article>
  );
}

export default Post;
