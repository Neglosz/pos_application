import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Linking,
    ActivityIndicator,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { getNotifications, deleteNotification, markNotificationAsRead, markNotificationsAsRead, runDailyCheck } from '../services/api';
import { supabase } from '../services/supabase';
import { Swipeable } from 'react-native-gesture-handler';

const tabs = [
    { id: 'all', label: 'ทั้งหมด' },
    { id: 'payment', label: 'การเงิน' },
    { id: 'stock', label: 'สินค้า/สต็อก' },
    { id: 'system', label: 'ระบบ' },
];

export default function AlertScreen({ navigation }) {
    const [activeTab, setActiveTab] = useState('all');
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [checking, setChecking] = useState(false);

    // Function to run daily check and refresh notifications
    const handleCheckNotifications = async () => {
        try {
            setChecking(true);
            await runDailyCheck();
            await fetchNotifications();
        } catch (error) {
            console.error('Check error:', error);
        } finally {
            setChecking(false);
        }
    };

    const fetchNotifications = async () => {
        try {
            setLoading(true);
            // Just fetch existing notifications - no more auto-check!
            // Notifications are now created by database triggers & daily cron
            const response = await getNotifications();
            if (response.success) {
                setNotifications(response.data);
            }
        } catch (err) {
            console.error('Error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNotifications();

        // Subscribe to realtime updates
        const channel = supabase
            .channel('alert-screen-notifications')
            .on('postgres_changes', {
                event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
                schema: 'public',
                table: 'notifications'
            }, () => {
                // Refetch when any change happens
                fetchNotifications();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const handleBack = () => {
        navigation?.goBack();
    };

    const handleCall = (phone) => {
        if (phone) {
            Linking.openURL(`tel:${phone}`);
        }
    };

    const handleRetry = () => {
        console.log('Retrying...');
        fetchNotifications();
    };

    const markAsRead = async (type) => {
        const ids = type === 'today'
            ? todayNotifications.map(n => n.id)
            : earlierNotifications.map(n => n.id);

        try {
            const response = await markNotificationsAsRead(ids);
            if (response.success) {
                setNotifications(notifications.map(n => ids.includes(n.id) ? { ...n, is_read: true } : n));
            }
        } catch (error) {
            console.error('Mark read error:', error);
        }
    };

    const handleNotificationPress = async (id) => {
        try {
            await markNotificationAsRead(id);
            setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n));
        } catch (error) {
            console.error('Mark read error:', error);
        }
    }

    const handleDelete = async (id) => {
        try {
            const response = await deleteNotification(id);
            if (response.success) {
                setNotifications(notifications.filter(n => n.id !== id));
            }
        } catch (error) {
            console.error('Delete error:', error);
        }
    };

    const renderRightActions = (id) => (
        <TouchableOpacity
            style={styles.deleteAction}
            onPress={() => handleDelete(id)}
        >
            <Text style={styles.deleteText}>ลบ</Text>
        </TouchableOpacity>
    );

    // Filter by category
    const filterNotifications = (notifs) => {
        if (activeTab === 'all') return notifs;

        // Map tab IDs to categories (support both Thai and English)
        const categoryMap = {
            'payment': ['payment', 'การเงิน'],
            'stock': ['stock', 'สต็อก', 'สินค้า'],
            'system': ['system', 'ระบบ']
        };

        const validCategories = categoryMap[activeTab] || [activeTab];
        return notifs.filter(n => validCategories.includes(n.category));
    };

    // Check if date is today
    const isToday = (dateString) => {
        if (!dateString) return false;
        const date = new Date(dateString);
        const today = new Date();
        return date.toDateString() === today.toDateString();
    };

    // Format time for display
    const formatTime = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 60) return `${diffMins} นาทีที่แล้ว`;
        if (diffHours < 24) return `${diffHours} ชม. ที่แล้ว`;
        if (diffDays === 1) return 'เมื่อวาน';
        return `${diffDays} วันที่แล้ว`;
    };

    // Get icon and color by category and type
    const getIconByCategory = (category, type) => {
        // Stock notification types with specific colors
        if (type === 'stock_expired') {
            return { icon: 'package-variant-closed', color: '#E53935' }; // Red for expired
        }
        if (type === 'stock_near_expiry') {
            return { icon: 'clock-alert', color: '#FF9800' }; // Orange for near expiry
        }
        if (type === 'stock_out') {
            return { icon: 'package-variant-remove', color: '#E53935' }; // Red for out of stock
        }
        if (type === 'stock_low') {
            return { icon: 'package-down', color: '#FFC107' }; // Yellow for low stock
        }

        // Default category-based icons
        switch (category) {
            case 'payment':
            case 'การเงิน':
                return { icon: 'account-clock', color: '#2196F3' };
            case 'stock':
            case 'สต็อก':
            case 'สินค้า':
                return { icon: 'package-variant', color: '#FF9800' };
            case 'system':
            case 'ระบบ':
                return { icon: 'cloud-sync', color: '#4CAF50' };
            default:
                return { icon: 'bell', color: '#999' };
        }
    };

    const renderNotificationCard = (notification) => {
        const { icon, color } = getIconByCategory(notification.category, notification.type);
        let phone = null;
        const isRead = notification.is_read;
        if (notification.payload) {
            const payload = typeof notification.payload === 'string'
                ? JSON.parse(notification.payload)
                : notification.payload;
            phone = payload?.phone;
        }

        return (
            <Swipeable
                key={notification.id}
                renderRightActions={() => renderRightActions(notification.id)}
            >
                <TouchableOpacity
                    style={[styles.notificationCard, isRead && styles.notificationCardRead]}
                    onPress={() => handleNotificationPress(notification.id)}
                    activeOpacity={0.8}
                >
                    {/* Icon */}
                    <View style={[styles.iconContainer, { backgroundColor: color }]}>
                        <MaterialCommunityIcons name={icon} size={24} color="#fff" />
                    </View>

                    {/* Content */}
                    <View style={styles.contentContainer}>
                        <Text style={styles.notificationTitle}>{notification.title || 'แจ้งเตือน'}</Text>
                        <Text style={styles.notificationDescription}>{notification.message}</Text>
                    </View>

                    {/* Right side */}
                    <View style={styles.rightContainer}>
                        <Text style={styles.timeText}>{formatTime(notification.created_at)}</Text>
                        <Text style={styles.categoryText}>{notification.category}</Text>

                        {phone && (
                            <TouchableOpacity
                                style={styles.callButton}
                                onPress={() => handleCall(phone)}
                            >
                                <FontAwesome5 name="phone-alt" size={12} color="#fff" />
                                <Text style={styles.callButtonText}>โทร</Text>
                            </TouchableOpacity>
                        )}

                        {notification.category === 'ระบบ' && (
                            <TouchableOpacity
                                style={styles.retryButton}
                                onPress={handleRetry}
                            >
                                <Text style={styles.retryButtonText}>ลองใหม่</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </TouchableOpacity>
            </Swipeable>
        );
    };

    const filteredNotifications = filterNotifications(notifications);
    const todayNotifications = filteredNotifications.filter(n => isToday(n.created_at));
    const earlierNotifications = filteredNotifications.filter(n => !isToday(n.created_at));

    // Calculate count for each tab
    const getTabCount = (tabId) => {
        if (tabId === 'all') return notifications.length;

        const categoryMap = {
            'payment': ['payment', 'การเงิน'],
            'stock': ['stock', 'สต็อก', 'สินค้า'],
            'system': ['system', 'ระบบ']
        };

        const validCategories = categoryMap[tabId] || [tabId];
        return notifications.filter(n => validCategories.includes(n.category)).length;
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#000" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>การแจ้งเตือน</Text>
                <TouchableOpacity
                    style={styles.refreshButton}
                    onPress={handleCheckNotifications}
                    disabled={checking}
                >
                    {checking ? (
                        <ActivityIndicator size="small" color="#F37021" />
                    ) : (
                        <Ionicons name="refresh" size={22} color="#F37021" />
                    )}
                </TouchableOpacity>
            </View>

            {/* Tab Bar */}
            <View style={styles.tabBarContainer}>
                <ScrollView
                    horizontal={true}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.tabBar}
                >
                    {tabs.map((tab) => {
                        const count = getTabCount(tab.id);
                        return (
                            <TouchableOpacity
                                key={tab.id}
                                style={[styles.tab, activeTab === tab.id && styles.activeTab]}
                                onPress={() => setActiveTab(tab.id)}
                            >
                                {count > 0 && (
                                    <View style={styles.countBadge}>
                                        <Text style={styles.countText}>{count}</Text>
                                    </View>
                                )}
                                <Text style={[styles.tabText, activeTab === tab.id && styles.activeTabText]}>
                                    {tab.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            {/* Notifications List */}
            <ScrollView style={styles.notificationsList} showsVerticalScrollIndicator={false}>
                {/* Today */}
                {todayNotifications.length > 0 && (
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>วันนี้</Text>
                            <TouchableOpacity onPress={() => markAsRead('today')}>
                                <Text style={styles.readAllText}>อ่านทั้งหมด</Text>
                            </TouchableOpacity>
                        </View>
                        {todayNotifications.map(renderNotificationCard)}
                    </View>
                )}

                {/* Earlier */}
                {earlierNotifications.length > 0 && (
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>ก่อนหน้านี้</Text>
                            <TouchableOpacity onPress={() => markAsRead('earlier')}>
                                <Text style={styles.readAllText}>อ่านทั้งหมด</Text>
                            </TouchableOpacity>
                        </View>
                        {earlierNotifications.map(renderNotificationCard)}
                    </View>
                )}

                {/* Empty state */}
                {filteredNotifications.length === 0 && !loading && (
                    <View style={styles.emptyState}>
                        <Ionicons name="notifications-off-outline" size={48} color="#ccc" />
                        <Text style={styles.emptyText}>ไม่มีการแจ้งเตือน</Text>
                    </View>
                )}

                <View style={{ height: 100 }} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        paddingTop: 50,
    },
    backButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#000',
    },
    bellContainer: {
        padding: 8,
    },
    refreshButton: {
        padding: 8,
        borderRadius: 20,
        backgroundColor: '#FFF5F0',
    },
    tabBarContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        paddingVertical: 10,
        paddingHorizontal: 15,
    },
    tabBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flex: 1,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#F5F5F5',
        gap: 4,
    },
    activeTab: {
        backgroundColor: '#000',
    },
    tabText: {
        fontSize: 13,
        color: '#666',
        fontWeight: '500',
    },
    activeTabText: {
        color: '#fff',
    },
    countBadge: {
        backgroundColor: '#fff',
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
        marginRight: 6,
    },
    countText: {
        color: '#000',
        fontSize: 11,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    readAllButton: {
        paddingHorizontal: 10,
    },
    readAllText: {
        color: '#2196F3',
        fontSize: 13,
        fontWeight: '500',
    },
    notificationsList: {
        flex: 1,
        paddingHorizontal: 15,
    },
    section: {
        marginTop: 15,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    sectionTitle: {
        fontSize: 14,
        color: '#999',
        marginBottom: 10,
        fontWeight: '500',
    },
    notificationCard: {
        flexDirection: 'row',
        backgroundColor: '#f5f5f5',
        borderRadius: 15,
        padding: 15,
        marginBottom: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    },
    notificationCardRead: {
        backgroundColor: '#fff',
    },
    deleteAction: {
        backgroundColor: '#E53935',
        justifyContent: 'center',
        alignItems: 'center',
        width: 80,
        height: '90%',
        borderRadius: 15,
        marginLeft: 10,
    },
    deleteText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14,
    },
    iconContainer: {
        width: 45,
        height: 45,
        borderRadius: 22.5,
        justifyContent: 'center',
        alignItems: 'center',
    },
    contentContainer: {
        flex: 1,
        marginLeft: 12,
        justifyContent: 'center',
    },
    notificationTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#333',
        marginBottom: 4,
    },
    notificationDescription: {
        fontSize: 12,
        fontWeight: '700',
        color: '#666',
        lineHeight: 18,
    },
    rightContainer: {
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        minWidth: 80,
    },
    timeText: {
        fontSize: 11,
        color: '#999',
    },
    categoryText: {
        fontSize: 11,
        color: '#999',
        marginTop: 2,
    },
    callButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E53935',
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 20,
        gap: 6,
        marginTop: 8,
    },
    callButtonText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '600',
    },
    retryButton: {
        backgroundColor: '#FF9800',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        marginTop: 8,
    },
    retryButtonText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 50,
    },
    emptyText: {
        fontSize: 16,
        color: '#999',
        marginTop: 10,
    },
});
