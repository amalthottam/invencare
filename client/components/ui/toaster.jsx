import React from 'react';
import { useToast } from './use-toast';
import { Button } from './button';
import { X, CheckCircle, AlertCircle, XCircle, Info } from 'lucide-react';

const Toast = ({ toast, onDismiss }) => {
  const { title, description, variant = 'default' } = toast;

  const getIcon = () => {
    switch (variant) {
      case 'destructive':
        return <XCircle className="h-4 w-4" />;
      case 'success':
        return <CheckCircle className="h-4 w-4" />;
      case 'warning':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  const getVariantClasses = () => {
    switch (variant) {
      case 'destructive':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'success':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      default:
        return 'bg-blue-50 border-blue-200 text-blue-800';
    }
  };

  return (
    <div className={`flex items-start gap-3 p-4 border rounded-lg shadow-lg ${getVariantClasses()}`}>
      {getIcon()}
      <div className="flex-1 min-w-0">
        {title && <div className="font-medium text-sm">{title}</div>}
        {description && <div className="text-sm opacity-90 mt-1">{description}</div>}
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0 hover:bg-black/5"
        onClick={() => onDismiss(toast.id)}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
};

export const Toaster = () => {
  const { toasts, dismiss } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 w-full max-w-sm">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onDismiss={dismiss} />
      ))}
    </div>
  );
};
