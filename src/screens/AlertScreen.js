import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Pressable,
    SectionList,
    RefreshControl,
    Linking,
    ActivityIndicator,
    Alert,
    Platform,
    AccessibilityInfo,
    useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withRepeat,
    withSequence,
    cancelAnimation,
} from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { deleteNotification, markNotificationAsRead, markNotificationsAsRead, runDailyCheck } from '../services/api';
import { Swipeable } from 'react-native-gesture-handler';
import { useNotificationStore } from '../stores/useNotificationStore';
import { useFocusEffect } from '@react-navigation/native';

// ─────────────────────────────────────────────────────────────────────────
// Static config — lives outside the component so it's never rebuilt per render.
// ─────────────────────────────────────────────────────────────────────────

const COLORS = {
    primary: '#F37021',
    primaryDeep: '#E65100',
    bg: '#FAF8F5',
    surface: '#FFFFFF',
    textPrimary: '#1F2937',
    textSecondary: '#6B7280',
    border: '#EDE8E1',
    success: '#2E7D32',
    warning: '#F59E0B',
    danger: '#D32F2F',
    finance: '#1976D2',
    stock: '#FF9800',
    system: '#2E7D32',
};

// Same bucketing rules the original screen used (category field can arrive in
// Thai or English depending on where the backend generated it) — centralised
// once so filtering, tab badges and the summary panel all agree.
const CATEGORY_BUCKETS = {
    payment: ['payment', 'การเงิน'],
    stock: ['stock', 'สต็อก', 'สินค้า'],
};
const getCategoryBucket = (category) => {
    if (CATEGORY_BUCKETS.payment.includes(category)) return 'payment';
    if (CATEGORY_BUCKETS.stock.includes(category)) return 'stock';
    return 'other';
};
const isSystemCategory = (category) => category === 'system' || category === 'ระบบ';

const TABS = [
    { id: 'all', label: 'ทั้งหมด', icon: 'apps-outline' },
    { id: 'payment', label: 'การเงิน', icon: 'cash-outline' },
    { id: 'stock', label: 'สินค้า/สต็อก', icon: 'cube-outline' },
    // { id: 'system', label: 'ระบบ', icon: 'settings-outline' },
];

// Types the "สำคัญ" count in the summary panel is derived from — all real
// notification types the backend already sends, nothing invented.
const IMPORTANT_TYPES = ['stock_expired', 'stock_out', 'stock_near_expiry'];

// `priority` is a real column the backend already sets (see upsertNotificationGlobal
// callers in notificationRoutes.js) — this just orders by it within each day instead
// of leaving it unused. Unknown/missing priority sorts last, not first.
const PRIORITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 };
const getPriorityRank = (priority) => (priority in PRIORITY_RANK ? PRIORITY_RANK[priority] : 4);
const sortByPriorityThenRecency = (list) => [...list].sort((a, b) => {
    const rankDiff = getPriorityRank(a.priority) - getPriorityRank(b.priority);
    if (rankDiff !== 0) return rankDiff;
    return new Date(b.created_at) - new Date(a.created_at);
});

// Client-side snooze — hides a notification until tomorrow 9am without touching the
// backend or its is_read state. Local to this device only (AsyncStorage), which is a
// deliberate scope cut: a real cross-device snooze needs a backend column + migration.
const SNOOZE_STORAGE_KEY = 'alert_snoozed_until_v1';
const getTomorrowMorning = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return d.toISOString();
};

const getNotificationVisual = (category, type) => {
    if (type === 'stock_expired') return { icon: 'package-variant-closed', color: COLORS.danger, bg: '#FCE9E9' };
    if (type === 'stock_out') return { icon: 'package-variant-remove', color: COLORS.danger, bg: '#FCE9E9' };
    if (type === 'stock_near_expiry') return { icon: 'clock-alert-outline', color: COLORS.warning, bg: '#FFF3DE' };
    if (type === 'stock_low') return { icon: 'package-down', color: COLORS.stock, bg: '#FFF0DD' };

    const bucket = getCategoryBucket(category);
    if (bucket === 'payment') return { icon: 'account-clock-outline', color: COLORS.finance, bg: '#E7F0FB' };
    if (bucket === 'stock') return { icon: 'package-variant', color: COLORS.stock, bg: '#FFF0DD' };
    if (isSystemCategory(category)) return { icon: 'sync-circle', color: COLORS.system, bg: '#E8F3E9' };
    return { icon: 'bell-outline', color: COLORS.textSecondary, bg: '#F1EFEA' };
};

