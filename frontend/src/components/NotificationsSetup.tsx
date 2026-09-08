import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function NotificationsSetup() {
  const { profile } = useAuth();
  const [permission, setPermission] = useState(Notification.permission);
  const [isSubscribing, setIsSubscribing] = useState(false);

  useEffect(() => {
    setPermission(Notification.permission);
    
    // Give a reminder every time someone HASNT enabled the notifs
    if (Notification.permission !== 'granted') {
      const timer = setTimeout(() => {
        alert("Reminder: You haven't enabled notifications yet! Click the bell icon at the top right to get match alerts.");
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const subscribeToPush = async () => {
    if (permission === 'granted') {
      alert('Notifications are already enabled!');
      return;
    }

    try {
      setIsSubscribing(true);
      
      const perm = await Notification.requestPermission();
      setPermission(perm);
      
      if (perm !== 'granted') {
        alert('Notification permission denied.');
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

      alert('Successfully subscribed to notifications!');
    } catch (err: any) {
      console.error("Failed to subscribe:", err);
      alert('Failed to subscribe: ' + err.message);
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
        <span className="absolute top-0 right-0 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#0a0a0a]"></span>
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
