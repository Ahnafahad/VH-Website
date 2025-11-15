import React from 'react';
import Image from 'next/image';
import { User } from 'lucide-react';

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string;
  alt?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  fallback?: string;
  status?: 'online' | 'offline' | 'away' | 'busy';
}

const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  (
    {
      src,
      alt = 'Avatar',
      size = 'md',
      fallback,
      status,
      className = '',
      ...props
    },
    ref
  ) => {
    const sizeStyles = {
      xs: 'w-6 h-6 text-xs',
      sm: 'w-8 h-8 text-sm',
      md: 'w-10 h-10 text-base',
      lg: 'w-12 h-12 text-lg',
      xl: 'w-16 h-16 text-xl',
      '2xl': 'w-24 h-24 text-3xl',
    };

    const statusColors = {
      online: 'bg-success-500',
      offline: 'bg-gray-400',
      away: 'bg-warning-500',
      busy: 'bg-error-500',
    };

    const statusSizes = {
      xs: 'w-1.5 h-1.5',
      sm: 'w-2 h-2',
      md: 'w-2.5 h-2.5',
      lg: 'w-3 h-3',
      xl: 'w-3.5 h-3.5',
      '2xl': 'w-4 h-4',
    };

    const getInitials = (name: string) => {
      return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    };

    return (
      <div ref={ref} className={`relative inline-block ${className}`} {...props}>
        <div
          className={`${sizeStyles[size]} rounded-full overflow-hidden bg-gray-200 flex items-center justify-center font-semibold text-gray-600`}
        >
          {src ? (
            <Image src={src} alt={alt} width={96} height={96} className="w-full h-full object-cover" />
          ) : fallback ? (
            <span>{getInitials(fallback)}</span>
          ) : (
            <User size={size === 'xs' || size === 'sm' ? 14 : size === 'md' ? 18 : 24} />
          )}
        </div>
        {status && (
          <span
            className={`absolute bottom-0 right-0 ${statusSizes[size]} ${statusColors[status]} rounded-full border-2 border-white`}
            aria-label={`Status: ${status}`}
          />
        )}
      </div>
    );
  }
);

Avatar.displayName = 'Avatar';

export default Avatar;

// Avatar Group component
export interface AvatarGroupProps {
  max?: number;
  size?: AvatarProps['size'];
  children: React.ReactElement<AvatarProps>[];
}

export const AvatarGroup: React.FC<AvatarGroupProps> = ({
  max = 3,
  size = 'md',
  children,
}) => {
  const visibleAvatars = children.slice(0, max);
  const remainingCount = children.length - max;

  return (
    <div className="flex items-center -space-x-2">
      {visibleAvatars.map((child, index) =>
        React.cloneElement(child, {
          key: index,
          size,
          className: 'ring-2 ring-white',
        })
      )}
      {remainingCount > 0 && (
        <div
          className={`${
            size === 'xs'
              ? 'w-6 h-6 text-xs'
              : size === 'sm'
              ? 'w-8 h-8 text-sm'
              : size === 'md'
              ? 'w-10 h-10 text-base'
              : size === 'lg'
              ? 'w-12 h-12 text-lg'
              : size === 'xl'
              ? 'w-16 h-16 text-xl'
              : 'w-24 h-24 text-3xl'
          } rounded-full bg-gray-300 flex items-center justify-center font-semibold text-gray-700 ring-2 ring-white`}
        >
          +{remainingCount}
        </div>
      )}
    </div>
  );
};
