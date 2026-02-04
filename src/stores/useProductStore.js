import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { asyncStorageAdapter } from './mmkvStorage';
import { getCurrentStoreId } from '../services/api';
import { supabase } from '../services/supabase';

import { API_BASE_URL } from '../config';
const PAGE_SIZE = 20;

export const useProductStore = create(
    persist(
        (set, get) => ({
            // State
            products: [],
            categories: [], // Cached categories
            isLoading: false,
            hasMore: true,
            currentPage: 0,
            lastFetch: null,
            searchQuery: '', // Server-side search query
            selectedCategoryId: null, // Server-side category filter
            abortController: null, // For cancelling requests

            // Fetch paginated products from server
            fetchProducts: async (reset = false, keepPreviousData = false) => {
                const state = get();
                // Allow fetching if resetting (search/filter change) even if loading
                if (!reset && (state.isLoading || !state.hasMore)) return;

                // Cancel previous request if resetting
                if (reset && state.abortController) {
                    state.abortController.abort();
                }

                const controller = new AbortController();
                set({ isLoading: true, abortController: controller });

                const page = reset ? 1 : state.currentPage + 1;

                try {
                    const storeId = getCurrentStoreId();
                    const { searchQuery, selectedCategoryId } = get();
                    let url = `${API_BASE_URL}/products?page=${page}&limit=${PAGE_SIZE}`;
                    if (searchQuery) {
                        url += `&search=${encodeURIComponent(searchQuery)}`;
                    }
                    if (selectedCategoryId) {
                        url += `&categoryId=${selectedCategoryId}`;
                    }

                    // Get Auth Token
                    const { data: { session } } = await supabase.auth.getSession();
                    const token = session?.access_token;

                    const response = await fetch(
                        url,
                        {
                            signal: controller.signal,
                            headers: {
                                'Content-Type': 'application/json',
                                ...(storeId && { 'x-store-id': storeId }),
                                ...(token && { 'Authorization': `Bearer ${token}` }),
                            },
                        }
                    );

                    const result = await response.json();

                    if (result.success) {
                        const newProducts = result.data || [];
                        set((state) => {
                            // If this was a reset, strictly replace. If not, append.
                            // However, we must be careful not to append to WRONG results if a race happened
                            // But AbortController handles the network race.
                            const existingProducts = (reset && !keepPreviousData) ? [] : state.products;

                            // Map-based deduplication
                            const productMap = new Map();
                            existingProducts.forEach(p => productMap.set(p.id, p));
                            newProducts.forEach(p => productMap.set(p.id, p));

                            const uniqueProducts = Array.from(productMap.values());

                            return {
                                products: uniqueProducts,
                                currentPage: page,
                                hasMore: newProducts.length === PAGE_SIZE,
                                lastFetch: Date.now(),
                                isLoading: false,
                                abortController: null, // Clear controller on success
                            };
                        });
                    } else {
                        set({ isLoading: false, hasMore: false, abortController: null });
                    }
                } catch (error) {
                    if (error.name === 'AbortError') {
                        // Ignore
                    } else {
                        console.log('Fetch products error:', error);
                        set({ isLoading: false, hasMore: false, abortController: null });
                    }
                }
            },

            // Fetch categories
            fetchCategories: async () => {
                try {
                    const storeId = getCurrentStoreId();
                    const { data: { session } } = await supabase.auth.getSession();
                    const token = session?.access_token;

                    const response = await fetch(`${API_BASE_URL}/product-categories`, {
                        headers: {
                            'Content-Type': 'application/json',
                            ...(storeId && { 'x-store-id': storeId }),
                            ...(token && { 'Authorization': `Bearer ${token}` }),
                        },
                    });
                    const result = await response.json();
                    if (result.success) {
                        set({ categories: result.data || [] });
                    }
                } catch (error) {
                    console.log('Fetch categories error:', error);
                }
            },

            // Search products from local cache
            searchLocal: (query, categoryId) => {
                const { products } = get();
                let result = products;

                if (categoryId) {
                    result = result.filter(p => p.category_id === categoryId);
                }

                if (query && query.trim() !== '') {
                    const q = query.toLowerCase().trim();
                    result = result.filter(
                        (p) =>
                            p.name?.toLowerCase().includes(q) ||
                            p.barcode?.toLowerCase().includes(q)
                    );
                }
                return result;
            },

            // Refresh products (force reload)
            refreshProducts: () => {
                set({ currentPage: 0, hasMore: true });
                get().fetchProducts(true, true); // reset=true, keepPreviousData=true
                get().fetchCategories();
            },

            // Set search query and trigger fetch
            setSearchQuery: (query) => {
                set({ searchQuery: query, selectedCategoryId: null, currentPage: 0, hasMore: true, products: [] });
                get().fetchProducts(true);
            },

            // Set category filter and trigger fetch
            setSelectedCategory: (categoryId) => {
                set({ selectedCategoryId: categoryId, searchQuery: '', currentPage: 0, hasMore: true, products: [] });
                get().fetchProducts(true);
            },

            // Get product by barcode (for scanner)
            getProductByBarcode: async (barcode) => {
                try {
                    const storeId = getCurrentStoreId();
                    const { data: { session } } = await supabase.auth.getSession();
                    const token = session?.access_token;
                    
                    const url = `${API_BASE_URL}/products/barcode/${barcode}`;
                    const response = await fetch(url, {
                        headers: {
                            'Content-Type': 'application/json',
                            ...(storeId && { 'x-store-id': storeId }),
                            ...(token && { 'Authorization': `Bearer ${token}` }),
                        },
                    });
                    const res = await response.json();

                    if (res.success && res.exists && res.data) {
                        return res.data;
                    }
                    return null;
                } catch (error) {
                    console.error('Scan error:', error);
                    return null;
                }
            },

            // Clear all cached products
            clearProducts: () => {
                set({
                    products: [],
                    categories: [],
                    currentPage: 0,
                    hasMore: true,
                    lastFetch: null,
                });
            },
        }),
        {
            name: 'product-store',
            storage: createJSONStorage(() => asyncStorageAdapter),
            partialize: (state) => ({
                products: state.products,
                categories: state.categories,
                lastFetch: state.lastFetch,
            }),
        }
    )
);