const filterNotifications = (notifs, tab) => {
    if (tab === 'all') return notifs;
    return notifs.filter((n) => getCategoryBucket(n.category) === tab);
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

// A malformed payload (bad JSON, or not JSON at all) must never crash the
// screen — every caller gets null back instead of a thrown exception.
const safeParsePayload = (notification) => {
    const raw = notification?.payload;
    if (!raw) return null;
    if (typeof raw === 'object') return raw;
    try {
        return JSON.parse(raw);
    } catch (_) {
        return null;
    }
};

function useReduceMotion() {
    const [reduced, setReduced] = useState(false);
    useEffect(() => {
        let mounted = true;
        AccessibilityInfo.isReduceMotionEnabled?.()
            .then((v) => { if (mounted) setReduced(!!v); })
            .catch(() => {});
        const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v) => setReduced(!!v));
        return () => {
            mounted = false;
            sub?.remove?.();
        };
    }, []);
    return reduced;
}

// ─────────────────────────────────────────────────────────────────────────
// Presentational pieces
// ─────────────────────────────────────────────────────────────────────────

function AlertHeader({ onBack, checking, onRefresh, unreadCount, insetsTop }) {
    return (
        <View style={[styles.header, { paddingTop: insetsTop + 10 }]}>
            <TouchableOpacity
                onPress={onBack}
                style={styles.headerIconBtn}
                accessibilityRole="button"
                accessibilityLabel="ย้อนกลับ"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
                <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>

            <View style={styles.headerTitleWrap}>
                <Text style={styles.headerTitle} numberOfLines={1}>การแจ้งเตือน</Text>
                <Text style={styles.headerSubtitle} numberOfLines={1}>
                    {unreadCount > 0 ? `ยังไม่ได้อ่าน ${unreadCount} รายการ` : 'อ่านครบแล้ว'}
                </Text>
            </View>

            <TouchableOpacity
                style={styles.headerIconBtn}
                onPress={onRefresh}
                disabled={checking}
                accessibilityRole="button"
                accessibilityLabel={checking ? 'กำลังตรวจสอบการแจ้งเตือน' : 'ตรวจสอบการแจ้งเตือนใหม่'}
                accessibilityState={{ busy: checking }}
            >
                {checking ? (
                    <ActivityIndicator size="small" color={COLORS.primary} />
                ) : (
                    <Ionicons name="refresh" size={22} color={COLORS.primary} />
                )}
            </TouchableOpacity>
        </View>
    );
}

function OfflineBanner({ onRetry }) {
    return (
        <View style={styles.offlineBanner}>
            <Ionicons name="cloud-offline-outline" size={18} color="#fff" />
            <Text style={styles.offlineBannerText}>
                ไม่มีการเชื่อมต่ออินเทอร์เน็ต ตรวจสอบสัญญาณแล้วลองใหม่
            </Text>
            <TouchableOpacity
                onPress={onRetry}
                style={styles.offlineRetryBtn}
                accessibilityRole="button"
                accessibilityLabel="ลองเชื่อมต่อใหม่"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
                <Text style={styles.offlineBannerRetry}>ลองใหม่</Text>
            </TouchableOpacity>
        </View>
    );
}

function InboxSummary({ unreadCount, totalCount, importantCount, onMarkAllRead }) {
    return (
        <View style={styles.summaryCard}>
            <View style={styles.summaryStatsRow}>
                <View style={styles.summaryStat}>
                    <Text style={styles.summaryStatValue}>{unreadCount}</Text>
                    <Text style={styles.summaryStatLabel}>ยังไม่อ่าน</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryStat}>
                    <Text style={styles.summaryStatValue}>{totalCount}</Text>
                    <Text style={styles.summaryStatLabel}>ทั้งหมด</Text>
                </View>
                {importantCount > 0 && (
                    <>
                        <View style={styles.summaryDivider} />
                        <View style={styles.summaryStat}>
                            <Text style={[styles.summaryStatValue, { color: COLORS.danger }]}>{importantCount}</Text>
                            <Text style={styles.summaryStatLabel}>สำคัญ</Text>
                        </View>
                    </>
                )}
            </View>

            {unreadCount > 0 ? (
                <TouchableOpacity
                    style={styles.summaryActionBtn}
                    onPress={onMarkAllRead}
                    accessibilityRole="button"
                    accessibilityLabel={`อ่านทั้งหมด ${unreadCount} รายการ`}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    <Ionicons name="checkmark-done-outline" size={16} color={COLORS.primary} />
                    <Text style={styles.summaryActionText}>อ่านทั้งหมด</Text>
                </TouchableOpacity>
            ) : (
                <View style={styles.summaryDoneBadge}>
                    <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
                    <Text style={styles.summaryDoneText}>อ่านครบแล้ว</Text>
                </View>
            )}
        </View>
    );
}

