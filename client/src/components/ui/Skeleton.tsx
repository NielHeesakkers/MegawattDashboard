interface SkeletonProps {
  variant?: 'line' | 'circle' | 'card';
  width?: string;
  height?: string;
  className?: string;
}

export default function Skeleton({ variant = 'line', width, height, className = '' }: SkeletonProps) {
  const base = 'animate-pulse bg-[rgba(255,255,255,0.06)] rounded';

  if (variant === 'circle') {
    return (
      <div
        className={`${base} rounded-full ${className}`}
        style={{ width: width || '40px', height: height || '40px' }}
      />
    );
  }

  if (variant === 'card') {
    return (
      <div
        className={`${base} rounded-[8px] ${className}`}
        style={{ width: width || '100%', height: height || '80px' }}
      />
    );
  }

  // line
  return (
    <div
      className={`${base} rounded-[4px] ${className}`}
      style={{ width: width || '100%', height: height || '14px' }}
    />
  );
}

export function DashboardSkeleton() {
  return (
    <div>
      <Skeleton variant="line" width="200px" height="28px" className="mb-6" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} variant="card" height="72px" />
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <Skeleton variant="card" height="72px" />
        <Skeleton variant="card" height="72px" />
      </div>
      <Skeleton variant="line" width="160px" height="16px" className="mb-3" />
      {[...Array(5)].map((_, i) => (
        <Skeleton key={i} variant="card" height="48px" className="mb-2" />
      ))}
    </div>
  );
}

export function OrganigramSkeleton() {
  return (
    <div className="flex gap-6 p-6">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="w-[260px] flex-shrink-0">
          <Skeleton variant="line" width="120px" height="20px" className="mb-4" />
          {[...Array(3 + i)].map((_, j) => (
            <Skeleton key={j} variant="card" height="64px" className="mb-2" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function KlantteamsSkeleton() {
  return (
    <div className="flex gap-6 p-6">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="w-[280px] flex-shrink-0">
          <Skeleton variant="line" width="140px" height="20px" className="mb-4" />
          <Skeleton variant="card" height="48px" className="mb-2" />
          <Skeleton variant="card" height="48px" className="mb-2" />
          <Skeleton variant="line" width="100px" height="16px" className="mb-2 mt-4" />
          <Skeleton variant="card" height="36px" className="mb-1" />
          <Skeleton variant="card" height="36px" className="mb-1" />
        </div>
      ))}
    </div>
  );
}
