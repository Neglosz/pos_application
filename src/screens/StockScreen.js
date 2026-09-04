import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Pressable,
    Image,
    TextInput,
    ScrollView,
    SectionList,
    RefreshControl,
    ActivityIndicator,
    AccessibilityInfo,
    useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withRepeat,
    withSequence,
    cancelAnimation,
} from 'react-native-reanimated';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { getStockStats, getNearExpiryItems, getLowStockItems, getExpiredItems, getOutOfStockItems, checkStockNotifications } from '../services/api';

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
    outOfStock: '#455A64',
    lowStock: '#E65100',
};

// One entry per issue category, in priority order (also the Issue Feed section
// order and the filter bar order). `key` matches the state field name for that
// list so the rest of the screen can stay data-driven instead of switching on
// string literals everywhere.
const STATUS_TYPES = [
    {
        id: 'expired',
        listKey: 'expiredItems',
        statKey: 'expired',
        label: 'หมดอายุ',
        icon: 'warning-outline',
        color: COLORS.danger,
        bg: '#FCE9E9',
        sectionTitle: 'หมดอายุ',
        sectionDesc: 'ต้องจัดการทันที',
        emptyLabel: 'ไม่มีสินค้าหมดอายุ',
    },
    {
        id: 'outOfStock',
        listKey: 'outOfStockItems',
        statKey: 'outOfStock',
        label: 'ของหมด',
        icon: 'cube-outline',
        color: COLORS.outOfStock,
        bg: '#E7EBED',
        sectionTitle: 'หมดสต็อก',
        sectionDesc: 'ควรเติมสินค้า',
        emptyLabel: 'ไม่มีสินค้าของหมด',
    },
    {
        id: 'nearExpiry',
        listKey: 'nearExpiryItems',
        statKey: 'nearExpiry',
        label: 'ใกล้หมดอายุ',
        icon: 'time-outline',
        color: COLORS.warning,
        bg: '#FFF3DE',
        sectionTitle: 'ใกล้หมดอายุ',
        sectionDesc: 'ควรวางแผนระบาย (ภายใน 30 วัน)',
        emptyLabel: 'ไม่มีสินค้าใกล้หมดอายุ',
    },
    {
        id: 'lowStock',
        listKey: 'lowStockItems',
        statKey: 'lowStock',
        label: 'สต็อกต่ำ',
        icon: 'trending-down-outline',
        color: COLORS.lowStock,
        bg: '#FFF0DD',
        sectionTitle: 'สต็อกต่ำ',
        sectionDesc: 'ควรเติมเร็ว ๆ นี้',
        emptyLabel: 'ไม่มีสินค้าสต็อกต่ำ',
    },
];

const FILTERS = [
    { id: 'all', label: 'ทั้งหมด', icon: 'apps-outline', color: COLORS.primary },
    ...STATUS_TYPES.map((s) => ({ id: s.id, label: s.label, icon: s.icon, color: s.color })),
];

const STATUS_BY_ID = Object.fromEntries(STATUS_TYPES.map((s) => [s.id, s]));