function CategoryFilterBar({ activeTab, onChange, tabCounts, compact }) {
    return (
        <View style={styles.filterBar} accessibilityRole="tablist">
            {TABS.map((tab) => {
                const isActive = activeTab === tab.id;
                const count = tabCounts[tab.id] || 0;
                return (
                    <Pressable
                        key={tab.id}
                        onPress={() => onChange(tab.id)}
                        style={({ pressed }) => [
                            styles.filterTab,
                            isActive && styles.filterTabActive,
                            pressed && !isActive && styles.filterTabPressed,
                        ]}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: isActive }}
                        accessibilityLabel={`${tab.label}${count > 0 ? `, ${count} รายการยังไม่อ่าน` : ''}`}
                    >
                        <View style={styles.filterTabIconRow}>
                            <Ionicons name={tab.icon} size={compact ? 15 : 17} color={isActive ? '#fff' : COLORS.textSecondary} />
                            {count > 0 && (
                                <View style={[styles.filterBadge, isActive && styles.filterBadgeActive]}>
                                    <Text style={[styles.filterBadgeText, isActive && styles.filterBadgeTextActive]}>
                                        {count > 99 ? '99+' : count}
                                    </Text>
                                </View>
                            )}
                        </View>
                        <Text
                            style={[styles.filterTabText, isActive && styles.filterTabTextActive, compact && styles.filterTabTextCompact]}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.85}
                        >
                            {tab.label}
                        </Text>
                    </Pressable>
                );
            })}
        </View>
    );
}

function NotificationSectionHeader({ section, onMarkAll }) {
    const unreadCount = section.data.filter((n) => !n.is_read).length;
    return (
        <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLeft}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <Text style={styles.sectionMeta}>
                    {section.data.length} รายการ{unreadCount > 0 ? ` · ${unreadCount} ยังไม่อ่าน` : ''}
                </Text>
            </View>
            {unreadCount > 0 && (
                <TouchableOpacity
                    onPress={() => onMarkAll(section.key)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel={`อ่านทั้งหมดในหมวด ${section.title}`}
                >
                    <Text style={styles.readAllText}>อ่านทั้งหมด</Text>
                </TouchableOpacity>
            )}
        </View>
    );
}

// Real product/customer photo when the notification's payload points at one
// (backend resolves it — see routes/notificationRoutes.js). Falls back to the
// plain category icon on a missing URL or a failed load. Uses expo-image
// (already a project dependency) instead of core Image for its disk+memory
// cache — important here since this renders inside a scrolling list on
// low-end Android. transition={0} skips the fade-in to keep it cheap.
function NotificationThumb({ imageUrl, icon, iconColor, bg }) {
    const [failed, setFailed] = useState(false);
    if (imageUrl && !failed) {
        return (
            <Image
                source={imageUrl}
                style={styles.cardIcon}
                contentFit="cover"
                transition={0}
                cachePolicy="memory-disk"
                onError={() => setFailed(true)}
            />
        );
    }
    return (
        <View style={[styles.cardIcon, { backgroundColor: bg }]}>
            <MaterialCommunityIcons name={icon} size={19} color={iconColor} />
        </View>
    );
}

