import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Edit3, Save, X, Loader2, Calendar, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authAPI, postsAPI } from '../services/api';
import Avatar from '../components/Avatar';
import Feed from '../components/Feed';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

function ProfilePage() {
  const { userId } = useParams();
  const { user: currentUser, updateUser } = useAuth();
  const [profileUser, setProfileUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    display_name: '',
    bio: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [stats, setStats] = useState({ posts: 0 });

  // Determine if viewing own profile
  const isOwnProfile = !userId || userId === String(currentUser?.id);
  const targetUserId = isOwnProfile ? currentUser?.id : parseInt(userId, 10);

  // Fetch profile data
  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      try {
        if (isOwnProfile && currentUser) {
          setProfileUser(currentUser);
          setEditForm({
            display_name: currentUser.display_name || '',
            bio: currentUser.bio || '',
          });
        } else if (targetUserId) {
          const response = await authAPI.getUserById(targetUserId);
          setProfileUser(response.data);
        }

        // Fetch post count
        if (targetUserId) {
          const postsResponse = await postsAPI.getUserPosts(targetUserId, 1, 1);
          setStats({ posts: postsResponse.data.total || 0 });
        }
      } catch (error) {
        console.error('Failed to load profile:', error);
        toast.error('Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [targetUserId, isOwnProfile, currentUser]);

  const handleEditToggle = () => {
    if (isEditing) {
      // Cancel editing - reset form
      setEditForm({
        display_name: profileUser?.display_name || '',
        bio: profileUser?.bio || '',
      });
    }
    setIsEditing(!isEditing);
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      const result = await updateUser(editForm);
      if (result.success) {
        setProfileUser(prev => ({
          ...prev,
          ...editForm,
        }));
        setIsEditing(false);
        toast.success('Profile updated successfully');
      } else {
        toast.error(result.error || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Failed to save profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const formatJoinDate = (dateString) => {
    try {
      return format(new Date(dateString), 'MMMM yyyy');
    } catch {
      return 'Unknown';
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
        <p className="text-gray-500">Loading profile...</p>
      </div>
    );
  }

  if (!profileUser) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
          <span className="text-3xl">😕</span>
        </div>
        <h3 className="text-lg font-semibold text-gray-900">User not found</h3>
        <p className="text-gray-500">
          The profile you're looking for doesn't exist or has been removed.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Profile Header Card */}
      <div className="card overflow-visible">
        {/* Cover/Banner Area */}
        <div className="h-32 bg-gradient-to-r from-primary-400 to-primary-600" />

        {/* Profile Info */}
        <div className="px-6 pb-6">
          {/* Avatar */}
          <div className="relative -mt-16 mb-4">
            <Avatar
              src={profileUser.avatar_url}
              alt={profileUser.display_name || profileUser.username}
              fallbackText={profileUser.display_name || profileUser.username}
              size="2xl"
              className="border-4 border-white shadow-lg"
            />
          </div>

          {/* User Info & Edit Button */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {isEditing ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Display Name
                    </label>
                    <input
                      type="text"
                      value={editForm.display_name}
                      onChange={(e) => setEditForm(prev => ({
                        ...prev,
                        display_name: e.target.value,
                      }))}
                      className="input"
                      placeholder="Your display name"
                      maxLength={100}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Bio
                    </label>
                    <textarea
                      value={editForm.bio}
                      onChange={(e) => setEditForm(prev => ({
                        ...prev,
                        bio: e.target.value,
                      }))}
                      className="textarea"
                      placeholder="Tell us about yourself"
                      rows={3}
                      maxLength={500}
                    />
                    <p className="text-xs text-gray-400 mt-1 text-right">
                      {editForm.bio.length}/500
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <h1 className="text-2xl font-bold text-gray-900 truncate">
                    {profileUser.display_name || profileUser.username}
                  </h1>
                  <p className="text-gray-500">@{profileUser.username}</p>

                  {profileUser.bio && (
                    <p className="mt-3 text-gray-700 whitespace-pre-wrap">
                      {profileUser.bio}
                    </p>
                  )}

                  {/* Metadata */}
                  <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-gray-500">
                    {profileUser.email && isOwnProfile && (
                      <div className="flex items-center gap-1">
                        <Mail size={16} />
                        <span>{profileUser.email}</span>
                      </div>
                    )}
                    {profileUser.created_at && (
                      <div className="flex items-center gap-1">
                        <Calendar size={16} />
                        <span>Joined {formatJoinDate(profileUser.created_at)}</span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Edit/Save Buttons */}
            {isOwnProfile && (
              <div className="flex gap-2">
                {isEditing ? (
                  <>
                    <button
                      onClick={handleEditToggle}
                      className="btn btn-outline btn-sm"
                      disabled={isSaving}
                    >
                      <X size={16} />
                      <span className="hidden sm:inline ml-1">Cancel</span>
                    </button>
                    <button
                      onClick={handleSaveProfile}
                      className="btn btn-primary btn-sm"
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Save size={16} />
                      )}
                      <span className="hidden sm:inline ml-1">Save</span>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleEditToggle}
                    className="btn btn-outline btn-sm"
                  >
                    <Edit3 size={16} />
                    <span className="hidden sm:inline ml-1">Edit Profile</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="flex gap-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">{stats.posts}</p>
                <p className="text-sm text-gray-500">Posts</p>
              </div>
              {/* Could add followers/following stats here */}
            </div>
          </div>
        </div>
      </div>

      {/* User's Posts */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {isOwnProfile ? 'Your Posts' : `${profileUser.display_name || profileUser.username}'s Posts`}
        </h2>
        <Feed userId={targetUserId} />
      </div>
    </div>
  );
}

export default ProfilePage;