// Same "days until expiry" copy the original screen used — hardened against a
// missing/malformed date so a bad row from the API can't crash this screen.
const formatExpireDate = (dateStr) => {
    if (!dateStr || typeof dateStr !== 'string') return 'ไม่ระบุ';
    const [year, month, day] = dateStr.split('T')[0].split('-');
    const date = new Date(Number(year), Number(month) - 1, Number(day), 0, 0, 0);
    if (Number.isNaN(date.getTime())) return 'ไม่ระบุ';

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.round((date - today) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'หมดอายุแล้ว';
    if (diffDays === 0) return 'วันนี้';
    if (diffDays === 1) return 'พรุ่งนี้';
    if (diffDays <= 7) return `อีก ${diffDays} วัน`;
    return date.toLocaleDateString('th-TH-u-ca-buddhist', { day: 'numeric', month: 'short' });
};

// Images are stored as full Supabase URLs already — kept as its own function
// (rather than inlined) since that's the one seam the API could change later.
const getImageUri = (imagePath) => imagePath || null;

const matchesSearch = (item, query) => {
    if (!query) return true;
    const name = String(item?.name || '').toLowerCase();
    if (name.includes(query)) return true;
    // Only ever matches if the API actually sends a barcode field — no field is
    // invented here, this just doesn't skip it if a future response has one.
    const barcode = item?.barcode ? String(item.barcode).toLowerCase() : '';
    return barcode.includes(query);
};

function useReduceMotion() {
    const [reduced, setReduced] = useState(false);
    useEffect(() => {
        let mounted = true;
        AccessibilityInfo.isReduceMotionEnabled?.()
            .then((v) => { if (mounted) setReduced(!!v); })
            .catch(() => {});
        const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v) => setReduced(!!v));
        return () => { mounted = false; sub?.remove?.(); };
    }, []);
    return reduced;
}

// ─────────────────────────────────────────────────────────────────────────
// Presentational pieces
// ─────────────────────────────────────────────────────────────────────────

// Single-line, no dashboard talk: "คลังสินค้า · 128 รายการ" plus refresh and
// scan as plain icon buttons — this is the entire top identity of the screen,
// on purpose, so it never competes with the product list for space.
function StockHeader({ total, refreshing, onRefresh, onScan }) {
    return (
        <View style={styles.header}>
            <Text style={styles.headerTitle} numberOfLines={1}>
                คลังสินค้า <Text style={styles.headerCount}>· {total.toLocaleString()} รายการ</Text>
            </Text>
            <View style={styles.headerActions}>
                <TouchableOpacity
                    style={styles.headerIconBtn}
                    onPress={onRefresh}
                    disabled={refreshing}
                    accessibilityRole="button"
                    accessibilityLabel={refreshing ? 'กำลังโหลดข้อมูลคลังสินค้า' : 'โหลดข้อมูลคลังสินค้าใหม่'}
                    accessibilityState={{ busy: refreshing }}
                >
                    {refreshing ? (
                        <ActivityIndicator size="small" color={COLORS.primary} />
                    ) : (
                        <Ionicons name="refresh" size={21} color={COLORS.primary} />
                    )}
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.headerIconBtn, styles.headerScanBtn]}
                    onPress={onScan}
                    accessibilityRole="button"
                    accessibilityLabel="สแกนเพิ่มสินค้า"
                >
                    <Ionicons name="scan-outline" size={21} color="#fff" />
                </TouchableOpacity>
            </View>
        </View>
    );
}

function ErrorBanner({ onRetry }) {
    return (
        <View style={styles.errorBanner}>
            <Ionicons name="cloud-offline-outline" size={18} color="#fff" />
            <Text style={styles.errorBannerText}>โหลดข้อมูลบางส่วนไม่สำเร็จ ข้อมูลที่เห็นอาจไม่ล่าสุด</Text>
            <TouchableOpacity
                onPress={onRetry}
                accessibilityRole="button"
                accessibilityLabel="ลองโหลดข้อมูลคลังสินค้าใหม่"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
                <Text style={styles.errorBannerRetry}>ลองใหม่</Text>
            </TouchableOpacity>
        </View>
    );
}

