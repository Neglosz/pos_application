import AsyncStorage from '@react-native-async-storage/async-storage';

// Zustand persist storage adapter for AsyncStorage
export const asyncStorageAdapter = {
    getItem: async (name) => {
        try {
            const value = await AsyncStorage.getItem(name);
            return value ?? null;
        } catch (error) {
            console.log('AsyncStorage getItem error:', error);
            return null;
        }
    },
    setItem: async (name, value) => {
        try {
            await AsyncStorage.setItem(name, value);
        } catch (error) {
            console.log('AsyncStorage setItem error:', error);
        }
    },
    removeItem: async (name) => {
        try {
            await AsyncStorage.removeItem(name);
        } catch (error) {
            console.log('AsyncStorage removeItem error:', error);
        }
    },
};
