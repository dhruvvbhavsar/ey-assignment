import { useState, useRef } from 'react';
import { Image, X, Loader2, Send } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { postsAPI } from '../services/api';
import toast from 'react-hot-toast';
import Avatar from './Avatar';

function CreatePost({ onPostCreated }) {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  const MAX_CONTENT_LENGTH = 500;
  const remainingChars = MAX_CONTENT_LENGTH - content.length;

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please select a valid image file (JPEG, PNG, GIF, or WebP)');
      return;
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error('Image must be less than 5MB');
      return;
    }

    setImage(file);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const trimmedContent = content.trim();
    if (!trimmedContent) {
      toast.error('Please enter some content');
      return;
    }

    if (trimmedContent.length > MAX_CONTENT_LENGTH) {
      toast.error(`Content must be ${MAX_CONTENT_LENGTH} characters or less`);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await postsAPI.createPost(trimmedContent, image);

      // Reset form
      setContent('');
      removeImage();

      toast.success('Post created!');

      // Notify parent component
      if (onPostCreated) {
        onPostCreated(response.data);
      }
    } catch (error) {
      console.error('Failed to create post:', error);
      const message = error.response?.data?.detail || 'Failed to create post. Please try again.';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="card p-4">
      <form onSubmit={handleSubmit}>
        <div className="flex gap-3">
          {/* User avatar */}
          <Avatar
            src={user?.avatar_url}
            alt={user?.display_name || user?.username}
            fallbackText={user?.display_name || user?.username}
            size="md"
          />

          {/* Content area */}
          <div className="flex-1 min-w-0">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What's happening?"
              className="textarea min-h-[100px] text-lg placeholder:text-gray-400 border-none focus:ring-0 p-0 resize-none"
              disabled={isSubmitting}
              maxLength={MAX_CONTENT_LENGTH + 50} // Allow some overflow for better UX
            />

            {/* Image preview */}
            {imagePreview && (
              <div className="relative mt-3 rounded-xl overflow-hidden border border-gray-200">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="max-h-80 w-full object-cover"
                />
                <button
                  type="button"
                  onClick={removeImage}
                  className="absolute top-2 right-2 p-1.5 bg-gray-900/70 hover:bg-gray-900/90 text-white rounded-full transition-colors"
                  disabled={isSubmitting}
                >
                  <X size={18} />
                </button>
              </div>
            )}

            {/* Actions row */}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
              {/* Left side - Add image button */}
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  onChange={handleImageSelect}
                  className="hidden"
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 text-primary-500 hover:bg-primary-50 rounded-full transition-colors disabled:opacity-50"
                  disabled={isSubmitting}
                  title="Add image"
                >
                  <Image size={20} />
                </button>
              </div>

              {/* Right side - Character count and submit */}
              <div className="flex items-center gap-3">
                {/* Character count */}
                <div
                  className={`text-sm font-medium ${
                    remainingChars < 0
                      ? 'text-red-500'
                      : remainingChars < 50
                      ? 'text-yellow-500'
                      : 'text-gray-400'
                  }`}
                >
                  {remainingChars}
                </div>

                {/* Divider */}
                <div className="w-px h-6 bg-gray-200" />

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={!content.trim() || remainingChars < 0 || isSubmitting}
                  className="btn-primary px-4 py-2 text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Posting...
                    </>
                  ) : (
                    <>
                      <Send size={16} />
                      Post
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

export default CreatePost;
