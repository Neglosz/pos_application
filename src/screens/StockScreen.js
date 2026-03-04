import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, Dimensions, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { getStockStats, getNearExpiryItems, getLowStockItems, getExpiredItems, getOutOfStockItems, checkStockNotifications } from '../services/api';

export default function StockScreen() {
    const navigation = useNavigation();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [stats, setStats] = useState({ total: 0, nearExpiry: 0, lowStock: 0, expired: 0, outOfStock: 0 });
    const [nearExpiryItems, setNearExpiryItems] = useState([]);
    const [lowStockItems, setLowStockItems] = useState([]);
    const [expiredItems, setExpiredItems] = useState([]);
    const [outOfStockItems, setOutOfStockItems] = useState([]);

    const loadData = async () => {
        try {
            // Check and generate stock notifications in background
            checkStockNotifications().catch(err =>
                console.log('Background notification check:', err)
            );

            const [statsRes, expiryRes, lowStockRes, expiredRes, outOfStockRes] = await Promise.all([
                getStockStats(),
                getNearExpiryItems(),
                getLowStockItems(),
                getExpiredItems(),
                getOutOfStockItems()
            ]);

            if (statsRes.success) {
                setStats(statsRes.data);
            }
            if (expiryRes.success) {
                setNearExpiryItems(expiryRes.data);
            }
            if (lowStockRes.success) {
                setLowStockItems(lowStockRes.data);
            }
            if (expiredRes.success) {
                setExpiredItems(expiredRes.data);
            }
            if (outOfStockRes.success) {
                setOutOfStockItems(outOfStockRes.data);
            }
        } catch (error) {
            console.error('Error loading stock data:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    // Refresh when screen comes into focus
    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [])
    );

    const onRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    const formatExpireDate = (dateStr) => {
        if (!dateStr) return 'ไม่ระบุ';
        const [year, month, day] = dateStr.split('T')[0].split('-');
        const date = new Date(year, month - 1, day, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const diffTime = date - today;
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) return 'หมดอายุแล้ว';
        if (diffDays == 0) return 'หมดอายุวันนี้';
        if (diffDays === 1) return 'พรุ่งนี้';
        if (diffDays <= 7) return `อีก ${diffDays} วัน`;
        return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
    };

    // Images are now stored as full Supabase URLs, no need to prefix
    const getImageUri = (imagePath) => {
        return imagePath || null;
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#1E2022" />
                    <Text style={styles.loadingText}>กำลังโหลดข้อมูล...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <View style={styles.container}>
            <ScrollView
                style={styles.content}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
            >
                {/* Unified Dashboard Card */}
                <View style={styles.dashboardCard}>
                    <View style={styles.dashboardHeader}>
                        <View style={styles.titleRow}>
                            <Text style={styles.dashboardTitle}>สินค้าในคลัง</Text>
                            <Text style={styles.dashboardTotal}>{stats.total.toLocaleString()}</Text>
                            <Text style={styles.dashboardUnit}>รายการ</Text>
                        </View>
                    </View>

                    <View style={styles.dashboardGrid}>
                        {/* Expired Stat */}
                        <View style={[styles.statBox, styles.statBoxRed]}>
                            <Ionicons name="warning-outline" size={24} color="#D32F2F" style={styles.statIcon} />
                            <Text style={[styles.statNumber, { color: '#D32F2F' }]}>{stats.expired}</Text>
                            <Text style={styles.statLabel} numberOfLines={1} adjustsFontSizeToFit>หมดอายุ</Text>
                        </View>

                        {/* Near Expiry Stat */}
                        <View style={[styles.statBox, styles.statBoxYellow]}>
                            <Ionicons name="time-outline" size={24} color="#F57F17" style={styles.statIcon} />
                            <Text style={[styles.statNumber, { color: '#F57F17' }]}>{stats.nearExpiry}</Text>
                            <Text style={styles.statLabel} numberOfLines={1} adjustsFontSizeToFit>ใกล้หมด</Text>
                        </View>

                        {/* Out of Stock Stat */}
                        <View style={[styles.statBox, styles.statBoxBlue]}>
                            <Ionicons name="cube-outline" size={24} color="#455A64" style={styles.statIcon} />
                            <Text style={[styles.statNumber, { color: '#455A64' }]}>{stats.outOfStock}</Text>
                            <Text style={styles.statLabel} numberOfLines={1} adjustsFontSizeToFit>ของหมด</Text>
                        </View>

                        {/* Low Stock Stat */}
                        <View style={[styles.statBox, styles.statBoxOrange]}>
                            <Ionicons name="trending-down-outline" size={24} color="#E65100" style={styles.statIcon} />
                            <Text style={[styles.statNumber, { color: '#E65100' }]}>{stats.lowStock}</Text>
                            <Text style={styles.statLabel} numberOfLines={1} adjustsFontSizeToFit>สต็อกต่ำ</Text>
                        </View>
                    </View>
                </View>

                {/* Scan Button Section */}
                <TouchableOpacity
                    style={styles.scanButton}
                    onPress={() => navigation.navigate('StockScan')}
                >
                    <Ionicons name="scan-outline" size={28} color="#fff" style={styles.scanIcon} />
                    <View style={styles.scanTextContainer}>
                        <Text style={styles.scanButtonText}>สแกนนำเข้าสินค้า</Text>
                        <Text style={styles.scanButtonSubText}>เพิ่มสินค้าเข้าคลังด้วยการสแกน</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.5)" />
                </TouchableOpacity>

                {/* Empty State when no products */}
                {stats.total === 0 && (
                    <View style={styles.emptyStateContainerCentered}>
                        <Ionicons name="storefront-outline" size={60} color="#E0E0E0" />
                        <Text style={styles.emptyStateTitle}>คลังสินค้ายังว่างเปล่า</Text>
                        <Text style={styles.emptyStateSubtitle}>สแกนบาร์โค้ดสินค้าเพื่อเพิ่มเข้าคลัง แนะนำเริ่มจากสินค้าที่ขายประจำ</Text>
                        <TouchableOpacity
                            style={styles.emptyAddButton}
                            onPress={() => navigation.navigate('StockScan')}
                        >
                            <Ionicons name="add" size={20} color="#fff" style={{ marginRight: 6 }} />
                            <Text style={styles.emptyAddButtonText}>สแกนเพิ่มสินค้าชิ้นแรก</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Out of Stock List */}
                {
                    outOfStockItems.length > 0 && (
                        <View style={styles.listContainer}>
                            <View style={styles.listHeaderRow}>
                                <View style={styles.listHeaderLeft}>
                                    <View style={[styles.dot, { backgroundColor: '#616161' }]} />
                                    <Text style={styles.listHeaderTitle}>สินค้าหมดสต็อก</Text>
                                </View>
                            </View>
                            <View style={styles.listContent}>
                                {outOfStockItems.map((item) => (
                                    <View key={item.id} style={styles.listItem}>
                                        <View style={styles.itemLeft}>
                                            {item.image ? (
                                                <Image source={{ uri: getImageUri(item.image) }} style={styles.itemImage} />
                                            ) : (
                                                <View style={[styles.itemImage, styles.placeholderImage]}>
                                                    <Ionicons name="cube-outline" size={24} color="#666" />
                                                </View>
                                            )}
                                        </View>
                                        <View style={styles.itemCenter}>
                                            <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                                            <View style={styles.tagsRow}>
                                                <View style={[styles.tagRed, { backgroundColor: '#EEEEEE' }]}>
                                                    <Text style={[styles.tagRedText, { color: '#616161' }]}>หมดสต็อก</Text>
                                                </View>
                                            </View>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )
                }

                {/* Expired List */}
                {
                    expiredItems.length > 0 && (
                        <View style={styles.listContainer}>
                            <View style={styles.listHeaderRow}>
                                <View style={styles.listHeaderLeft}>
                                    <View style={[styles.dot, { backgroundColor: '#D32F2F' }]} />
                                    <Text style={styles.listHeaderTitle}>สินค้าหมดอายุ</Text>
                                </View>
                            </View>
                            <View style={styles.listContent}>
                                {expiredItems.map((item) => (
                                    <View key={item.id} style={styles.listItem}>
                                        <View style={styles.itemLeft}>
                                            {item.image ? (
                                                <Image source={{ uri: getImageUri(item.image) }} style={styles.itemImage} />
                                            ) : (
                                                <View style={[styles.itemImage, styles.placeholderImage]}>
                                                    <Ionicons name="cube-outline" size={24} color="#666" />
                                                </View>
                                            )}
                                        </View>
                                        <View style={styles.itemCenter}>
                                            <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                                            <View style={styles.tagsRow}>
                                                <View style={styles.tagRed}>
                                                    <Text style={styles.tagRedText}>
                                                        {formatExpireDate(item.expireDate)}
                                                    </Text>
                                                </View>
                                            </View>
                                        </View>
                                        <View style={styles.itemRight}>
                                            <View style={styles.BadgeBlue}>
                                                <Text style={styles.BadgeBlueText}>{item.quantity} {item.unit || 'ชิ้น'}</Text>
                                            </View>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )
                }

                {/* Near Expiry List */}
                {
                    nearExpiryItems.length > 0 && (
                        <View style={styles.listContainer}>
                            <View style={styles.listHeaderRow}>
                                <View style={styles.listHeaderLeft}>
                                    <View style={[styles.dot, { backgroundColor: '#FFC107' }]} />
                                    <Text style={styles.listHeaderTitle}>สินค้าใกล้หมดอายุ</Text>
                                    <Text style={styles.listHeaderSubtitle}>(ภายใน 30 วัน)</Text>
                                </View>
                            </View>

                            <View style={styles.listContent}>
                                {nearExpiryItems.map((item) => (
                                    <View key={item.id} style={styles.listItem}>
                                        <View style={styles.itemLeft}>
                                            {item.image ? (
                                                <Image source={{ uri: getImageUri(item.image) }} style={styles.itemImage} />
                                            ) : (
                                                <View style={[styles.itemImage, styles.placeholderImage]}>
                                                    <Ionicons name="cube-outline" size={24} color="#666" />
                                                </View>
                                            )}
                                        </View>
                                        <View style={styles.itemCenter}>
                                            <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                                            <View style={styles.tagsRow}>
                                                <View style={styles.tagYellow}>
                                                    <Text style={styles.tagYellowText}>
                                                        {formatExpireDate(item.expireDate) === 'หมดอายุแล้ว'
                                                            ? 'หมดอายุแล้ว'
                                                            : `หมดอายุ ${formatExpireDate(item.expireDate)}`}
                                                    </Text>
                                                </View>
                                            </View>
                                        </View>
                                        <View style={styles.itemRight}>
                                            <View style={styles.BadgeBlue}>
                                                <Text style={styles.BadgeBlueText}>{item.quantity} {item.unit || 'ชิ้น'}</Text>
                                            </View>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )
                }

                {/* Low Stock List */}
                {
                    lowStockItems.length > 0 && (
                        <View style={styles.listContainer}>
                            <View style={styles.listHeaderRow}>
                                <View style={styles.listHeaderLeft}>
                                    <View style={[styles.dot, { backgroundColor: '#F44336' }]} />
                                    <Text style={styles.listHeaderTitle}>สินค้าใกล้หมดสต็อก</Text>
                                </View>
                            </View>

                            <View style={styles.listContent}>
                                {lowStockItems.map((item) => (
                                    <View key={item.id} style={styles.listItem}>
                                        <View style={styles.itemLeft}>
                                            {item.image ? (
                                                <Image source={{ uri: getImageUri(item.image) }} style={styles.itemImage} />
                                            ) : (
                                                <View style={[styles.itemImage, styles.placeholderImage]}>
                                                    <Ionicons name="cube-outline" size={24} color="#666" />
                                                </View>
                                            )}
                                        </View>
                                        <View style={styles.itemCenter}>
                                            <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                                            <View style={styles.tagsRow}>
                                                <View style={styles.tagRed}>
                                                    <Text style={styles.tagRedText}>ใกล้หมดสต็อก</Text>
                                                </View>
                                                {(item.price) && (
                                                    <Text style={styles.priceText}>฿{item.price} / {item.unit || 'ชิ้น'}</Text>
                                                )}
                                            </View>
                                        </View>
                                        <View style={[styles.itemRight]}>
                                            <View style={styles.BadgeBlue}>
                                                <Text style={styles.BadgeBlueText}>{item.quantity} {item.unit || 'ชิ้น'}</Text>
                                            </View>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )
                }

                <View style={{ height: 50 }} />
            </ScrollView >
        </View >
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB', // Light grey background like design
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 10,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 10,
        color: '#666',
    },
    // Dashboard Card
    dashboardCard: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 12, // Reduced padding
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 3,
        borderWidth: 1,
        borderColor: '#f0f0f0',
    },
    dashboardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16, // Reduced margin
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    dashboardTitle: {
        fontSize: 18,
        color: '#444',
        marginRight: 8,
    },
    dashboardTotal: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1E2022',
        marginRight: 4,
    },
    dashboardUnit: {
        fontSize: 18,
        color: '#666',
    },
    viewAllButton: {
        backgroundColor: '#1E2022',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6, // Compact button
        borderRadius: 16,
    },
    viewAllText: {
        color: '#fff',
        fontSize: 18,
        marginRight: 4,
        fontWeight: '600',
    },
    dashboardGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        // gap: 6, // Removed gap to rely on space-between and fixed widths
    },
    statBox: {
        width: '23.5%', // Force exactly equal width
        borderRadius: 14, // Slightly more rounded
        paddingVertical: 12,
        paddingHorizontal: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    statBoxYellow: {
        backgroundColor: '#FFF8E1',
    },
    statBoxRed: {
        backgroundColor: '#FFEBEE',
    },
    statBoxBlue: {
        backgroundColor: '#EDF2F7',
    },
    statBoxOrange: {
        backgroundColor: '#FFF3E0',
    },
    statIcon: {
        marginBottom: 6,
    },
    statNumber: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 2,
    },
    statLabel: {
        fontSize: 18, // Slightly larger
        color: '#444', // Darker for better contrast
        textAlign: 'center',
        fontWeight: 'bold', // Bold text as requested
    },
    // Divider removed
    divider: {
        display: 'none',
    },
    // Scan Button
    scanButton: {
        backgroundColor: '#F37021',
        borderRadius: 16,
        padding: 20,
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 30,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 5,
    },
    scanIcon: {
        marginRight: 15,
    },
    scanTextContainer: {
        flex: 1,
    },
    scanButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    scanButtonSubText: {
        color: '#fff',
        fontSize: 16,
    },
    // Section Headers
    listContainer: {
        marginBottom: 25,
    },
    listHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
    },
    listHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 8,
    },
    listHeaderTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1E2022',
        marginRight: 6,
    },
    listHeaderSubtitle: {
        fontSize: 18,
        color: '#888',
        fontWeight: '400',
    },
    seeAllLink: {
        color: '#FF7043',
        fontSize: 18,
        fontWeight: '600',
    },
    // List Items (Cards)
    listContent: {
        gap: 12,
    },
    listItem: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#eee',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
        elevation: 2,
    },
    itemLeft: {
        marginRight: 12,
    },
    itemImage: {
        width: 48,
        height: 48,
        borderRadius: 10,
    },
    placeholderImage: {
        backgroundColor: '#333',
        justifyContent: 'center',
        alignItems: 'center',
    },
    itemCenter: {
        flex: 1,
    },
    itemName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1E2022',
        marginBottom: 4,
    },
    tagsRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    tagYellow: {
        backgroundColor: '#FFF8E1',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    tagYellowText: {
        color: '#F57F17',
        fontSize: 16,
        fontWeight: '600',
    },
    tagRed: {
        backgroundColor: '#FFEBEE',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
        marginRight: 8,
    },
    tagRedText: {
        color: '#D32F2F',
        fontSize: 16,
        fontWeight: '600',
    },
    priceText: {
        fontSize: 18,
        color: '#888',
    },
    itemRight: {
        alignItems: 'flex-end',
        justifyContent: 'center',
    },
    BadgeBlue: {
        backgroundColor: '#F37021',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    BadgeBlueText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    quantityText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1E2022',
    },
    unitText: {
        fontSize: 18,
        color: '#888',
    },
    moreButton: {
        marginLeft: 8,
    },
    emptyState: {
        alignItems: 'center',
        padding: 20,
    },
    emptyText: {
        color: '#999',
        fontSize: 18,
        marginTop: 5,
    },
    // FAB
    fab: {
        position: 'absolute',
        bottom: 20,
        right: 20,
        backgroundColor: '#FF7043', // Orange FAB
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#FF7043',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 8,
    },
    // Empty State Center
    emptyStateContainerCentered: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 50,
        paddingHorizontal: 20,
        backgroundColor: '#fff',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#f0f0f0',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
        marginTop: 10,
    },
    emptyStateTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#444',
        marginTop: 15,
        marginBottom: 8,
    },
    emptyStateSubtitle: {
        fontSize: 16,
        color: '#888',
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 20,
    },
    emptyAddButton: {
        flexDirection: 'row',
        backgroundColor: '#F37021',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 25,
        alignItems: 'center',
        shadowColor: '#F37021',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 4,
    },
    emptyAddButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
