import { createContext, useContext } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  duration?: number;
  action?: ToastAction;
  id?: string;
}

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration: number;
  action?: ToastAction;
}

export interface ToastMethods {
  success: (message: string, options?: ToastOptions) => string;
  error: (message: string, options?: ToastOptions) => string;
  warning: (message: string, options?: ToastOptions) => string;
  info: (message: string, options?: ToastOptions) => string;
  dismiss: (id: string) => void;
  clearAll: () => void;
}

export interface ToastContextValue {
  toast: ToastMethods;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastMethods {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context.toast;
}

