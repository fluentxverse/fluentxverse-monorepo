/**
 * Skeleton Loaders
 * Animated placeholder components for loading states
 */

import { h, ComponentChildren } from 'preact';
import './Skeleton.css';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  className?: string;
  animate?: boolean;
}

// Base skeleton element
export function Skeleton({
  width = '100%',
  height = '1em',
  borderRadius = '4px',
  className = '',
  animate = true,
}: SkeletonProps) {
  const style = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
    borderRadius: typeof borderRadius === 'number' ? `${borderRadius}px` : borderRadius,
  };

  return (
    <div
      className={`skeleton ${animate ? 'skeleton-animate' : ''} ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
}

// Text line skeleton
interface SkeletonTextProps {
  lines?: number;
  lastLineWidth?: string;
  lineHeight?: string | number;
  gap?: string | number;
  className?: string;
}

export function SkeletonText({
  lines = 3,
  lastLineWidth = '60%',
  lineHeight = '1em',
  gap = 8,
  className = '',
}: SkeletonTextProps) {
  return (
    <div className={`skeleton-text ${className}`} style={{ gap: typeof gap === 'number' ? `${gap}px` : gap }}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          height={lineHeight}
          width={index === lines - 1 ? lastLineWidth : '100%'}
        />
      ))}
    </div>
  );
}

// Avatar/Circle skeleton
interface SkeletonAvatarProps {
  size?: number | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function SkeletonAvatar({ size = 'md', className = '' }: SkeletonAvatarProps) {
  const sizeMap = {
    sm: 32,
    md: 40,
    lg: 56,
    xl: 80,
  };
  const pixelSize = typeof size === 'number' ? size : sizeMap[size];

  return (
    <Skeleton
      width={pixelSize}
      height={pixelSize}
      borderRadius="50%"
      className={`skeleton-avatar ${className}`}
    />
  );
}

// Image/Thumbnail skeleton
interface SkeletonImageProps {
  width?: string | number;
  height?: string | number;
  aspectRatio?: string;
  className?: string;
}

export function SkeletonImage({
  width = '100%',
  height,
  aspectRatio = '16/9',
  className = '',
}: SkeletonImageProps) {
  return (
    <Skeleton
      width={width}
      height={height || 'auto'}
      borderRadius={8}
      className={`skeleton-image ${className}`}
    />
  );
}

// Card skeleton
interface SkeletonCardProps {
  showImage?: boolean;
  showAvatar?: boolean;
  titleLines?: number;
  descriptionLines?: number;
  className?: string;
}

export function SkeletonCard({
  showImage = true,
  showAvatar = false,
  titleLines = 1,
  descriptionLines = 2,
  className = '',
}: SkeletonCardProps) {
  return (
    <div className={`skeleton-card ${className}`}>
      {showImage && (
        <div className="skeleton-card-image">
          <Skeleton height={160} borderRadius="8px 8px 0 0" />
        </div>
      )}
      <div className="skeleton-card-content">
        {showAvatar && (
          <div className="skeleton-card-header">
            <SkeletonAvatar size="md" />
            <div className="skeleton-card-meta">
              <Skeleton width="60%" height={14} />
              <Skeleton width="40%" height={12} />
            </div>
          </div>
        )}
        <SkeletonText lines={titleLines} lineHeight={20} gap={6} />
        <div style={{ marginTop: '8px' }}>
          <SkeletonText lines={descriptionLines} lineHeight={14} gap={4} />
        </div>
      </div>
    </div>
  );
}

// Table row skeleton
interface SkeletonTableRowProps {
  columns?: number;
  className?: string;
}

export function SkeletonTableRow({ columns = 4, className = '' }: SkeletonTableRowProps) {
  return (
    <div className={`skeleton-table-row ${className}`}>
      {Array.from({ length: columns }).map((_, index) => (
        <div key={index} className="skeleton-table-cell">
          <Skeleton width={`${60 + Math.random() * 30}%`} height={16} />
        </div>
      ))}
    </div>
  );
}

// Table skeleton
interface SkeletonTableProps {
  rows?: number;
  columns?: number;
  showHeader?: boolean;
  className?: string;
}

export function SkeletonTable({
  rows = 5,
  columns = 4,
  showHeader = true,
  className = '',
}: SkeletonTableProps) {
  return (
    <div className={`skeleton-table ${className}`}>
      {showHeader && (
        <div className="skeleton-table-header">
          {Array.from({ length: columns }).map((_, index) => (
            <div key={index} className="skeleton-table-cell">
              <Skeleton width={`${50 + Math.random() * 30}%`} height={14} />
            </div>
          ))}
        </div>
      )}
      <div className="skeleton-table-body">
        {Array.from({ length: rows }).map((_, index) => (
          <SkeletonTableRow key={index} columns={columns} />
        ))}
      </div>
    </div>
  );
}

// List item skeleton
interface SkeletonListItemProps {
  showAvatar?: boolean;
  showAction?: boolean;
  titleWidth?: string;
  subtitleWidth?: string;
  className?: string;
}

export function SkeletonListItem({
  showAvatar = true,
  showAction = false,
  titleWidth = '70%',
  subtitleWidth = '50%',
  className = '',
}: SkeletonListItemProps) {
  return (
    <div className={`skeleton-list-item ${className}`}>
      {showAvatar && <SkeletonAvatar size="md" />}
      <div className="skeleton-list-item-content">
        <Skeleton width={titleWidth} height={16} />
        <Skeleton width={subtitleWidth} height={14} />
      </div>
      {showAction && <Skeleton width={60} height={32} borderRadius={6} />}
    </div>
  );
}

// List skeleton
interface SkeletonListProps {
  items?: number;
  showAvatar?: boolean;
  showAction?: boolean;
  className?: string;
}

export function SkeletonList({
  items = 5,
  showAvatar = true,
  showAction = false,
  className = '',
}: SkeletonListProps) {
  return (
    <div className={`skeleton-list ${className}`}>
      {Array.from({ length: items }).map((_, index) => (
        <SkeletonListItem
          key={index}
          showAvatar={showAvatar}
          showAction={showAction}
          titleWidth={`${60 + Math.random() * 25}%`}
          subtitleWidth={`${40 + Math.random() * 20}%`}
        />
      ))}
    </div>
  );
}

// Schedule/Calendar skeleton
export function SkeletonSchedule({ days = 7, slots = 4, className = '' }: { days?: number; slots?: number; className?: string }) {
  return (
    <div className={`skeleton-schedule ${className}`}>
      <div className="skeleton-schedule-header">
        {Array.from({ length: days }).map((_, index) => (
          <div key={index} className="skeleton-schedule-day-header">
            <Skeleton width={40} height={14} />
            <Skeleton width={24} height={24} borderRadius="50%" />
          </div>
        ))}
      </div>
      <div className="skeleton-schedule-body">
        {Array.from({ length: slots }).map((_, slotIndex) => (
          <div key={slotIndex} className="skeleton-schedule-row">
            <div className="skeleton-schedule-time">
              <Skeleton width={50} height={14} />
            </div>
            {Array.from({ length: days }).map((_, dayIndex) => (
              <div key={dayIndex} className="skeleton-schedule-slot">
                <Skeleton width="100%" height={36} borderRadius={6} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// Profile skeleton
export function SkeletonProfile({ className = '' }: { className?: string }) {
  return (
    <div className={`skeleton-profile ${className}`}>
      <div className="skeleton-profile-header">
        <SkeletonAvatar size="xl" />
        <div className="skeleton-profile-info">
          <Skeleton width={180} height={24} />
          <Skeleton width={120} height={16} />
          <Skeleton width={140} height={14} />
        </div>
      </div>
      <div className="skeleton-profile-stats">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="skeleton-profile-stat">
            <Skeleton width={40} height={28} />
            <Skeleton width={60} height={12} />
          </div>
        ))}
      </div>
      <div className="skeleton-profile-bio">
        <SkeletonText lines={3} />
      </div>
    </div>
  );
}

// Lesson card skeleton (specific to FluentXVerse)
export function SkeletonLessonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`skeleton-lesson-card ${className}`}>
      <Skeleton height={140} borderRadius="12px 12px 0 0" />
      <div className="skeleton-lesson-card-content">
        <div className="skeleton-lesson-card-badges">
          <Skeleton width={50} height={22} borderRadius={11} />
          <Skeleton width={70} height={22} borderRadius={11} />
        </div>
        <Skeleton width="90%" height={18} />
        <Skeleton width="70%" height={14} />
        <div className="skeleton-lesson-card-footer">
          <Skeleton width={80} height={14} />
          <Skeleton width={60} height={28} borderRadius={6} />
        </div>
      </div>
    </div>
  );
}

// Tutor card skeleton
export function SkeletonTutorCard({ className = '' }: { className?: string }) {
  return (
    <div className={`skeleton-tutor-card ${className}`}>
      <div className="skeleton-tutor-card-header">
        <SkeletonAvatar size="lg" />
        <Skeleton width={60} height={24} borderRadius={12} className="skeleton-tutor-badge" />
      </div>
      <Skeleton width="80%" height={18} />
      <Skeleton width="60%" height={14} />
      <div className="skeleton-tutor-card-rating">
        <Skeleton width={80} height={16} />
      </div>
      <SkeletonText lines={2} lineHeight={12} />
      <div className="skeleton-tutor-card-footer">
        <Skeleton width={70} height={20} />
        <Skeleton width={80} height={36} borderRadius={8} />
      </div>
    </div>
  );
}

// Wrapper for conditional skeleton display
interface SkeletonWrapperProps {
  loading: boolean;
  skeleton: ComponentChildren;
  children: ComponentChildren;
}

export function SkeletonWrapper({ loading, skeleton, children }: SkeletonWrapperProps) {
  return loading ? <>{skeleton}</> : <>{children}</>;
}

export default Skeleton;
