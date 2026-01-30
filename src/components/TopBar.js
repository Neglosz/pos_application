import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Modal, TouchableWithoutFeedback } from 'react-native';
import { Ionicons, FontAwesome5, FontAwesome } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../services/supabase';

import { getUnreadNotificationCount } from '../services/api'; // Add import

export default function TopBar({ onLogout }) {
    const navigation = useNavigation();
    const [menuVisible, setMenuVisible] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

    // Fetch unread count on mount and when screen focuses
    React.useEffect(() => {
        const fetchUnreadCount = async () => {
            try {
                const response = await getUnreadNotificationCount();
                if (response.success) {
                    setUnreadCount(response.count);
                }
            } catch (error) {
                console.log('Error fetching unread count:', error);
            }
        };

        const unsubscribe = navigation.addListener('focus', fetchUnreadCount);
        // Also fetch immediately
        fetchUnreadCount();

        // Optional: Poll every minute
        const interval = setInterval(fetchUnreadCount, 60000);

        return () => {
            unsubscribe();
            clearInterval(interval);
        };
    }, [navigation]);

    const handleLogout = async () => {
        setMenuVisible(false);
        await supabase.auth.signOut();
        if (onLogout) onLogout();
    };

    const menuItems = [
        {
            icon: <FontAwesome5 name='user-cog' size={22} color="#4AB58E" />,
            label: 'จัดการผู้ใช้',
            onPress: () => {
                setMenuVisible(false);
                //navigation.navigate('ManagerManagement');
            },
        },
        {
            icon: <FontAwesome name='print' size={22} color="#52616B" />,
            label: 'เชื่อมต่ออุปกรณ์',
            onPress: () => {
                setMenuVisible(false);
                navigation.navigate('DeviceConnect');
            },
        },
        {
            icon: <FontAwesome name='cloud' size={22} color="#165DFC" />,
            label: 'สำรองข้อมูล',
            onPress: () => {
                setMenuVisible(false);
                //navigation.navigate('Backup');
            },
        },
    ];

    return (
        <View style={styles.container}>
            {/* Profile Image - กดแล้วเปิด Menu */}
            <TouchableOpacity onPress={() => setMenuVisible(true)}>
                <Image
                    source={{ uri: 'https://img2.pic.in.th/Screenshot-2025-12-18-001409.md.png' }}
                    style={styles.profileImage}
                />
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
    profileImage: {
        width: 45,
        height: 45,
        borderRadius: 22.5,
        backgroundColor: '#ddd',
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
