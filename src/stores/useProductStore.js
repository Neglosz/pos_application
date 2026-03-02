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
            weightProducts: [],
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
                    let url = `${API_BASE_URL}/products?page=${page}&limit=${PAGE_SIZE}&type=normal`;
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

            // Fetch weight products
            fetchWeightProducts: async () => {
                const storeId = getCurrentStoreId();
                const { data: { session } } = await supabase.auth.getSession();
                const token = session?.access_token;

                try {
                    const response = await fetch(`${API_BASE_URL}/products?type=weight&limit=100`, {
                        headers: {
                            'Content-Type': 'application/json',
                            ...(storeId && { 'x-store-id': storeId }),
                            ...(token && { 'Authorization': `Bearer ${token}` }),
                        }
                    });
                    const result = await response.json();
                    if (result.success) {
                        set({ weightProducts: result.data || [] });
                    }
                } catch (error) {
                    console.error("Fetch weight products error:", error);
                }
            },

            // Add new product
            addProduct: async (productData) => {
                const storeId = getCurrentStoreId();
                const { data: { session } } = await supabase.auth.getSession();
                const token = session?.access_token;

                try {
                    // Format expireDate if it's a Date object
                    let formattedData = { ...productData };
                    if (productData.expireDate && productData.expireDate instanceof Date) {
                        const day = productData.expireDate.getDate().toString().padStart(2, '0');
                        const month = (productData.expireDate.getMonth() + 1).toString().padStart(2, '0');
                        const year = productData.expireDate.getFullYear();
                        formattedData.expireDate = `${day}/${month}/${year}`;
                    }

                    const response = await fetch(`${API_BASE_URL}/products`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            ...(storeId && { 'x-store-id': storeId }),
                            ...(token && { 'Authorization': `Bearer ${token}` }),
                        },
                        body: JSON.stringify(formattedData)
                    });
                    const result = await response.json();

                    if (result.success) {
                        if (productData.isWeightable) {
                            await get().fetchWeightProducts();
                        } else {
                            // Refresh normal products
                            get().fetchProducts(true);
                        }
                        return { success: true, data: result.data };
                    } else {
                        return { success: false, error: result.error };
                    }
                } catch (error) {
                    return { success: false, error: error.message };
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

            // Create new category
            createCategory: async (name) => {
                const storeId = getCurrentStoreId();
                const { data: { session } } = await supabase.auth.getSession();
                const token = session?.access_token;

                try {
                    const response = await fetch(`${API_BASE_URL}/product-categories`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            ...(storeId && { 'x-store-id': storeId }),
                            ...(token && { 'Authorization': `Bearer ${token}` }),
                        },
                        body: JSON.stringify({ name })
                    });
                    const result = await response.json();

                    if (result.success) {
                        // Refresh categories
                        await get().fetchCategories();
                        return { success: true, data: result.data };
                    } else {
                        return { success: false, error: result.error };
                    }
                } catch (error) {
                    return { success: false, error: error.message };
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
                get().fetchWeightProducts();
            },

            // Set search query and trigger fetch
            setSearchQuery: (query) => {
                set({ searchQuery: query, selectedCategoryId: null, currentPage: 0, hasMore: true });
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
                    const { products, weightProducts } = get();

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
                    console.log('Scan offline/error, searching local:', error.message);
                    // Offline Fallback: Search in memory (products + weightProducts)
                    // Note: This relies on the product being previously loaded/cached.
                    // For < 2GB RAM devices, we avoid loading the ENTIRE DB into memory.
                    const { products, weightProducts } = get();

                    // Helper to normalize barcode
                    const clean = (b) => b?.toLowerCase().trim();
                    const target = clean(barcode);

                    // 1. Search Weight Products
                    let found = weightProducts.find(p => clean(p.barcode) === target);

                    // 2. Search Cached Normal Products
                    if (!found) {
                        found = products.find(p => clean(p.barcode) === target);
                    }

                    if (found) {
                        // Return structured like API response
                        return {
                            ...found,
                            // Ensure promotion is attached if it exists in local data
                            promotion: found.promotion || null
                        };
                    }
                    return null;
                }
            },

            // Clear all cached data
            reset: () => {
                set({
                    products: [],
                    weightProducts: [], // Also clear weight products
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
                products: state.products, // Persist loaded normal products
                weightProducts: state.weightProducts, // Persist ALL weight products (critical for offline)
                categories: state.categories,
                lastFetch: state.lastFetch,
            }),
        }
    )
);
