import { useState, useCallback } from 'react';

// Simple toast notification system
let toastQueue = [];
let listeners = [];

const addToast = (toast) => {
  const id = Math.random().toString(36).substr(2, 9);
  const newToast = { ...toast, id };
  toastQueue.push(newToast);
  
  // Notify all listeners
  listeners.forEach(listener => listener([...toastQueue]));
  
  // Auto-remove toast after 5 seconds
  setTimeout(() => {
    removeToast(id);
  }, 5000);
  
  return id;
};

const removeToast = (id) => {
  toastQueue = toastQueue.filter(toast => toast.id !== id);
  listeners.forEach(listener => listener([...toastQueue]));
};

export const useToast = () => {
  const [toasts, setToasts] = useState(toastQueue);

  const addListener = useCallback((listener) => {
    listeners.push(listener);
    return () => {
      listeners = listeners.filter(l => l !== listener);
    };
  }, []);

  // Subscribe to toast updates
  React.useEffect(() => {
    return addListener(setToasts);
  }, [addListener]);

  const toast = useCallback((options) => {
    return addToast(options);
  }, []);

  const dismiss = useCallback((id) => {
    removeToast(id);
  }, []);

  return {
    toast,
    dismiss,
    toasts,
  };
};
