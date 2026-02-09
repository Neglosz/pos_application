import NetInfo from '@react-native-community/netinfo';
import { useOfflineStore } from '../stores/useOfflineStore';

export const initNetworkMonitoring = () => {
    const unsubscribe = NetInfo.addEventListener(state => {
        const isConnected = state.isConnected && state.isInternetReachable !== false;
        console.log("Network Status Changed:", isConnected ? "ONLINE" : "OFFLINE");
        useOfflineStore.getState().setOnlineStatus(isConnected);
    });

    return unsubscribe;
};
