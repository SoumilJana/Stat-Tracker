import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

export default function NotificationsSetup() {
  const { profile } = useAuth();
  const toast = useToast();
  const [permission, setPermission] = useState<NotificationPermission>(() =>
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const [isSubscribing, setIsSubscribing] = useState(false);

  useEffect(() => {
    if (typeof Notification !== 'undefined') {
      setPermission(Notification.permission);
    }
  }, []);

  const subscribeToPush = async () => {
    if (typeof Notification === 'undefined') {
      toast.warning('Notifications are not supported by your browser.');
      return;
    }

    if (permission === 'granted') {
      toast.info('Notifications are already enabled!');
      return;
    }

    try {
      setIsSubscribing(true);
      
      const perm = await Notification.requestPermission();
      setPermission(perm);
      
      if (perm !== 'granted') {
        toast.warning('Notification permission denied. Please allow notifications in browser site settings.');
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      
      // Get VAPID public key from env
      const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        throw new Error("VAPID public key not found in env");
      }

      const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey
      });

      // Parse keys
      const subJson = subscription.toJSON();
      
      if (!profile?.id || !subJson.endpoint || !subJson.keys) {
        throw new Error("Invalid subscription generated");
      }

      // Save to Supabase
      const { error } = await supabase.from('push_subscriptions').upsert({
        user_id: profile.id,
        endpoint: subJson.endpoint,
        p256dh: subJson.keys.p256dh,
        auth: subJson.keys.auth
      }, { onConflict: 'endpoint' });

      if (error) throw error;

      toast.success('Successfully subscribed to match notifications!');
    } catch (err: any) {
      console.error("Failed to subscribe:", err);
      toast.error('Failed to subscribe: ' + err.message);
    } finally {
      setIsSubscribing(false);
    }
  };

  return (
    <button 
      onClick={subscribeToPush}
      disabled={isSubscribing}
      className="relative p-3 bg-white/[0.03] border border-white/[0.05] rounded-full hover:bg-white/[0.08] transition-all flex items-center justify-center shrink-0"
      aria-label="Enable notifications"
    >
      <Bell className="w-5 h-5 text-neutral-300" strokeWidth={2} />
      {permission !== 'granted' && (
        <span className="absolute top-0 right-0 w-3 h-3 bg-emerald-400 rounded-full border-2 border-neutral-950"></span>
      )}
    </button>
  );
}

// Utility function to convert VAPID key
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
