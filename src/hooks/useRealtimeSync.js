import { useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';
import { getCurrentStoreId } from '../services/api';
import { useProductStore } from '../stores/useProductStore';
import { useNotificationStore } from '../stores/useNotificationStore';

/**
 * Hook to subscribe to Supabase Realtime changes for products and batches.
 * Debounced handlers prevent duplicate API calls when multiple rows update at once
 * (e.g., scheduler updating 30 notifications simultaneously).
 */
export const useRealtimeSync = () => {
    const channelRef = useRef(null);
    // Debounce timers - batch rapid-fire events into a single fetch
    const notifTimerRef = useRef(null);
    const productTimerRef = useRef(null);

    const debouncedRefreshProducts = () => {
        if (productTimerRef.current) clearTimeout(productTimerRef.current);
        productTimerRef.current = setTimeout(() => {
            useProductStore.getState().refreshProducts();
            useProductStore.getState().fetchWeightProducts();
        }, 1000); // Wait 1s to batch all rapid updates together
    };

    const debouncedRefreshNotifications = () => {
        if (notifTimerRef.current) clearTimeout(notifTimerRef.current);
        notifTimerRef.current = setTimeout(() => {
            useNotificationStore.getState().fetchNotifications();
            useNotificationStore.getState().fetchUnreadCount();
        }, 1500); // Wait 1.5s — notifications update in bulk (scheduler), so wait longer
    };

    useEffect(() => {
        const storeId = getCurrentStoreId();

        if (!storeId) {
            console.log('[RealtimeSync] No store ID, skipping subscription');
            return;
        }

        console.log('[RealtimeSync] Setting up subscription for store:', storeId);

        const channel = supabase
            .channel(`store-products-${storeId}`)
            // Products table changes
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'products',
                filter: `store_id=eq.${storeId}`
            }, (payload) => {
                console.log('[RealtimeSync] Product change detected:', payload.eventType);
                debouncedRefreshProducts();
            })
            // Batches table changes (stock updates)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'product_batches'
            }, (payload) => {
                console.log('[RealtimeSync] Batch change detected:', payload.eventType);
                debouncedRefreshProducts();
            })
            // Promotions table changes
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'promotions',
                filter: `store_id=eq.${storeId}`
            }, (payload) => {
                console.log('[RealtimeSync] Promotion change detected:', payload.eventType);
                debouncedRefreshProducts();
            })
            // Notifications table changes — debounced heavily because scheduler updates many rows at once
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'notifications',
                filter: `store_id=eq.${storeId}`
            }, (payload) => {
                console.log('[RealtimeSync] Notification change:', payload.eventType);
                debouncedRefreshNotifications();
            })
            .subscribe((status) => {
                console.log('[RealtimeSync] Subscription status:', status);
            });

        channelRef.current = channel;

        return () => {
            console.log('[RealtimeSync] Cleaning up subscription');
            // Clear any pending debounce timers
            if (notifTimerRef.current) clearTimeout(notifTimerRef.current);
            if (productTimerRef.current) clearTimeout(productTimerRef.current);
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }
        };
    }, []);

    return null;
};

export default useRealtimeSync;
