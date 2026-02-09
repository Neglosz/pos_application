import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { asyncStorageAdapter } from './mmkvStorage';

export const useCustomerStore = create(
    persist(
        (set, get) => ({
            customers: [],

            // Add or Update customers to local cache
            addCustomers: (newCustomers) => {
                set((state) => {
                    const customerMap = new Map(state.customers.map(c => [c.id, c]));
                    newCustomers.forEach(c => customerMap.set(c.id, c));
                    return { customers: Array.from(customerMap.values()) };
                });
            },

            // Local Search
            searchLocal: (query) => {
                const { customers } = get();
                if (!query) return customers.slice(0, 20);

                const q = query.toLowerCase();
                return customers.filter(c =>
                    c.name?.toLowerCase().includes(q) ||
                    c.phone?.includes(q)
                ).slice(0, 20); // Limit results
            },

            clearCustomers: () => set({ customers: [] }),
        }),
        {
            name: 'customer-store',
            storage: createJSONStorage(() => asyncStorageAdapter),
            partialize: (state) => ({
                customers: state.customers, // Persist customers
            }),
        }
    )
);
