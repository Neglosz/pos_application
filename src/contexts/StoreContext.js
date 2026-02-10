import { createContext, useContext, useState, useEffect, useRef } from "react";
import { setCurrentStoreId as setApiStoreId } from "../services/api";
import { useProductStore } from "../stores/useProductStore";

const StoreContext = createContext();

export function StoreProvider({ children, profile }) {
    const [currentStore, setCurrentStore] = useState(null);
    const [stores, setStores] = useState([]);
    const [userProfile, setUserProfile] = useState(profile);
    const prevStoreId = useRef(null);

    useEffect(() => {
        setUserProfile(profile);
    }, [profile]);

    // Sync store ID to API service whenever currentStore changes
    // Also clear product cache when switching stores
    useEffect(() => {
        if (currentStore?.id) {
            setApiStoreId(currentStore.id);

            // Clear product cache when store actually changes (not on initial load)
            if (prevStoreId.current && prevStoreId.current !== currentStore.id) {
                console.log('Store changed, clearing product cache...');
                useProductStore.getState().clearProducts();
            }
            prevStoreId.current = currentStore.id;
        }
    }, [currentStore]);

    const value = {
        currentStore,
        setCurrentStore,
        stores,
        setStores,
        userProfile,
        setUserProfile,
        isOwner: userProfile?.role === 'owner',
        isManager: userProfile?.role === 'manager',
    };

    return (
        <StoreContext.Provider value={value}>
            {children}
        </StoreContext.Provider>
    );
}

export const useStore = () => {
    const context = useContext(StoreContext);
    if (!context) {
        throw new Error('useStore must be used within StoreProvider');
    }
    return context;
};
