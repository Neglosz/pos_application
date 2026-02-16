import { create } from 'zustand';
import { getNotifications, getUnreadNotificationCount } from '../services/api';

export const useNotificationStore = create((set, get) => ({
    notifications: [],
    unreadCount: 0,
    isLoading: false,

    fetchNotifications: async () => {
        set({ isLoading: true });
        try {
            const response = await getNotifications();
            if (response.success) {
                set({ notifications: response.data || [] });
            }
        } catch (error) {
            console.error('Error fetching notifications:', error);
        } finally {
            set({ isLoading: false });
        }
    },

    fetchUnreadCount: async () => {
        try {
            const response = await getUnreadNotificationCount();
            if (response.success) {
                set({ unreadCount: response.count });
            }
        } catch (error) {
            console.log('Error fetching unread count:', error);
        }
    },

    setNotifications: (notifications) => set({ notifications }),
    
    setUnreadCount: (count) => set({ unreadCount: count }),

    incrementUnreadCount: () => set((state) => ({ unreadCount: state.unreadCount + 1 })),

    reset: () => {
        set({
            notifications: [],
            unreadCount: 0,
            isLoading: false,
        });
    },
}));