// This one row *is* the summary — no separate hero/dashboard grid. Each chip
// is simultaneously "how many" (the count) and "show me only these" (the
// filter), so there's exactly one place on screen that says "3 หมดอายุ",
// not two. A zero count reads as neutral gray on purpose — it's not something
// to look at — while a nonzero urgent status keeps its real color.
function StockStatusFilters({ activeFilter, onChange, counts, compact }) {
    return (
        <View style={styles.filterBarWrap} accessibilityRole="tablist">
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterBar}
            >
                {FILTERS.map((f) => {
                    const isActive = activeFilter === f.id;
                    const count = counts[f.id] || 0;
                    // "all" always stays meaningfully colored — it's never a "0 problem"
                    // status. The 4 real statuses go neutral gray at 0 so an empty
                    // category doesn't visually compete with the ones that need attention.
                    const isZero = f.id !== 'all' && count === 0;
                    const accentColor = isZero ? COLORS.textSecondary : f.color;
                    return (
                        <Pressable
                            key={f.id}
                            onPress={() => onChange(f.id)}
                            style={({ pressed }) => [
                                styles.filterChip,
                                isActive && { backgroundColor: accentColor, borderColor: accentColor },
                                pressed && !isActive && styles.filterChipPressed,
                            ]}
                            accessibilityRole="tab"
                            accessibilityState={{ selected: isActive }}
                            accessibilityLabel={`${f.label}, ${count} รายการ`}
                        >
                            <Ionicons name={f.icon} size={compact ? 13 : 14} color={isActive ? '#fff' : accentColor} />
                            <Text style={[styles.filterChipCount, { color: isActive ? '#fff' : accentColor }]}>
                                {count > 99 ? '99+' : count}
                            </Text>
                            <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive, compact && styles.filterChipTextCompact]}>
                                {f.label}
                            </Text>
                        </Pressable>
                    );
                })}
            </ScrollView>
        </View>
    );
}

function StockSearchBar({ value, onChange }) {
    return (
        <View style={styles.searchBar}>
            <Ionicons name="search" size={17} color={COLORS.textSecondary} />
            <TextInput
                style={styles.searchInput}
                placeholder="ค้นหาสินค้า"
                placeholderTextColor={COLORS.textSecondary}
                value={value}
                onChangeText={onChange}
                returnKeyType="search"
            />
            {value.length > 0 && (
                <TouchableOpacity
                    onPress={() => onChange('')}
                    accessibilityRole="button"
                    accessibilityLabel="ล้างคำค้นหา"
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    <Ionicons name="close-circle" size={18} color={COLORS.textSecondary} />
                </TouchableOpacity>
            )}
        </View>
    );
}

function StockSectionHeader({ section }) {
    const status = STATUS_BY_ID[section.statusId];
    return (
        <View style={styles.sectionHeader}>
            <View style={[styles.sectionDot, { backgroundColor: status.color }]} />
            <View style={styles.sectionHeaderTextWrap}>
                <Text style={styles.sectionTitle}>{status.sectionTitle}</Text>
                <Text style={styles.sectionDesc}>{status.sectionDesc}</Text>
            </View>
            <Text style={[styles.sectionCount, { color: status.color }]}>{section.data.length}</Text>
        </View>
    );
}

