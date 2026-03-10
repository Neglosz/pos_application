import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Modal, TouchableWithoutFeedback } from 'react-native';
import { Ionicons, FontAwesome5, FontAwesome } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../services/supabase';
import { getUnreadNotificationCount } from '../services/api';
import { useProductStore } from '../stores/useProductStore';
import { useCartStore } from '../stores/useCartStore';
import { useCustomerStore } from '../stores/useCustomerStore';
import { useNotificationStore } from '../stores/useNotificationStore';
import { useStore } from '../contexts/StoreContext';

export default function TopBar({ onLogout, onGoToBranchList }) {
    const navigation = useNavigation();
    const [menuVisible, setMenuVisible] = useState(false);
    const { unreadCount, setUnreadCount, fetchUnreadCount, incrementUnreadCount } = useNotificationStore();
    const { userProfile, currentStore } = useStore();

    // Fetch unread count on mount and subscribe to Realtime
    React.useEffect(() => {
        // Initial fetch
        fetchUnreadCount();

        // Subscribe to realtime notifications
        const channel = supabase
            .channel('topbar-notifications')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications'
            }, (payload) => {
                // Only increment if it belongs to current store
                if (payload.new?.store_id === currentStore?.id) {
                    incrementUnreadCount();
                }
            })
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'notifications'
            }, (payload) => {
                // Only refetch if it belongs to current store
                if (payload.new?.store_id === currentStore?.id || payload.old?.store_id === currentStore?.id) {
                    fetchUnreadCount();
                }
            })
            .on('postgres_changes', {
                event: 'DELETE',
                schema: 'public',
                table: 'notifications'
            }, (payload) => {
                // Only refetch if it belonged to current store
                if (payload.old?.store_id === currentStore?.id) {
                    fetchUnreadCount();
                }
            })
            .subscribe();

        // Also refetch when screen focuses
        const unsubscribe = navigation.addListener('focus', fetchUnreadCount);

        return () => {
            supabase.removeChannel(channel);
            unsubscribe();
        };
    }, [navigation, currentStore?.id]);

    const handleLogout = async () => {
        setMenuVisible(false);

        // Clear all cached data to prevent data leakage between accounts
        console.log('Logging out, resetting all stores...');
        useProductStore.getState().reset();
        useCartStore.getState().reset();
        useCustomerStore.getState().reset();
        useNotificationStore.getState().reset();

        await supabase.auth.signOut();
        if (onLogout) onLogout();
    };

    const menuItems = [
        ...(userProfile?.role === 'owner' ? [{
            icon: <Ionicons name='git-branch' size={22} color="#4AB58E" />,
            label: 'เลือกสาขา',
            onPress: () => {
                setMenuVisible(false);
                if (onGoToBranchList) onGoToBranchList();
            },
        }] : []),
        {
            icon: <FontAwesome name='print' size={22} color="#52616B" />,
            label: 'เชื่อมต่ออุปกรณ์',
            onPress: () => {
                setMenuVisible(false);
                navigation.navigate('DeviceConnect');
            },
        },
        // {
        //     icon: <FontAwesome name='cloud' size={22} color="#165DFC" />,
        //     label: 'สำรองข้อมูล',
        //     onPress: () => {
        //         setMenuVisible(false);
        //         navigation.navigate('Backup');
        //     },
        // },
        {
            icon: <FontAwesome5 name='file-invoice-dollar' size={22} color="#F37021" />,
            label: 'รายการเดินบัญชี',
            onPress: () => {
                setMenuVisible(false);
                navigation.navigate('TransactionHistory');
            },
        },
    ];

    return (
        <View style={styles.container}>
            {/* Profile Image - กดแล้วเปิด Menu */}
            <TouchableOpacity onPress={() => setMenuVisible(true)} style={[styles.menuButton, currentStore?.image_url && { backgroundColor: 'transparent', overflow: 'hidden' }]}>
                {currentStore?.image_url ? (
                    <Image source={{ uri: currentStore.image_url }} style={{ width: '100%', height: '100%' }} resizeMode='cover' />
                ) : (
                    <Ionicons name="storefront" size={20} color="#fff" />
                )}
            </TouchableOpacity>
            <Text style={styles.title}>Zippy Till</Text>
            {/* Bell Icon */}
            <TouchableOpacity
                style={styles.bellContainer}
                onPress={() => {
                    setUnreadCount(0); // Optimistic clear
                    navigation.navigate('Alert');
                }}
            >
                <Ionicons name="notifications" size={24} color="#000" />
                {unreadCount > 0 && (
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>
                            {unreadCount > 99 ? '99+' : unreadCount}
                        </Text>
                    </View>
                )}
            </TouchableOpacity>
            {/* Settings Modal/Popup */}
            <Modal
                visible={menuVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setMenuVisible(false)}
                statusBarTranslucent={true}
            >
                <TouchableWithoutFeedback onPress={() => setMenuVisible(false)}>
                    <View style={styles.modalOverlay}>
                        <TouchableWithoutFeedback>
                            <View style={styles.menuContainer}>
                                {/* Header */}
                                <View style={styles.menuHeader}>
                                    <Text style={styles.menuTitle}>ตั้งค่า(Settings)</Text>
                                    <TouchableOpacity onPress={() => setMenuVisible(false)}>
                                        <Ionicons name="close" size={24} color="#333" />
                                    </TouchableOpacity>
                                </View>
                                {/* Menu Items */}
                                {menuItems.map((item, index) => (
                                    <TouchableOpacity
                                        key={index}
                                        style={styles.menuItem}
                                        onPress={item.onPress}
                                    >
                                        {item.icon}
                                        <Text style={styles.menuItemText}>{item.label}</Text>
                                        <Ionicons name="chevron-forward" size={20} color="#52616B" />
                                    </TouchableOpacity>
                                ))}
                                {/* Logout Button */}
                                <TouchableOpacity style={styles.logoutItem} onPress={handleLogout}>
                                    <FontAwesome name="sign-out" size={22} color="#e74c3c" />
                                    <Text style={styles.logoutText}>ออกจากระบบ</Text>
                                </TouchableOpacity>
                            </View>
                        </TouchableWithoutFeedback>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F9FAFB',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    menuButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F37021', // Orange theme
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#F37021',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 5,
        left: 10,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#000',
    },
    bellContainer: {
        padding: 8,
        position: 'relative',
    },
    badge: {
        position: 'absolute',
        right: 4,
        top: 4,
        backgroundColor: '#FF3B30',
        borderRadius: 10,
        minWidth: 18,
        height: 18,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
    },
    badgeText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: 'bold',
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'flex-start',
        paddingTop: 100,
    },
    menuContainer: {
        backgroundColor: '#fff',
        marginHorizontal: 20,
        top: 20,
        left: -15,
        width: '60%',
        borderRadius: 16,
        paddingVertical: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 8,
    },
    menuHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    menuTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    menuItemText: {
        flex: 1,
        fontSize: 16,
        color: '#52616B',
        marginLeft: 12,
    },
    logoutItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderTopWidth: 1,
        borderTopColor: '#eee',
        marginTop: 8,
    },
    logoutText: {
        fontSize: 16,
        color: '#e74c3c',
        marginLeft: 12,
    },
});