const NotificationCard = React.memo(function NotificationCard({ notification, onPress, onDelete, onCall, onRetry, onSwipeOpen, onSnooze, onOpenSource }) {
    const isRead = !!notification.is_read;
    const visual = getNotificationVisual(notification.category, notification.type);
    const payload = safeParsePayload(notification);
    const phone = payload?.phone || null;
    const isSystem = isSystemCategory(notification.category);
    const bucket = getCategoryBucket(notification.category);
    const canOpenSource = !phone && !isSystem && bucket !== 'other';
    const swipeableRef = useRef(null);

    return (
        <Swipeable
            ref={swipeableRef}
            overshootRight={false}
            onSwipeableWillOpen={() => onSwipeOpen(swipeableRef.current)}
            renderLeftActions={() => (
                <TouchableOpacity
                    style={styles.snoozeAction}
                    onPress={() => onSnooze(notification.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`เลื่อนการแจ้งเตือน ${notification.title || ''} ไปพรุ่งนี้`}
                >
                    <Ionicons name="time-outline" size={18} color="#fff" />
                    <Text style={styles.snoozeText}>เลื่อน</Text>
                </TouchableOpacity>
            )}
            renderRightActions={() => (
                <TouchableOpacity
                    style={styles.deleteAction}
                    onPress={() => onDelete(notification.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`ลบการแจ้งเตือน ${notification.title || ''}`}
                >
                    <Ionicons name="trash-outline" size={18} color="#fff" />
                    <Text style={styles.deleteText}>ลบ</Text>
                </TouchableOpacity>
            )}
        >
            <Pressable
                onPress={() => onPress(notification.id)}
                style={({ pressed }) => [
                    styles.card,
                    isRead ? styles.cardRead : styles.cardUnread,
                    pressed && styles.cardPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`${notification.title || 'แจ้งเตือน'}${isRead ? '' : ', ยังไม่ได้อ่าน'}`}
            >
                <View style={styles.cardTopRow}>
                    <NotificationThumb imageUrl={payload?.image_url} icon={visual.icon} iconColor={visual.color} bg={visual.bg} />
                    <View style={styles.cardTitleWrap}>
                        <Text style={[styles.cardTitle, !isRead && styles.cardTitleUnread]} numberOfLines={1}>
                            {notification.title || 'แจ้งเตือน'}
                        </Text>
                    </View>
                    <Text style={styles.cardTime}>{formatTime(notification.created_at)}</Text>
                </View>

                {!!notification.message && (
                    <Text style={[styles.cardMessage, isRead && styles.cardMessageRead]} numberOfLines={3}>
                        {notification.message}
                    </Text>
                )}

                <View style={styles.cardFooterRow}>
                    <View style={styles.cardChipsRow}>
                        <View style={[styles.chip, { backgroundColor: visual.bg }]}>
                            <Text style={[styles.chipText, { color: visual.color }]} numberOfLines={1}>
                                {notification.category}
                            </Text>
                        </View>
                        {!isRead && (
                            <View style={styles.newChip}>
                                <View style={styles.newDot} />
                                <Text style={styles.newChipText}>ใหม่</Text>
                            </View>
                        )}
                    </View>

                    {phone ? (
                        <TouchableOpacity
                            style={styles.callButton}
                            onPress={(e) => { e?.stopPropagation?.(); onCall(phone); }}
                            accessibilityRole="button"
                            accessibilityLabel={`โทรหา ${notification.title || 'ผู้ติดต่อ'}`}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <Ionicons name="call-outline" size={14} color="#fff" />
                            <Text style={styles.callButtonText}>โทร</Text>
                        </TouchableOpacity>
                    ) : isSystem ? (
                        <TouchableOpacity
                            style={styles.retryButton}
                            onPress={(e) => { e?.stopPropagation?.(); onRetry(); }}
                            accessibilityRole="button"
                            accessibilityLabel="ลองใหม่"
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <Ionicons name="refresh-outline" size={14} color="#fff" />
                            <Text style={styles.retryButtonText}>ลองใหม่</Text>
                        </TouchableOpacity>
                    ) : canOpenSource ? (
                        <TouchableOpacity
                            style={styles.openSourceButton}
                            onPress={(e) => { e?.stopPropagation?.(); onOpenSource(notification); }}
                            accessibilityRole="button"
                            accessibilityLabel={bucket === 'stock' ? 'ไปดูสินค้านี้ที่หน้าคลัง' : 'ไปดูลูกหนี้รายนี้ที่หน้าค้างชำระ'}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <Text style={styles.openSourceButtonText}>ไปดู</Text>
                            <Ionicons name="chevron-forward" size={13} color={COLORS.primaryDeep} />
                        </TouchableOpacity>
                    ) : null}
                </View>
            </Pressable>
        </Swipeable>
    );
});

function EmptyState({ variant, tabLabel, onAction }) {
    const isInboxEmpty = variant === 'inbox';
    return (
        <View style={styles.emptyState}>
            <Ionicons
                name={isInboxEmpty ? 'notifications-outline' : 'funnel-outline'}
                size={44}
                color={COLORS.border}
            />
            <Text style={styles.emptyTitle}>
                {isInboxEmpty ? 'ยังไม่มีการแจ้งเตือน' : `ไม่มีแจ้งเตือนด้าน${tabLabel}`}
            </Text>
            <Text style={styles.emptySubtitle}>
                {isInboxEmpty
                    ? 'เมื่อมีเรื่องสำคัญของร้าน เราจะแจ้งให้ทราบที่นี่'
                    : 'ลองดูการแจ้งเตือนทั้งหมดของร้านแทน'}
            </Text>
            <TouchableOpacity style={styles.emptyActionBtn} onPress={onAction} accessibilityRole="button">
                <Text style={styles.emptyActionText}>{isInboxEmpty ? 'ตรวจสอบอีกครั้ง' : 'ดูทั้งหมด'}</Text>
            </TouchableOpacity>
        </View>
    );
}

function LoadingSkeleton({ reduceMotion }) {
    const pulse = useSharedValue(reduceMotion ? 0.6 : 0.4);

    useEffect(() => {
        if (reduceMotion) {
            pulse.value = 0.6;
            return;
        }
        pulse.value = withRepeat(
            withSequence(withTiming(1, { duration: 700 }), withTiming(0.4, { duration: 700 })),
            -1,
            true
        );
        return () => cancelAnimation(pulse);
    }, [reduceMotion]);

    const rowStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

    return (
        <View style={styles.skeletonWrap}>
            {[0, 1, 2, 3].map((i) => (
                <Animated.View key={i} style={[styles.skeletonCard, rowStyle]}>
                    <View style={styles.skeletonIcon} />
                    <View style={styles.skeletonLines}>
                        <View style={styles.skeletonLineShort} />
                        <View style={styles.skeletonLineLong} />
                    </View>
                </Animated.View>
            ))}
        </View>
    );
}

// ─────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────

export default function AlertScreen({ navigation }) {
    const [activeTab, setActiveTab] = useState('all');
    const { notifications, setNotifications, isLoading: loading, fetchNotifications, setUnreadCount } = useNotificationStore();
    const [checking, setChecking] = useState(false);
    const [offlineError, setOfflineError] = useState(false);

    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const compact = width < 360;
    const reduceMotion = useReduceMotion();

    // Kept as a ref so the stable (useCallback-memoized) handlers below always
    // read the latest list without needing `notifications` in their deps —
    // that's what lets NotificationCard's React.memo actually skip re-renders
    // for every row except the one that changed.
    const notificationsRef = useRef(notifications);
    useEffect(() => { notificationsRef.current = notifications; }, [notifications]);

    const openRowRef = useRef(null);
    const handleSwipeOpen = useCallback((ref) => {
        if (openRowRef.current && openRowRef.current !== ref) {
            openRowRef.current.close();
        }
        openRowRef.current = ref;
    }, []);

    // Snooze — client-local only (see SNOOZE_STORAGE_KEY comment above).
    const [snoozedMap, setSnoozedMap] = useState({});
    useEffect(() => {
        AsyncStorage.getItem(SNOOZE_STORAGE_KEY)
            .then((raw) => {
                if (!raw) return;
                try { setSnoozedMap(JSON.parse(raw)); } catch (_) { /* corrupt cache, ignore */ }
            })
            .catch(() => {});
    }, []);

    const handleSnooze = useCallback((id) => {
        setSnoozedMap((prev) => {
            const next = { ...prev, [id]: getTomorrowMorning() };
            AsyncStorage.setItem(SNOOZE_STORAGE_KEY, JSON.stringify(next)).catch(() => {});
            return next;
        });
    }, []);

    const handleOpenSource = useCallback((notification) => {
        const bucket = getCategoryBucket(notification.category);
        if (bucket === 'stock') {
            // Just land on the tab — no per-row highlight (StockScreen has no way to
            // clear the param afterwards, so it stayed lit up on every future visit).
            navigation?.navigate('MainTabs', { screen: 'คลัง' });
        } else if (bucket === 'payment') {
            const payload = safeParsePayload(notification);
            const customerId = payload?.customer_id || null;
            navigation?.navigate('MainTabs', { screen: 'ค้างชำระ', params: { highlightCustomerId: customerId } });
        }
    }, [navigation]);

    const handleCheckNotifications = useCallback(async () => {
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
    }, [fetchNotifications]);

    useFocusEffect(
        useCallback(() => {
            fetchNotifications();
        }, [])
    );

    // NOTE: Realtime is handled globally by useRealtimeSync hook (with debounce).
    // No local subscription needed here — avoids double-triggering fetchNotifications.

    const handleBack = useCallback(() => {
        navigation?.goBack();
    }, [navigation]);

    const handleCall = useCallback((phone) => {
        if (phone) Linking.openURL(`tel:${phone}`);
    }, []);

    const handleRetry = useCallback(() => {
        setOfflineError(false);
        fetchNotifications();
    }, [fetchNotifications]);

    const syncUnreadCount = useCallback((updatedNotifications) => {
        setUnreadCount(updatedNotifications.filter((n) => !n.is_read).length);
    }, [setUnreadCount]);

    const markAsRead = useCallback(async (type) => {
        const list = notificationsRef.current;
        const filtered = filterNotifications(list, activeTab);
        const bucket = type === 'today'
            ? filtered.filter((n) => isToday(n.created_at))
            : filtered.filter((n) => !isToday(n.created_at));
        const ids = bucket.filter((n) => !n.is_read).map((n) => n.id);
        if (ids.length === 0) return;

        try {
            const response = await markNotificationsAsRead(ids);
            if (response.success) {
                const updated = list.map((n) => (ids.includes(n.id) ? { ...n, is_read: true } : n));
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
    }, [activeTab, setNotifications, syncUnreadCount]);

    const markAllAsRead = useCallback(async () => {
        const list = notificationsRef.current;
        const ids = list.filter((n) => !n.is_read).map((n) => n.id);
        if (ids.length === 0) return;

        try {
            const response = await markNotificationsAsRead(ids);
            if (response.success) {
                const updated = list.map((n) => (ids.includes(n.id) ? { ...n, is_read: true } : n));
                setNotifications(updated);
                syncUnreadCount(updated);
                setOfflineError(false);
            }
        } catch (error) {
            console.error('Mark all read error:', error);
            setOfflineError(true);
            Alert.alert(
                'ไม่สามารถเชื่อมต่อได้',
                'กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต แล้วลองใหม่อีกครั้ง',
                [
                    { text: 'ตกลง' },
                    { text: 'ลองใหม่', onPress: () => markAllAsRead() },
                ]
            );
        }
    }, [setNotifications, syncUnreadCount]);

    const handleNotificationPress = useCallback(async (id) => {
        try {
            await markNotificationAsRead(id);
            const updated = notificationsRef.current.map((n) => (n.id === id ? { ...n, is_read: true } : n));
            setNotifications(updated);
            syncUnreadCount(updated);
        } catch (error) {
            console.error('Mark read error:', error);
        }
    }, [setNotifications, syncUnreadCount]);

    const handleDelete = useCallback(async (id) => {
        try {
            const response = await deleteNotification(id);
            if (response.success) {
                const updated = notificationsRef.current.filter((n) => n.id !== id);
                setNotifications(updated);
                syncUnreadCount(updated);
            }
        } catch (error) {
            console.error('Delete error:', error);
        }
    }, [setNotifications, syncUnreadCount]);

    // Snoozed items are hidden from the inbox until their snooze window passes —
    // everything below (counts, filters, sections) works off this, not the raw
    // store list, so a snoozed item doesn't still count toward "unread".
    const visibleNotifications = useMemo(() => {
        if (Object.keys(snoozedMap).length === 0) return notifications;
        const now = Date.now();
        return notifications.filter((n) => {
            const until = snoozedMap[n.id];
            return !until || new Date(until).getTime() <= now;
        });
    }, [notifications, snoozedMap]);

    // Single pass over the visible inbox for every count the header/summary/filter
    // bar need, instead of each of them re-scanning the array on its own.
    const counts = useMemo(() => {
        let unreadTotal = 0;
        let importantCount = 0;
        const tabUnread = { all: 0, payment: 0, stock: 0 };
        for (const n of visibleNotifications) {
            if (!n.is_read) {
                unreadTotal++;
                tabUnread.all++;
                const bucket = getCategoryBucket(n.category);
                if (bucket === 'payment') tabUnread.payment++;
                else if (bucket === 'stock') tabUnread.stock++;
                if (IMPORTANT_TYPES.includes(n.type)) importantCount++;
            }
        }
        return { unreadTotal, importantCount, tabUnread };
    }, [visibleNotifications]);

    const filteredNotifications = useMemo(
        () => filterNotifications(visibleNotifications, activeTab),
        [visibleNotifications, activeTab]
    );
    const todayNotifications = useMemo(
        () => sortByPriorityThenRecency(filteredNotifications.filter((n) => isToday(n.created_at))),
        [filteredNotifications]
    );
    const earlierNotifications = useMemo(
        () => sortByPriorityThenRecency(filteredNotifications.filter((n) => !isToday(n.created_at))),
        [filteredNotifications]
    );

    const sections = useMemo(() => {
        const result = [];
        if (todayNotifications.length > 0) {
            result.push({ key: 'today', title: 'วันนี้', data: todayNotifications });
        }
        if (earlierNotifications.length > 0) {
            result.push({ key: 'earlier', title: 'ก่อนหน้านี้', data: earlierNotifications });
        }
        return result;
    }, [todayNotifications, earlierNotifications]);

    const activeTabLabel = TABS.find((t) => t.id === activeTab)?.label || '';
    const emptyVariant = visibleNotifications.length === 0 ? 'inbox' : (filteredNotifications.length === 0 ? 'filtered' : null);

    const renderItem = useCallback(({ item }) => (
        <NotificationCard
            notification={item}
            onPress={handleNotificationPress}
            onDelete={handleDelete}
            onCall={handleCall}
            onRetry={handleRetry}
            onSwipeOpen={handleSwipeOpen}
            onSnooze={handleSnooze}
            onOpenSource={handleOpenSource}
        />
    ), [handleNotificationPress, handleDelete, handleCall, handleRetry, handleSwipeOpen, handleSnooze, handleOpenSource]);

    const renderSectionHeader = useCallback(({ section }) => (
        <NotificationSectionHeader section={section} onMarkAll={markAsRead} />
    ), [markAsRead]);

    // Category switch crossfade — skipped outright when Reduce Motion is on.
    const contentOpacity = useSharedValue(1);
    useEffect(() => {
        if (reduceMotion) {
            contentOpacity.value = 1;
            return;
        }
        contentOpacity.value = 0;
        contentOpacity.value = withTiming(1, { duration: 180 });
        return () => cancelAnimation(contentOpacity);
    }, [activeTab, reduceMotion]);
    const contentAnimStyle = useAnimatedStyle(() => ({ opacity: contentOpacity.value }));

    const showSkeleton = loading && notifications.length === 0;
    const showRefreshSpinner = loading && notifications.length > 0;

    return (
        <View style={styles.container}>
            <AlertHeader
                onBack={handleBack}
                checking={checking}
                onRefresh={handleCheckNotifications}
                unreadCount={counts.unreadTotal}
                insetsTop={insets.top}
            />

            {offlineError && <OfflineBanner onRetry={handleRetry} />}

            <InboxSummary
                unreadCount={counts.unreadTotal}
                totalCount={visibleNotifications.length}
                importantCount={counts.importantCount}
                onMarkAllRead={markAllAsRead}
            />

            <CategoryFilterBar
                activeTab={activeTab}
                onChange={setActiveTab}
                tabCounts={counts.tabUnread}
                compact={compact}
            />

            {showSkeleton ? (
                <LoadingSkeleton reduceMotion={reduceMotion} />
            ) : (
                <Animated.View style={[{ flex: 1 }, contentAnimStyle]}>
                    <SectionList
                        sections={sections}
                        keyExtractor={(item) => item.id}
                        renderItem={renderItem}
                        renderSectionHeader={renderSectionHeader}
                        stickySectionHeadersEnabled={false}
                        contentContainerStyle={[
                            styles.listContent,
                            sections.length === 0 && styles.listContentEmpty,
                            { paddingBottom: Math.max(24, insets.bottom + 24) },
                        ]}
                        ListEmptyComponent={
                            emptyVariant ? (
                                <EmptyState
                                    variant={emptyVariant}
                                    tabLabel={activeTabLabel}
                                    onAction={emptyVariant === 'inbox' ? handleCheckNotifications : () => setActiveTab('all')}
                                />
                            ) : null
                        }
                        refreshControl={
                            <RefreshControl
                                refreshing={showRefreshSpinner}
                                onRefresh={handleCheckNotifications}
                                colors={[COLORS.primary]}
                                tintColor={COLORS.primary}
                            />
                        }
                        initialNumToRender={8}
                        windowSize={7}
                        removeClippedSubviews={Platform.OS === 'android'}
                        showsVerticalScrollIndicator={false}
                    />
                </Animated.View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.bg,
    },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingBottom: 12,
        backgroundColor: COLORS.surface,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
        gap: 8,
    },
    headerIconBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitleWrap: {
        flex: 1,
        flexShrink: 1,
        minWidth: 0,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    headerSubtitle: {
        fontSize: 12.5,
        color: COLORS.textSecondary,
        marginTop: 1,
    },

    // Offline banner
    offlineBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.danger,
        paddingVertical: 10,
        paddingHorizontal: 16,
        gap: 8,
    },
    offlineBannerText: {
        flex: 1,
        flexShrink: 1,
        minWidth: 0,
        color: '#fff',
        fontSize: 13,
        fontWeight: '500',
        lineHeight: 18,
    },
    offlineRetryBtn: {
        paddingVertical: 4,
        paddingHorizontal: 4,
    },
    offlineBannerRetry: {
        color: '#fff',
        fontSize: 13,
        fontWeight: 'bold',
        textDecorationLine: 'underline',
    },

    // Inbox summary
    summaryCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: COLORS.surface,
        marginHorizontal: 14,
        marginTop: 12,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
        gap: 10,
    },
    summaryStatsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexShrink: 1,
    },
    summaryStat: {
        alignItems: 'flex-start',
    },
    summaryStatValue: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    summaryStatLabel: {
        fontSize: 11.5,
        color: COLORS.textSecondary,
        marginTop: 1,
    },
    summaryDivider: {
        width: 1,
        height: 26,
        backgroundColor: COLORS.border,
        marginHorizontal: 14,
    },
    summaryActionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 12,
        backgroundColor: '#FFF3EB',
    },
    summaryActionText: {
        color: COLORS.primary,
        fontSize: 13,
        fontWeight: '700',
    },
    summaryDoneBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    summaryDoneText: {
        color: COLORS.success,
        fontSize: 13,
        fontWeight: '600',
    },

    // Category filter
    filterBar: {
        flexDirection: 'row',
        marginHorizontal: 14,
        marginTop: 10,
        gap: 8,
    },
    filterTab: {
        flex: 1,
        minHeight: 44,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        paddingHorizontal: 6,
        borderRadius: 14,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
        gap: 3,
    },
    filterTabActive: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    filterTabPressed: {
        backgroundColor: '#F3F1EC',
    },
    filterTabIconRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    filterTabText: {
        fontSize: 13,
        fontWeight: '600',
        color: COLORS.textSecondary,
    },
    filterTabTextCompact: {
        fontSize: 11.5,
    },
    filterTabTextActive: {
        color: '#fff',
    },
    filterBadge: {
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        paddingHorizontal: 4,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    filterBadgeActive: {
        backgroundColor: '#fff',
    },
    filterBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#fff',
    },
    filterBadgeTextActive: {
        color: COLORS.primary,
    },

    // List
    listContent: {
        paddingHorizontal: 14,
        paddingTop: 12,
    },
    listContentEmpty: {
        flexGrow: 1,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: COLORS.bg,
        paddingVertical: 6,
        marginTop: 6,
    },
    sectionHeaderLeft: {
        flexShrink: 1,
        minWidth: 0,
    },
    sectionTitle: {
        fontSize: 13,
        color: COLORS.textPrimary,
        fontWeight: '700',
    },
    sectionMeta: {
        fontSize: 11.5,
        color: COLORS.textSecondary,
        marginTop: 1,
    },
    readAllText: {
        color: COLORS.primary,
        fontSize: 13,
        fontWeight: '700',
    },

    // Notification card
    card: {
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        borderWidth: 1,
        padding: 14,
        marginBottom: 10,
        gap: 8,
    },
    cardUnread: {
        borderColor: '#FBD9C0',
        backgroundColor: '#FFFAF6',
        // No shadow/elevation here on purpose — `elevation` forces Android to give
        // every unread card its own offscreen compositing layer. With several
        // unread cards on screen at once (the common case) that's several extra
        // GPU render targets to re-blend on every scroll frame and on every
        // crossfade — exactly what stutters on older Android GPUs. Border +
        // background tint carry the same "unread" signal for near-zero cost.
    },
    cardRead: {
        borderColor: COLORS.border,
        backgroundColor: COLORS.surface,
    },
    cardPressed: {
        backgroundColor: '#F5F3EF',
    },
    cardTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    cardIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    cardTitleWrap: {
        flex: 1,
        flexShrink: 1,
        minWidth: 0,
    },
    cardTitle: {
        fontSize: 15.5,
        fontWeight: '500',
        color: COLORS.textPrimary,
    },
    cardTitleUnread: {
        fontWeight: '700',
    },
    cardTime: {
        fontSize: 11.5,
        color: COLORS.textSecondary,
        flexShrink: 0,
        marginLeft: 4,
    },
    cardMessage: {
        fontSize: 13.5,
        lineHeight: 19,
        color: COLORS.textPrimary,
    },
    cardMessageRead: {
        color: COLORS.textSecondary,
    },
    cardFooterRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 8,
    },
    cardChipsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flexShrink: 1,
    },
    chip: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
    },
    chipText: {
        fontSize: 11.5,
        fontWeight: '600',
    },
    newChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 999,
        backgroundColor: '#FFF0E6',
    },
    newDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: COLORS.primary,
    },
    newChipText: {
        fontSize: 11,
        fontWeight: '700',
        color: COLORS.primaryDeep,
    },
    callButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: COLORS.success,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        minHeight: 30,
    },
    callButtonText: {
        color: '#fff',
        fontSize: 12.5,
        fontWeight: '700',
    },
    retryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: COLORS.stock,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        minHeight: 30,
    },
    retryButtonText: {
        color: '#fff',
        fontSize: 12.5,
        fontWeight: '700',
    },
    openSourceButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 999,
        minHeight: 30,
        backgroundColor: '#FFF0E6',
    },
    openSourceButtonText: {
        color: COLORS.primaryDeep,
        fontSize: 12.5,
        fontWeight: '700',
    },

    // Swipe delete / snooze
    deleteAction: {
        backgroundColor: '#E2544B',
        justifyContent: 'center',
        alignItems: 'center',
        width: 72,
        borderRadius: 14,
        marginLeft: 8,
        marginBottom: 10,
        gap: 3,
    },
    deleteText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 12,
    },
    snoozeAction: {
        backgroundColor: '#64748B',
        justifyContent: 'center',
        alignItems: 'center',
        width: 72,
        borderRadius: 14,
        marginRight: 8,
        marginBottom: 10,
        gap: 3,
    },
    snoozeText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 12,
    },

    // Empty state
    emptyState: {
        alignItems: 'center',
        paddingVertical: 44,
        paddingHorizontal: 24,
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.textPrimary,
        marginTop: 14,
        textAlign: 'center',
    },
    emptySubtitle: {
        fontSize: 13.5,
        color: COLORS.textSecondary,
        marginTop: 6,
        textAlign: 'center',
        lineHeight: 19,
    },
    emptyActionBtn: {
        marginTop: 16,
        paddingHorizontal: 18,
        paddingVertical: 10,
        borderRadius: 14,
        backgroundColor: COLORS.primary,
    },
    emptyActionText: {
        color: '#fff',
        fontSize: 13.5,
        fontWeight: '700',
    },

    // Loading skeleton
    skeletonWrap: {
        paddingHorizontal: 14,
        paddingTop: 12,
        gap: 10,
    },
    skeletonCard: {
        flexDirection: 'row',
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
        padding: 14,
        gap: 12,
    },
    skeletonIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#EDE8E1',
    },
    skeletonLines: {
        flex: 1,
        gap: 8,
        justifyContent: 'center',
    },
    skeletonLineShort: {
        width: '40%',
        height: 12,
        borderRadius: 6,
        backgroundColor: '#EDE8E1',
    },
    skeletonLineLong: {
        width: '85%',
        height: 12,
        borderRadius: 6,
        backgroundColor: '#EDE8E1',
    },
});
