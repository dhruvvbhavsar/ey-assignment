import { User } from 'lucide-react';

const sizeClasses = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-base',
  lg: 'w-12 h-12 text-lg',
  xl: 'w-16 h-16 text-xl',
  '2xl': 'w-20 h-20 text-2xl',
};

const iconSizes = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
  '2xl': 40,
};

function Avatar({
  src,
  alt = 'User avatar',
  size = 'md',
  className = '',
  fallbackText,
  onClick,
}) {
  const sizeClass = sizeClasses[size] || sizeClasses.md;
  const iconSize = iconSizes[size] || iconSizes.md;

  // Get initials from fallback text
  const getInitials = (text) => {
    if (!text) return null;
    const words = text.trim().split(' ');
    if (words.length === 1) {
      return words[0].charAt(0).toUpperCase();
    }
    return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
  };

  const initials = getInitials(fallbackText);

  const baseClasses = `
    ${sizeClass}
    rounded-full
    flex-shrink-0
    overflow-hidden
    ${onClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}
    ${className}
  `.trim();

  // If we have a valid image source
  if (src) {
    return (
      <div className={baseClasses} onClick={onClick}>
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-cover"
          onError={(e) => {
            // Hide broken image and show fallback
            e.target.style.display = 'none';
            e.target.nextSibling?.classList.remove('hidden');
          }}
        />
        <div className="hidden w-full h-full bg-gray-200 flex items-center justify-center">
          {initials ? (
            <span className="font-medium text-gray-600">{initials}</span>
          ) : (
            <User size={iconSize} className="text-gray-400" />
          )}
        </div>
      </div>
    );
  }

  // Fallback avatar (no image)
  return (
    <div
      className={`${baseClasses} bg-gray-200 flex items-center justify-center`}
      onClick={onClick}
    >
      {initials ? (
        <span className="font-medium text-gray-600">{initials}</span>
      ) : (
        <User size={iconSize} className="text-gray-400" />
      )}
    </div>
  );
}

export default Avatar;
