import { createContext, useContext, useState } from "react"; 

const StoreContext = createContext();

export function StoreProvider({ children }) {
    const [currentStore, setCurrentStore] = useState(null);
    const [stores, setStores] = useState([]);
    const [userProfile, setUserProfile] = useState(null);

    const value = {
        currentStore,
        setCurrentStore,
        stores,
        setStores,
        userProfile,
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
    if(!context){
        throw new Error('useStore must be used within StoreProvider');
    }
    return context;
};
