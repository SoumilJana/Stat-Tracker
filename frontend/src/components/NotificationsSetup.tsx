import { useState, useEffect } from 'react';
import { Bell, BellRing } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function NotificationsSetup() {
  const { profile } = useAuth();
  const [permission, setPermission] = useState(Notification.permission);
  const [isSubscribing, setIsSubscribing] = useState(false);

  useEffect(() => {
    setPermission(Notification.permission);
  }, []);

  const subscribeToPush = async () => {
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

  if (permission === 'granted') {
    return (
      <div className="bg-primary-500/10 border border-primary-500/20 text-primary-400 p-4 rounded-2xl flex items-center gap-3">
        <BellRing className="w-5 h-5" />
        <span className="text-sm font-bold tracking-wide">Notifications Enabled</span>
      </div>
    );
  }

  return (
    <div className="bg-white/[0.02] border border-white/[0.05] p-4 rounded-2xl flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <Bell className="w-5 h-5 text-neutral-400" />
        <div>
          <h4 className="text-sm font-bold text-white">Enable Notifications</h4>
          <p className="text-[10px] text-neutral-500 uppercase tracking-widest mt-1">Get match alerts & stats</p>
        </div>
      </div>
      <button 
        onClick={subscribeToPush}
        disabled={isSubscribing}
        className="px-4 py-2 bg-primary-500 text-black text-xs font-black uppercase tracking-widest rounded-full hover:scale-105 transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] disabled:opacity-50"
      >
        {isSubscribing ? 'Setting up...' : 'Enable'}
      </button>
    </div>
  );
}

// Utility function to convert VAPID key
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