const StockIssueCard = React.memo(function StockIssueCard({ item, statusId }) {
    const status = STATUS_BY_ID[statusId];
    const [imageFailed, setImageFailed] = useState(false);
    const showImage = !!item.image && !imageFailed;
    const unit = item.unit || 'ชิ้น';

    return (
        <View style={styles.card}>
            <View style={styles.cardMainRow}>
                {showImage ? (
                    <Image
                        source={{ uri: getImageUri(item.image) }}
                        style={styles.cardImage}
                        resizeMode="cover"
                        onError={() => setImageFailed(true)}
                        accessible={false}
                    />
                ) : (
                    <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
                        <Ionicons name="cube-outline" size={22} color={COLORS.textSecondary} />
                    </View>
                )}

                <View style={styles.cardTextWrap}>
                    <Text style={styles.cardTitle} numberOfLines={2}>{item.name || 'ไม่ระบุชื่อสินค้า'}</Text>

                    {statusId === 'expired' && (
                        <View style={styles.cardMetaRow}>
                            <View style={[styles.cardTag, { backgroundColor: status.bg }]}>
                                <Text style={[styles.cardTagText, { color: status.color }]}>หมดอายุแล้ว</Text>
                            </View>
                            {!!item.expireDate && (
                                <Text style={styles.cardMetaText}>{formatExpireDate(item.expireDate)}</Text>
                            )}
                            <Text style={styles.cardMetaText}>{item.quantity ?? 0} {unit}</Text>
                        </View>
                    )}

                    {statusId === 'outOfStock' && (
                        <View style={styles.cardMetaRow}>
                            <View style={[styles.cardTag, { backgroundColor: status.bg }]}>
                                <Text style={[styles.cardTagText, { color: status.color }]}>คงเหลือ 0</Text>
                            </View>
                        </View>
                    )}

                    {statusId === 'nearExpiry' && (() => {
                        const expiry = formatExpireDate(item.expireDate);
                        return (
                            <View style={styles.cardMetaRow}>
                                <View style={[styles.cardTag, { backgroundColor: status.bg }]}>
                                    <Text style={[styles.cardTagText, { color: status.color }]}>
                                        {expiry === 'หมดอายุแล้ว' ? expiry : `หมดอายุ ${expiry}`}
                                    </Text>
                                </View>
                                <Text style={styles.cardMetaText}>{item.quantity ?? 0} {unit}</Text>
                            </View>
                        );
                    })()}

                    {statusId === 'lowStock' && (
                        <View style={styles.cardMetaRow}>
                            <View style={[styles.cardTag, { backgroundColor: status.bg }]}>
                                <Text style={[styles.cardTagText, { color: status.color }]}>เหลือ {item.quantity ?? 0} {unit}</Text>
                            </View>
                            {!!item.price && (
                                <Text style={styles.cardMetaText}>฿{item.price} / {unit}</Text>
                            )}
                        </View>
                    )}
                </View>
            </View>
        </View>
    );
});

function StockEmptyState({ variant, filterLabel, searchQuery, onScan, onShowAll, onClearSearch }) {
    if (variant === 'inbox') {
        return (
            <View style={styles.emptyState}>
                <Ionicons name="storefront-outline" size={48} color={COLORS.border} />
                <Text style={styles.emptyTitle}>คลังสินค้ายังว่าง</Text>
                <Text style={styles.emptySubtitle}>สแกนบาร์โค้ดสินค้าเพื่อเพิ่มเข้าคลัง แนะนำเริ่มจากสินค้าที่ขายประจำ</Text>
                <TouchableOpacity
                    style={styles.emptyActionBtn}
                    onPress={onScan}
                    accessibilityRole="button"
                    accessibilityLabel="สแกนสินค้าชิ้นแรกเข้าคลัง"
                >
                    <Ionicons name="add" size={18} color="#fff" />
                    <Text style={styles.emptyActionText}>สแกนสินค้าชิ้นแรก</Text>
                </TouchableOpacity>
            </View>
        );
    }

    if (variant === 'search') {
        return (
            <View style={styles.emptyState}>
                <Ionicons name="search-outline" size={44} color={COLORS.border} />
                <Text style={styles.emptyTitle}>ไม่พบ "{searchQuery}"</Text>
                <Text style={styles.emptySubtitle}>ลองค้นด้วยชื่ออื่น หรือล้างคำค้นหาเพื่อดูรายการทั้งหมด</Text>
                <TouchableOpacity style={styles.emptyActionBtn} onPress={onClearSearch} accessibilityRole="button">
                    <Text style={styles.emptyActionText}>ล้างคำค้นหา</Text>
                </TouchableOpacity>
            </View>
        );
    }

    if (variant === 'healthy') {
        return (
            <View style={styles.emptyState}>
                <Ionicons name="checkmark-circle-outline" size={44} color={COLORS.success} />
                <Text style={styles.emptyTitle}>คลังอยู่ในสถานะปกติ</Text>
                <Text style={styles.emptySubtitle}>ไม่มีสินค้าที่ต้องรีบจัดการตอนนี้</Text>
            </View>
        );
    }

    // 'filtered' — a specific status filter has zero items
    return (
        <View style={styles.emptyState}>
            <Ionicons name="checkmark-circle-outline" size={44} color={COLORS.success} />
            <Text style={styles.emptyTitle}>{filterLabel}</Text>
            <Text style={styles.emptySubtitle}>ลองดูการแจ้งเตือนสต็อกทั้งหมดของร้านแทน</Text>
            <TouchableOpacity style={styles.emptyActionBtn} onPress={onShowAll} accessibilityRole="button">
                <Text style={styles.emptyActionText}>ดูทั้งหมด</Text>
            </TouchableOpacity>
        </View>
    );
}

