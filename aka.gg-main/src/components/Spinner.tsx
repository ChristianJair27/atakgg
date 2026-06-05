import { cn } from '@/lib/utils';

interface SpinnerProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const Spinner = ({ className, size = 'md' }: SpinnerProps) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8'
  };

  return (
    <div
      className={cn(
        "animate-spin rounded-full border-2 border-accent/20 border-t-accent",
        sizeClasses[size],
        className
      )}
    />
  );
};