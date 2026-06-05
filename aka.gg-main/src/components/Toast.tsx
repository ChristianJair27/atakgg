import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  duration?: number;
  onClose: () => void;
}

export const Toast = ({ message, type = 'info', duration = 3000, onClose }: ToastProps) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300); // Wait for animation to complete
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const typeClasses = {
    success: 'border-success bg-success/10 text-success-foreground',
    error: 'border-destructive bg-destructive/10 text-destructive-foreground',
    info: 'border-accent bg-accent/10 text-accent-foreground'
  };

  return (
    <div
      className={cn(
        "fixed top-4 right-4 z-50 rounded-lg border p-4 shadow-gaming backdrop-blur-sm transition-all duration-300",
        typeClasses[type],
        isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
      )}
    >
      <p className="text-sm font-medium">{message}</p>
    </div>
  );
};