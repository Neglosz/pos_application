import { useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';
import { useProductStore } from '../stores/useProductStore';
import { getCurrentStoreId } from '../services/api';

/**
 * Hook to subscribe to Supabase Realtime changes for products and batches.
 * When changes occur, automatically refresh the product store.
 */
export const useRealtimeSync = () => {
    const channelRef = useRef(null);
    const { refreshProducts, fetchWeightProducts } = useProductStore();

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
                // Refresh products on any change
                refreshProducts();
                fetchWeightProducts();
            })
            // Subscribe to product_batches table changes (for stock updates)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'product_batches'
            }, async (payload) => {
                console.log('[RealtimeSync] Batch change detected:', payload.eventType);
                // Check if this batch belongs to a product in our store
                // For simplicity, just refresh all products
                refreshProducts();
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
    }, [refreshProducts, fetchWeightProducts]);

    return null;
};

export default useRealtimeSync;
