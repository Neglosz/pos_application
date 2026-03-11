import { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Linking,
    ActivityIndicator,
    Alert,
    Platform,
    StatusBar,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { deleteNotification, markNotificationAsRead, markNotificationsAsRead, runDailyCheck } from '../services/api';
import { supabase } from '../services/supabase';
import { Swipeable } from 'react-native-gesture-handler';
import { useNotificationStore } from '../stores/useNotificationStore';
import { useStore } from '../contexts/StoreContext';
import { useFocusEffect } from '@react-navigation/native';

const tabs = [
    { id: 'all', label: 'ทั้งหมด' },
    { id: 'payment', label: 'การเงิน' },
    { id: 'stock', label: 'สินค้า/สต็อก' },
    // { id: 'system', label: 'ระบบ' },
];

export default function AlertScreen({ navigation }) {
    const [activeTab, setActiveTab] = useState('all');
    const { notifications, setNotifications, isLoading: loading, fetchNotifications, setUnreadCount } = useNotificationStore();
    const [checking, setChecking] = useState(false);
    const [offlineError, setOfflineError] = useState(false);
    const { currentStore } = useStore();
    const statusBarHeight = Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 24;

    const handleCheckNotifications = async () => {
        try {
            setChecking(true);
            setOfflineError(false);
            await runDailyCheck();
            await fetchNotifications();
        } catch (error) {
            console.error('Check error:', error);
        } finally {
            setChecking(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchNotifications();
        }, [])
    );

    // NOTE: Realtime is handled globally by useRealtimeSync hook (with debounce).
    // No local subscription needed here — avoids double-triggering fetchNotifications.


    const handleBack = () => {
        navigation?.goBack();
    };

    const handleCall = (phone) => {
        if (phone) {
            Linking.openURL(`tel:${phone}`);
        }
    };

    const handleRetry = () => {
        setOfflineError(false);
        fetchNotifications();
    };

    // Sync unread count from local notifications state
    const syncUnreadCount = (updatedNotifications) => {
        const count = updatedNotifications.filter(n => !n.is_read).length;
        setUnreadCount(count);
    };

    const markAsRead = async (type) => {
        const ids = type === 'today'
            ? todayNotifications.filter(n => !n.is_read).map(n => n.id)
            : earlierNotifications.filter(n => !n.is_read).map(n => n.id);

        if (ids.length === 0) return;

        try {
            const response = await markNotificationsAsRead(ids);
            if (response.success) {
                const updated = notifications.map(n => ids.includes(n.id) ? { ...n, is_read: true } : n);
                setNotifications(updated);
                syncUnreadCount(updated);
                setOfflineError(false);
            }
        } catch (error) {
            console.error('Mark read error:', error);
            setOfflineError(true);
            Alert.alert(
                'ไม่สามารถเชื่อมต่อได้',
                'กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต แล้วลองใหม่อีกครั้ง',
                [
                    { text: 'ตกลง' },
                    { text: 'ลองใหม่', onPress: () => markAsRead(type) },
                ]
            );
        }
    };

    const handleNotificationPress = async (id) => {
        try {
            await markNotificationAsRead(id);
            const updated = notifications.map(n => n.id === id ? { ...n, is_read: true } : n);
            setNotifications(updated);
            syncUnreadCount(updated);
        } catch (error) {
            console.error('Mark read error:', error);
        }
    };

    const handleDelete = async (id) => {
        try {
            const response = await deleteNotification(id);
            if (response.success) {
                const updated = notifications.filter(n => n.id !== id);
                setNotifications(updated);
                syncUnreadCount(updated);
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
            <Ionicons name="trash-outline" size={20} color="#fff" />
            <Text style={styles.deleteText}>ลบ</Text>
        </TouchableOpacity>
    );

    const filterNotifications = (notifs) => {
        if (activeTab === 'all') return notifs;

        const categoryMap = {
            'payment': ['payment', 'การเงิน'],
            'stock': ['stock', 'สต็อก', 'สินค้า'],
            // 'system': ['system', 'ระบบ']
        };

        const validCategories = categoryMap[activeTab] || [activeTab];
        return notifs.filter(n => validCategories.includes(n.category));
    };

    const isToday = (dateString) => {
        if (!dateString) return false;
        const date = new Date(dateString);
        const today = new Date();
        return date.toDateString() === today.toDateString();
    };

    const formatTime = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'เมื่อกี้';
        if (diffMins < 60) return `${diffMins} นาทีที่แล้ว`;
        if (diffHours < 24) return `${diffHours} ชม. ที่แล้ว`;
        if (diffDays === 1) return 'เมื่อวาน';
        return `${diffDays} วันที่แล้ว`;
    };

    const getIconByCategory = (category, type) => {
        if (type === 'stock_expired') {
            return { icon: 'package-variant-closed', color: '#E53935' };
        }
        if (type === 'stock_near_expiry') {
            return { icon: 'clock-alert', color: '#F37021' };
        }
        if (type === 'stock_out') {
            return { icon: 'package-variant-remove', color: '#E53935' };
        }
        if (type === 'stock_low') {
            return { icon: 'package-down', color: '#FFC107' };
        }

        switch (category) {
            case 'payment':
            case 'การเงิน':
                return { icon: 'account-clock', color: '#2196F3' };
            case 'stock':
            case 'สต็อก':
            case 'สินค้า':
                return { icon: 'package-variant', color: '#FF9800' };
            // case 'system':
            // case 'ระบบ':
            //     return { icon: 'cloud-sync', color: '#4CAF50' };
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
                    style={[
                        styles.notificationCard,
                        isRead ? styles.notificationCardRead : styles.notificationCardUnread,
                    ]}
                    onPress={() => handleNotificationPress(notification.id)}
                    activeOpacity={0.75}
                >
                    {/* Unread accent bar */}
                    {!isRead && <View style={[styles.unreadAccent, { backgroundColor: color }]} />}

                    {/* Icon */}
                    <View style={[
                        styles.iconContainer,
                        { backgroundColor: color, opacity: isRead ? 0.55 : 1 }
                    ]}>
                        <MaterialCommunityIcons name={icon} size={28} color="#fff" />
                    </View>

                    {/* Content */}
                    <View style={styles.contentContainer}>
                        <View style={styles.titleRow}>
                            <Text
                                style={[
                                    styles.notificationTitle,
                                    isRead && styles.notificationTitleRead,
                                ]}
                                numberOfLines={1}
                            >
                                {notification.title || 'แจ้งเตือน'}
                            </Text>
                            {/* Unread dot */}
                            {!isRead && <View style={styles.unreadDot} />}
                        </View>
                        <Text
                            style={[
                                styles.notificationDescription,
                                isRead && styles.notificationDescriptionRead,
                            ]}
                            numberOfLines={2}
                        >
                            {notification.message}
                        </Text>
                    </View>

                    {/* Right side */}
                    <View style={styles.rightContainer}>
                        <Text style={styles.timeText}>
                            {formatTime(notification.created_at)}
                        </Text>
                        <Text style={styles.categoryText}>
                            {notification.category}
                        </Text>

                        {phone && (
                            <TouchableOpacity
                                style={styles.callButton}
                                onPress={() => handleCall(phone)}
                            >
                                <FontAwesome5 name="phone-alt" size={10} color="#fff" />
                                <Text style={styles.callButtonText}>โทร</Text>
                            </TouchableOpacity>
                        )}

                        {(notification.category === 'ระบบ' || notification.category === 'system') && (
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

    // Badge shows unread count only (test case: badge ลดลงหลังอ่าน)
    const getTabUnreadCount = (tabId) => {
        if (tabId === 'all') return notifications.filter(n => !n.is_read).length;

        const categoryMap = {
            'payment': ['payment', 'การเงิน'],
            'stock': ['stock', 'สต็อก', 'สินค้า'],
            // 'system': ['system', 'ระบบ']
        };

        const validCategories = categoryMap[tabId] || [tabId];
        return notifications.filter(n => !n.is_read && validCategories.includes(n.category)).length;
    };

    const hasTodayUnread = todayNotifications.some(n => !n.is_read);
    const hasEarlierUnread = earlierNotifications.some(n => !n.is_read);

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={[styles.header, { paddingTop: statusBarHeight + 8 }]}>
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

            {/* Offline error banner */}
            {offlineError && (
                <View style={styles.offlineBanner}>
                    <Ionicons name="wifi-outline" size={14} color="#fff" />
                    <Text style={styles.offlineBannerText}>ไม่มีการเชื่อมต่อ กรุณาลองใหม่</Text>
                    <TouchableOpacity onPress={handleRetry}>
                        <Text style={styles.offlineBannerRetry}>ลองใหม่</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Tab Bar */}
            <View style={styles.tabBarContainer}>
                <ScrollView
                    horizontal={true}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.tabBar}
                >
                    {tabs.map((tab) => {
                        const unreadCount = getTabUnreadCount(tab.id);
                        const isActive = activeTab === tab.id;
                        return (
                            <TouchableOpacity
                                key={tab.id}
                                style={[styles.tab, isActive && styles.activeTab]}
                                onPress={() => setActiveTab(tab.id)}
                            >
                                {unreadCount > 0 && (
                                    <View style={[styles.countBadge, isActive && styles.countBadgeActive]}>
                                        <Text style={[styles.countText, isActive && styles.countTextActive]}>
                                            {unreadCount > 99 ? '99+' : unreadCount}
                                        </Text>
                                    </View>
                                )}
                                <Text style={[styles.tabText, isActive && styles.activeTabText]}>
                                    {tab.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            {/* Loading */}
            {loading && (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#F37021" />
                </View>
            )}

            {/* Notifications List */}
            {!loading && (
                <ScrollView style={styles.notificationsList} showsVerticalScrollIndicator={false}>
                    {/* Today */}
                    {todayNotifications.length > 0 && (
                        <View style={styles.section}>
                            <View style={styles.sectionHeader}>
                                <Text style={styles.sectionTitle}>วันนี้</Text>
                                {hasTodayUnread && (
                                    <TouchableOpacity onPress={() => markAsRead('today')}>
                                        <Text style={styles.readAllText}>อ่านทั้งหมด</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                            {todayNotifications.map(renderNotificationCard)}
                        </View>
                    )}

                    {/* Earlier */}
                    {earlierNotifications.length > 0 && (
                        <View style={styles.section}>
                            <View style={styles.sectionHeader}>
                                <Text style={styles.sectionTitle}>ก่อนหน้านี้</Text>
                                {hasEarlierUnread && (
                                    <TouchableOpacity onPress={() => markAsRead('earlier')}>
                                        <Text style={styles.readAllText}>อ่านทั้งหมด</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                            {earlierNotifications.map(renderNotificationCard)}
                        </View>
                    )}

                    {/* Empty state */}
                    {filteredNotifications.length === 0 && (
                        <View style={styles.emptyState}>
                            <Ionicons name="notifications-off-outline" size={56} color="#ccc" />
                            <Text style={styles.emptyText}>ไม่มีการแจ้งเตือน</Text>
                        </View>
                    )}

                    <View style={{ height: 100 }} />
                </ScrollView>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FA',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingBottom: 12,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    backButton: {
        padding: 12,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#000',
    },
    refreshButton: {
        padding: 12,
        borderRadius: 24,
        backgroundColor: '#FFF5F0',
    },
    offlineBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E53935',
        paddingVertical: 10,
        paddingHorizontal: 16,
        gap: 8,
    },
    offlineBannerText: {
        flex: 1,
        color: '#fff',
        fontSize: 14,
        fontWeight: '500',
    },
    offlineBannerRetry: {
        color: '#fff',
        fontSize: 14,
        fontWeight: 'bold',
        textDecorationLine: 'underline',
    },
    tabBarContainer: {
        backgroundColor: '#fff',
        paddingVertical: 10,
        paddingHorizontal: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    tabBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    tab: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 11,
        paddingHorizontal: 18,
        borderRadius: 24,
        backgroundColor: '#F5F5F5',
        gap: 5,
    },
    activeTab: {
        backgroundColor: '#F37021',
    },
    tabText: {
        fontSize: 16,
        color: '#666',
        fontWeight: '500',
    },
    activeTabText: {
        color: '#fff',
    },
    countBadge: {
        backgroundColor: '#F37021',
        borderRadius: 12,
        minWidth: 22,
        height: 22,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 5,
    },
    countBadgeActive: {
        backgroundColor: '#fff',
    },
    countText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    countTextActive: {
        color: '#F37021',
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    readAllText: {
        color: '#F37021',
        fontSize: 16,
        fontWeight: '600',
    },
    notificationsList: {
        flex: 1,
        paddingHorizontal: 15,
    },
    section: {
        marginTop: 16,
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
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    // Unread card: white bg, shadow, left accent bar
    notificationCardUnread: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 18,
        marginBottom: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
        elevation: 3,
        overflow: 'hidden',
    },
    // Read card: muted bg, no shadow
    notificationCardRead: {
        flexDirection: 'row',
        backgroundColor: '#F5F5F5',
        borderRadius: 16,
        padding: 18,
        marginBottom: 10,
        opacity: 0.75,
    },
    // Keep for compatibility
    notificationCard: {
        flexDirection: 'row',
        borderRadius: 16,
        padding: 18,
        marginBottom: 10,
    },
    // Left color accent for unread
    unreadAccent: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 4,
        borderTopLeftRadius: 14,
        borderBottomLeftRadius: 14,
    },
    deleteAction: {
        backgroundColor: '#E53935',
        justifyContent: 'center',
        alignItems: 'center',
        width: 72,
        borderRadius: 14,
        marginLeft: 8,
        gap: 2,
    },
    deleteText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 12,
    },
    iconContainer: {
        width: 52,
        height: 52,
        borderRadius: 26,
        justifyContent: 'center',
        alignItems: 'center',
        flexShrink: 0,
    },
    contentContainer: {
        flex: 1,
        marginLeft: 12,
        justifyContent: 'center',
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 3,
    },
    notificationTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1A1A1A',
        flex: 1,
    },
    notificationTitleRead: {
        fontWeight: '500',
        color: '#666',
    },
    // Unread dot indicator next to title
    unreadDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#F37021',
        flexShrink: 0,
    },
    notificationDescription: {
        fontSize: 14,
        fontWeight: '500',
        color: '#444',
        lineHeight: 21,
    },
    notificationDescriptionRead: {
        color: '#999',
        fontWeight: '400',
    },
    rightContainer: {
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        minWidth: 76,
        paddingLeft: 8,
    },
    timeText: {
        fontSize: 13,
        color: '#AAA',
    },
    categoryText: {
        fontSize: 13,
        color: '#BBB',
        marginTop: 2,
    },
    callButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E53935',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 22,
        gap: 6,
        marginTop: 8,
    },
    callButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    retryButton: {
        backgroundColor: '#FF9800',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 22,
        marginTop: 8,
    },
    retryButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    emptyText: {
        fontSize: 16,
        color: '#CCC',
        marginTop: 14,
        fontWeight: '500',
    },
});