function StockLoadingSkeleton({ reduceMotion }) {
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
            <Animated.View style={[styles.skeletonFilterBar, rowStyle]} />
            {[0, 1, 2, 3].map((i) => (
                <Animated.View key={i} style={[styles.skeletonCard, rowStyle]}>
                    <View style={styles.skeletonImage} />
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

export default function StockScreen() {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const compact = width < 360;
    const reduceMotion = useReduceMotion();

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadError, setLoadError] = useState(false);
    const [activeFilter, setActiveFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');

    const [stats, setStats] = useState({ total: 0, nearExpiry: 0, lowStock: 0, expired: 0, outOfStock: 0 });
    const [nearExpiryItems, setNearExpiryItems] = useState([]);
    const [lowStockItems, setLowStockItems] = useState([]);
    const [expiredItems, setExpiredItems] = useState([]);
    const [outOfStockItems, setOutOfStockItems] = useState([]);

    const listsByKey = { nearExpiryItems, lowStockItems, expiredItems, outOfStockItems };

    // Guards every setState below against firing after this screen has unmounted
    // (e.g. the user navigates away while loadData()'s Promise.all is still out).
    const isMountedRef = useRef(true);
    useEffect(() => () => { isMountedRef.current = false; }, []);

    const loadData = useCallback(async () => {
        try {
            // Check and generate stock notifications in background — fire-and-forget,
            // same as before: this must never gate the list fetch below on its result.
            checkStockNotifications().catch((err) => console.log('Background notification check:', err));

            const [statsRes, expiryRes, lowStockRes, expiredRes, outOfStockRes] = await Promise.all([
                getStockStats(),
                getNearExpiryItems(),
                getLowStockItems(),
                getExpiredItems(),
                getOutOfStockItems(),
            ]);

            if (!isMountedRef.current) return;

            if (statsRes.success) setStats(statsRes.data);
            if (expiryRes.success) setNearExpiryItems(expiryRes.data);
            if (lowStockRes.success) setLowStockItems(lowStockRes.data);
            if (expiredRes.success) setExpiredItems(expiredRes.data);
            if (outOfStockRes.success) setOutOfStockItems(outOfStockRes.data);
            setLoadError(false);
        } catch (error) {
            console.error('Error loading stock data:', error);
            // Deliberately does not clear stats/items — whatever loaded on a
            // previous successful run stays on screen instead of blanking out.
            if (isMountedRef.current) setLoadError(true);
        } finally {
            if (isMountedRef.current) {
                setLoading(false);
                setRefreshing(false);
            }
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [loadData])
    );

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        loadData();
    }, [loadData]);

    const goToScan = useCallback(() => navigation.navigate('StockScan'), [navigation]);

    const normalizedQuery = searchQuery.trim().toLowerCase();

    // One search pass per list, memoized — feeds both the filter-bar counts
    // (post-search, so counts always match what's actually on screen) and the
    // SectionList's sections.
    const searchedByStatus = useMemo(() => {
        const result = {};
        for (const status of STATUS_TYPES) {
            const list = listsByKey[status.listKey] || [];
            result[status.id] = normalizedQuery ? list.filter((item) => matchesSearch(item, normalizedQuery)) : list;
        }
        return result;
    }, [nearExpiryItems, lowStockItems, expiredItems, outOfStockItems, normalizedQuery]);

    // With no active search, counts come straight from getStockStats() — the same
    // source the original dashboard grid displayed — instead of the length of the
    // separately-fetched list endpoints, which is only guaranteed to agree with a
    // search query applied on top of it.
    const filterCounts = useMemo(() => {
        const counts = { all: 0 };
        for (const status of STATUS_TYPES) {
            const n = normalizedQuery ? searchedByStatus[status.id].length : (stats[status.statKey] || 0);
            counts[status.id] = n;
            counts.all += n;
        }
        return counts;
    }, [searchedByStatus, stats, normalizedQuery]);

    const visibleStatusTypes = activeFilter === 'all' ? STATUS_TYPES : STATUS_TYPES.filter((s) => s.id === activeFilter);

    const sections = useMemo(() => {
        return visibleStatusTypes
            .map((status) => ({
                key: status.id,
                statusId: status.id,
                title: status.sectionTitle,
                data: searchedByStatus[status.id],
                // SectionList looks at a section's own keyExtractor before falling back
                // to the list-level one — this is what actually gives `${sectionType}-${id}`
                // keys (a plain list-level keyExtractor only ever sees (item, index), no
                // section), which matters here since the same product id can legitimately
                // appear in more than one section (e.g. both near-expiry and low-stock).
                keyExtractor: (item, index) => `${status.id}-${item?.id ?? index}`,
            }))
            .filter((section) => section.data.length > 0);
    }, [visibleStatusTypes, searchedByStatus]);

    const renderItem = useCallback(({ item, section }) => (
        <StockIssueCard item={item} statusId={section.statusId} />
    ), []);

    const renderSectionHeader = useCallback(({ section }) => (
        <StockSectionHeader section={section} />
    ), []);

    const isStoreEmpty = stats.total === 0;
    const emptyVariant = isStoreEmpty
        ? 'inbox'
        : sections.length > 0
            ? null
            : normalizedQuery
                ? 'search'
                : activeFilter === 'all'
                    ? 'healthy'
                    : 'filtered';

    const activeFilterLabel = STATUS_BY_ID[activeFilter]?.emptyLabel || '';

    if (loading) {
        return (
            <View style={styles.container}>
                <StockHeader total={0} refreshing onRefresh={() => {}} onScan={goToScan} />
                <StockLoadingSkeleton reduceMotion={reduceMotion} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StockHeader total={stats.total} refreshing={refreshing} onRefresh={onRefresh} onScan={goToScan} />

            {loadError && <ErrorBanner onRetry={loadData} />}

            {isStoreEmpty ? (
                <View style={styles.emptyWrap}>
                    <StockEmptyState variant="inbox" onScan={goToScan} />
                </View>
            ) : (
                <>
                    {/* This chip row IS the summary — no separate hero/dashboard card above
                        it. Everything fixed on screen is now header + this row + search,
                        so the product list is what actually fills the viewport. */}
                    <StockStatusFilters activeFilter={activeFilter} onChange={setActiveFilter} counts={filterCounts} compact={compact} />
                    <StockSearchBar value={searchQuery} onChange={setSearchQuery} />

                    <SectionList
                        sections={sections}
                        keyExtractor={(item, index) => `fallback-${item?.id ?? index}`}
                        renderItem={renderItem}
                        renderSectionHeader={renderSectionHeader}
                        stickySectionHeadersEnabled={false}
                        contentContainerStyle={[
                            styles.listContent,
                            sections.length === 0 && styles.listContentEmpty,
                            { paddingBottom: Math.max(24, insets.bottom + 16) },
                        ]}
                        ListEmptyComponent={
                            emptyVariant && emptyVariant !== 'inbox' ? (
                                <StockEmptyState
                                    variant={emptyVariant}
                                    filterLabel={activeFilterLabel}
                                    searchQuery={searchQuery}
                                    onShowAll={() => setActiveFilter('all')}
                                    onClearSearch={() => setSearchQuery('')}
                                />
                            ) : null
                        }
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} tintColor={COLORS.primary} />
                        }
                        initialNumToRender={8}
                        maxToRenderPerBatch={8}
                        windowSize={7}
                        showsVerticalScrollIndicator={false}
                    />
                </>
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
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 8,
        gap: 8,
    },
    headerTitle: {
        flex: 1,
        flexShrink: 1,
        minWidth: 0,
        fontSize: 19,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    headerCount: {
        fontSize: 13.5,
        fontWeight: '400',
        color: COLORS.textSecondary,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    headerIconBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerScanBtn: {
        backgroundColor: COLORS.primary,
    },

    // Error banner
    errorBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.danger,
        marginHorizontal: 14,
        marginBottom: 10,
        paddingVertical: 9,
        paddingHorizontal: 14,
        borderRadius: 12,
        gap: 8,
    },
    errorBannerText: {
        flex: 1,
        flexShrink: 1,
        minWidth: 0,
        color: '#fff',
        fontSize: 12.5,
        lineHeight: 17,
    },
    errorBannerRetry: {
        color: '#fff',
        fontSize: 12.5,
        fontWeight: '700',
        textDecorationLine: 'underline',
    },

    // Filter bar
    filterBarWrap: {
        marginBottom: 10,
    },
    filterBar: {
        flexDirection: 'row',
        paddingHorizontal: 14,
        gap: 8,
    },
    filterChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        minHeight: 44,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    filterChipPressed: {
        backgroundColor: '#F3F1EC',
    },
    filterChipText: {
        fontSize: 12.5,
        fontWeight: '600',
        color: COLORS.textPrimary,
    },
    filterChipTextCompact: {
        fontSize: 11.5,
    },
    filterChipTextActive: {
        color: '#fff',
    },
    filterChipCount: {
        fontSize: 13,
        fontWeight: '800',
    },

    // Search
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: COLORS.surface,
        marginHorizontal: 14,
        marginBottom: 10,
        paddingHorizontal: 12,
        height: 44,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    searchInput: {
        flex: 1,
        fontSize: 13.5,
        color: COLORS.textPrimary,
        padding: 0,
    },

    // Section list
    listContent: {
        paddingHorizontal: 14,
    },
    listContentEmpty: {
        flexGrow: 1,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.bg,
        paddingVertical: 8,
        gap: 8,
    },
    sectionDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    sectionHeaderTextWrap: {
        flex: 1,
        flexShrink: 1,
        minWidth: 0,
    },
    sectionTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    sectionDesc: {
        fontSize: 11.5,
        color: COLORS.textSecondary,
        marginTop: 1,
    },
    sectionCount: {
        fontSize: 15,
        fontWeight: '700',
        marginLeft: 8,
    },

    // Issue card
    card: {
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
        padding: 12,
        marginBottom: 10,
    },
    cardMainRow: {
        flexDirection: 'row',
        gap: 12,
    },
    cardImage: {
        width: 52,
        height: 52,
        borderRadius: 12,
        flexShrink: 0,
    },
    cardImagePlaceholder: {
        backgroundColor: '#F1EFEA',
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardTextWrap: {
        flex: 1,
        flexShrink: 1,
        minWidth: 0,
        justifyContent: 'center',
        gap: 6,
    },
    cardTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: COLORS.textPrimary,
        lineHeight: 20,
    },
    cardMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 8,
    },
    cardTag: {
        paddingHorizontal: 9,
        paddingVertical: 3,
        borderRadius: 999,
    },
    cardTagText: {
        fontSize: 11.5,
        fontWeight: '700',
    },
    cardMetaText: {
        fontSize: 12.5,
        color: COLORS.textSecondary,
    },

    // Empty states
    emptyWrap: {
        flex: 1,
        justifyContent: 'center',
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 40,
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
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
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
        gap: 10,
    },
    skeletonFilterBar: {
        height: 44,
        borderRadius: 14,
        backgroundColor: '#EDE8E1',
        marginBottom: 4,
    },
    skeletonCard: {
        flexDirection: 'row',
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
        padding: 12,
        gap: 12,
    },
    skeletonImage: {
        width: 52,
        height: 52,
        borderRadius: 12,
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
        width: '80%',
        height: 12,
        borderRadius: 6,
        backgroundColor: '#EDE8E1',
    },
});
