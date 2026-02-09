import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const useOfflineStore = create(
    persist(
        (set, get) => ({
            pendingSales: [],
            isOnline: true, // Default to true, updated by NetInfo
            lastSyncTime: null,

            // Add sale to pending queue
            addPendingSale: (sale) => {
                set((state) => ({
                    pendingSales: [...state.pendingSales, sale],
                }));
            },

            // Remove sale from queue (after sync)
            removePendingSale: (tempId) => {
                set((state) => ({
                    pendingSales: state.pendingSales.filter((s) => s.tempId !== tempId),
                }));
            },

            // Clear all pending sales (manual override)
            clearQueue: () => {
                set({ pendingSales: [] });
            },

            // Set network status
            setOnlineStatus: (status) => {
                set({ isOnline: status });
            },

            // Update last sync time
            setLastSyncTime: (time) => {
                set({ lastSyncTime: time });
            },
        }),
        {
            name: 'offline-store',
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state) => ({
                pendingSales: state.pendingSales,
                lastSyncTime: state.lastSyncTime
            }), // Persist only these fields
        }
    )
);
