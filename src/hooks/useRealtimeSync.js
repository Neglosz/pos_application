import { useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';
import { getCurrentStoreId } from '../services/api';
import { useProductStore } from '../stores/useProductStore';

/**
 * Hook to subscribe to Supabase Realtime changes for products and batches.
 * When changes occur, automatically refresh the product store.
 */
export const useRealtimeSync = () => {
    const channelRef = useRef(null);

    useEffect(() => {
        const storeId = getCurrentStoreId();

        if (!storeId) {
            console.log('[RealtimeSync] No store ID, skipping subscription');
            return;
        }

        console.log('[RealtimeSync] Setting up subscription for store:', storeId);

        // Create a channel for this store's products
        const channel = supabase
            .channel(`store-products-${storeId}`)
            // Subscribe to products table changes
            .on('postgres_changes', {
                event: '*', // INSERT, UPDATE, DELETE
                schema: 'public',
                table: 'products',
                filter: `store_id=eq.${storeId}`
            }, (payload) => {
                console.log('[RealtimeSync] Product change detected:', payload.eventType);
                useProductStore.getState().refreshProducts();
                useProductStore.getState().fetchWeightProducts();
            })
            // Subscribe to product_batches table changes (for stock updates)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'product_batches'
            }, (payload) => {
                console.log('[RealtimeSync] Batch change detected:', payload.eventType);
                useProductStore.getState().refreshProducts();
            })
            .subscribe((status) => {
                console.log('[RealtimeSync] Subscription status:', status);
            });

        channelRef.current = channel;

        // Cleanup on unmount or store change
        return () => {
            console.log('[RealtimeSync] Cleaning up subscription');
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }
        };
    }, []);

    return null;
};

export default useRealtimeSync;
