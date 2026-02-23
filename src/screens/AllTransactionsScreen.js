import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, Modal, Dimensions, Animated, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getOrders, getOrderDetails } from '../services/api';
import ReceiptModal from '../components/payment/ReceiptModal';
import { useBluetooth } from '../contexts/BluetoothContext';


const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Filter Option Constants
const DATE_OPTIONS = [
    { id: 'all', label: 'ทั้งหมด' },
    { id: 'today', label: 'วันนี้' },
    { id: 'week', label: 'สัปดาห์นี้' },
    { id: 'month', label: 'เดือนนี้' },
];

const STATUS_OPTIONS = [
    { id: 'all', label: 'ทั้งหมด' },
    { id: 'paid', label: 'ชำระแล้ว' },
    { id: 'unpaid', label: 'ค้างชำระ' },
];

const PAYMENT_METHOD_OPTIONS = [
    { id: 'all', label: 'ทั้งหมด' },
    { id: 'cash', label: 'เงินสด' },
    { id: 'qr', label: 'สแกน QR' },
    { id: 'credit', label: 'เครดิต' },
];

const SORT_OPTIONS = [
    { id: 'newest', label: 'ใหม่สุด' },
    { id: 'oldest', label: 'เก่าสุด' },
    { id: 'highest', label: 'ยอดสูงสุด' },
    { id: 'lowest', label: 'ยอดต่ำสุด' },
];

// Memoized Item Component for Performance
const TransactionItem = React.memo(({ item, onPress }) => {
    // Determine icons/colors based on method
    let methodIcon = 'cash-outline';
    let methodColor = '#4CAF50';
    let methodLabel = 'เงินสด';
    let bgBadge = '#E8F5E9';

    if (item.method === 'qr') {
        methodIcon = 'qr-code-outline';
        methodColor = '#2196F3';
        methodLabel = 'QR';
        bgBadge = '#E3F2FD';
    } else if (item.method === 'credit' || item.paymentType === 'credit_sale') {
        methodIcon = 'card-outline';
        methodColor = '#FF9800';
        methodLabel = 'เครดิต';
        bgBadge = '#FFF3E0';
    }

    return (
        <TouchableOpacity style={styles.card} onPress={() => onPress(item)}>
            <View style={styles.iconContainer}>
                <Ionicons 
                    name={item.paymentStatus === 'paid' ? 'checkmark-circle' : 'time'} 
                    size={36} 
                    color={item.paymentStatus === 'paid' ? '#4CAF50' : '#FF9800'} 
                />
            </View>
            <View style={styles.info}>
                <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                    <Text style={styles.customer}>{item.customer}</Text>
                    <Text style={styles.amount}>฿{item.amount.toLocaleString()}</Text>
                </View>
                
                <View style={{flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 8}}>
                    <Text style={styles.date}>{item.date} • {item.time}</Text>
                    
                    {/* Payment Method Badge */}
                    <View style={[styles.methodBadge, { backgroundColor: bgBadge }]}>
                        <Ionicons name={methodIcon} size={10} color={methodColor} style={{ marginRight: 2 }} />
                        <Text style={[styles.methodText, { color: methodColor }]}>{methodLabel}</Text>
                    </View>
                </View>

                {item.paymentStatus !== 'paid' && (
                     <Text style={[styles.statusText, { color: '#FF9800', marginTop: 4 }]}>
                        สถานะ: ค้างชำระ
                     </Text>
                )}
            </View>
            <Ionicons name="chevron-forward" size={20} color="#E0E0E0" />
        </TouchableOpacity>
    );
});

export default function AllTransactionsScreen({ navigation }) {
    const insets = useSafeAreaInsets();
    const { printReceipt } = useBluetooth();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Filter State - Default to 'today' for performance
    const [activeFilters, setActiveFilters] = useState({
        date: 'today',
        status: 'all',
        paymentMethod: 'all',
        sort: 'newest'
    });
    const [filterModalVisible, setFilterModalVisible] = useState(false);
    const [tempFilters, setTempFilters] = useState({...activeFilters}); // For modal edits

    // Receipt Modal State
    const [receiptVisible, setReceiptVisible] = useState(false);
    const [selectedTransaction, setSelectedTransaction] = useState(null);

    // Animation for Modal
    const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

    const openFilterModal = () => {
        setTempFilters({...activeFilters});
        setFilterModalVisible(true);
        Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
            tension: 65,
            friction: 11
        }).start();
    };

    const closeFilterModal = () => {
        Animated.timing(slideAnim, {
            toValue: SCREEN_HEIGHT,
            duration: 250,
            useNativeDriver: true
        }).start(() => setFilterModalVisible(false));
    };

    const applyFilters = () => {
        setActiveFilters(tempFilters);
        closeFilterModal();
        // Reset list and fetch with new filters
        setPage(1);
        setOrders([]);
        setLoading(true); // Trigger loading state for visual feedback
        fetchOrders(1, true, tempFilters);
    };

    const getFilterParams = (filters) => {
        const params = {
            page: 1, 
            limit: 20,
            sort: filters.sort
        };

        if (filters.status !== 'all') {
            params.status = filters.status;
        }

        if (filters.paymentMethod !== 'all') {
            params.paymentMethod = filters.paymentMethod;
        }

        const now = new Date();
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();
        
        if (filters.date === 'today') {
            const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
            params.startDate = startOfDay;
            params.endDate = endOfDay;
        } else if (filters.date === 'week') {
            // Start of week (Monday) or 7 days ago? Let's use start of week.
            const day = now.getDay() || 7; 
            if (day !== 1) now.setHours(-24 * (day - 1));
            now.setHours(0, 0, 0, 0);
            params.startDate = now.toISOString();
            params.endDate = endOfDay;
        } else if (filters.date === 'month') {
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
            params.startDate = startOfMonth;
            params.endDate = endOfDay;
        }

        return params;
    };

    const fetchOrders = async (pageNum = 1, shouldRefresh = false, filtersOverride = null) => {
        // If loading more, don't show full screen loader
        if (pageNum === 1 && !refreshing) setLoading(true);
        
        const currentFilters = filtersOverride || activeFilters;
        const params = {
            ...getFilterParams(currentFilters),
            page: pageNum,
        };

        try {
            const res = await getOrders(params);
            if (res.success) {
                if (shouldRefresh || pageNum === 1) {
                    setOrders(res.data);
                } else {
                    setOrders(prev => [...prev, ...res.data]);
                }
                setHasMore(res.data.length === 20);
                setPage(pageNum);
            }
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Failed to fetch transactions');
        } finally {
            setLoading(false);
            setLoadingMore(false);
            setRefreshing(false);
        }
    };

    // Initial Load
    useEffect(() => {
        fetchOrders();
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        fetchOrders(1, true);
    };

    const loadMore = () => {
        if (!loadingMore && hasMore && !loading) {
            setLoadingMore(true);
            fetchOrders(page + 1);
        }
    };

    const handleTransactionPress = useCallback(async (order) => {
        try {
            const res = await getOrderDetails(order.id);
            if (res.success) {
                setSelectedTransaction(res.data);
                setReceiptVisible(true);
            } else {
                Alert.alert('Error', 'ไม่สามารถโหลดข้อมูลบิลได้');
            }
        } catch (error) {
            Alert.alert('Error', 'เกิดข้อผิดพลาดในการโหลดข้อมูล');
        }
    }, []);

    // --- Render Components ---

    const renderFilterChip = (type, options, stateKey) => {
        return (
            <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>{type}</Text>
                <View style={styles.chipContainer}>
                    {options.map(opt => (
                        <TouchableOpacity
                            key={opt.id}
                            style={[
                                styles.chip,
                                tempFilters[stateKey] === opt.id && styles.activeChip
                            ]}
                            onPress={() => setTempFilters({...tempFilters, [stateKey]: opt.id})}
                        >
                            <Text style={[
                                styles.chipText,
                                tempFilters[stateKey] === opt.id && styles.activeChipText
                            ]}>
                                {opt.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>
        );
    };

    const renderActiveFiltersBar = () => {
        const hasFilters = activeFilters.date !== 'all' || activeFilters.status !== 'all' || activeFilters.paymentMethod !== 'all' || activeFilters.sort !== 'newest';
        if (!hasFilters) return null;

        return (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.activeFiltersBar} contentContainerStyle={{ paddingHorizontal: 20, alignItems: 'center' }}>
                <Text style={{ marginRight: 8, fontSize: 12, color: '#666' }}>กำลังแสดง:</Text>
                
                {activeFilters.date !== 'all' && (
                    <View style={styles.activeFilterChip}>
                        <Text style={styles.activeFilterText}>{DATE_OPTIONS.find(o => o.id === activeFilters.date)?.label}</Text>
                        <TouchableOpacity onPress={() => {
                            const newFilters = {...activeFilters, date: 'all'};
                            setActiveFilters(newFilters);
                            fetchOrders(1, true, newFilters);
                        }}>
                            <Ionicons name="close-circle" size={16} color="#fff" style={{ marginLeft: 4 }} />
                        </TouchableOpacity>
                    </View>
                )}

                {activeFilters.status !== 'all' && (
                    <View style={styles.activeFilterChip}>
                        <Text style={styles.activeFilterText}>{STATUS_OPTIONS.find(o => o.id === activeFilters.status)?.label}</Text>
                        <TouchableOpacity onPress={() => {
                            const newFilters = {...activeFilters, status: 'all'};
                            setActiveFilters(newFilters);
                            fetchOrders(1, true, newFilters);
                        }}>
                            <Ionicons name="close-circle" size={16} color="#fff" style={{ marginLeft: 4 }} />
                        </TouchableOpacity>
                    </View>
                )}

                {activeFilters.paymentMethod !== 'all' && (
                    <View style={styles.activeFilterChip}>
                        <Text style={styles.activeFilterText}>{PAYMENT_METHOD_OPTIONS.find(o => o.id === activeFilters.paymentMethod)?.label}</Text>
                        <TouchableOpacity onPress={() => {
                            const newFilters = {...activeFilters, paymentMethod: 'all'};
                            setActiveFilters(newFilters);
                            fetchOrders(1, true, newFilters);
                        }}>
                            <Ionicons name="close-circle" size={16} color="#fff" style={{ marginLeft: 4 }} />
                        </TouchableOpacity>
                    </View>
                )}

                {activeFilters.sort !== 'newest' && (
                    <View style={styles.activeFilterChip}>
                        <Text style={styles.activeFilterText}>เรียง: {SORT_OPTIONS.find(o => o.id === activeFilters.sort)?.label}</Text>
                        <TouchableOpacity onPress={() => {
                            const newFilters = {...activeFilters, sort: 'newest'};
                            setActiveFilters(newFilters);
                            fetchOrders(1, true, newFilters);
                        }}>
                            <Ionicons name="close-circle" size={16} color="#fff" style={{ marginLeft: 4 }} />
                        </TouchableOpacity>
                    </View>
                )}
                
                <TouchableOpacity onPress={() => {
                    const newFilters = { date: 'all', status: 'all', paymentMethod: 'all', sort: 'newest' };
                    setActiveFilters(newFilters);
                    fetchOrders(1, true, newFilters);
                }}>
                    <Text style={{ marginLeft: 8, fontSize: 12, color: '#F37021', fontWeight: 'bold' }}>ล้างทั้งหมด</Text>
                </TouchableOpacity>
            </ScrollView>
        );
    };

    // FlatList Optimization: getItemLayout
    const getItemLayout = (data, index) => (
        { length: 100, offset: 100 * index, index }
    );

    const renderItem = useCallback(({ item }) => (
        <TransactionItem item={item} onPress={handleTransactionPress} />
    ), [handleTransactionPress]);

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#000" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>ประวัติการขาย</Text>
                <TouchableOpacity onPress={openFilterModal} style={styles.filterBtn}>
                    <Ionicons name="options-outline" size={24} color="#F37021" />
                    {(activeFilters.date !== 'all' || activeFilters.status !== 'all' || activeFilters.paymentMethod !== 'all' || activeFilters.sort !== 'newest') && (
                        <View style={styles.filterBadge} />
                    )}
                </TouchableOpacity>
            </View>

            {/* Active Filters Bar */}
            {renderActiveFiltersBar()}

            {/* List */}
            {loading && !refreshing && page === 1 ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#F37021" />
                    <Text style={{ marginTop: 10, color: '#888' }}>กำลังโหลดข้อมูล...</Text>
                </View>
            ) : (
                <FlatList
                    data={orders}
                    renderItem={renderItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    onEndReached={loadMore}
                    onEndReachedThreshold={0.5}
                    // Performance Optimization Props
                    removeClippedSubviews={true}
                    initialNumToRender={10}
                    maxToRenderPerBatch={10}
                    windowSize={5}
                    getItemLayout={getItemLayout}
                    // ----------------------------
                    ListFooterComponent={loadingMore && <ActivityIndicator size="small" color="#F37021" style={{ marginVertical: 10 }} />}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Ionicons name="receipt-outline" size={64} color="#ccc" />
                            <Text style={styles.emptyText}>ไม่พบรายการขาย</Text>
                            <Text style={styles.emptySubText}>ลองเปลี่ยนตัวกรองหรือสร้างรายการใหม่</Text>
                        </View>
                    }
                />
            )}

            {/* Receipt Modal */}
            <ReceiptModal
                visible={receiptVisible}
                transaction={selectedTransaction}
                onClose={() => setReceiptVisible(false)}
                onPrint={async () => {
                    try {
                        await printReceipt(selectedTransaction);
                        Alert.alert('สำเร็จ', 'พิมพ์ใบเสร็จเรียบร้อยแล้ว');
                    } catch (error) {
                        Alert.alert('ผิดพลาด', error.message);
                    }
                }}
                onNewTransaction={() => setReceiptVisible(false)}
            />

            {/* Filter Modal (Custom Bottom Sheet) */}
            <Modal
                transparent
                visible={filterModalVisible}
                animationType="fade"
                onRequestClose={closeFilterModal}
            >
                <View style={styles.modalOverlay}>
                    <TouchableOpacity style={styles.modalBackdrop} onPress={closeFilterModal} />
                    <Animated.View style={[styles.modalContent, { transform: [{ translateY: slideAnim }] }]}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>ตัวกรองและเรียงลำดับ</Text>
                            <TouchableOpacity onPress={closeFilterModal}>
                                <Ionicons name="close" size={24} color="#333" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBody}>
                            {renderFilterChip('ช่วงเวลา', DATE_OPTIONS, 'date')}
                            {renderFilterChip('ช่องทางชำระเงิน', PAYMENT_METHOD_OPTIONS, 'paymentMethod')}
                            {renderFilterChip('สถานะการชำระ', STATUS_OPTIONS, 'status')}
                            {renderFilterChip('เรียงลำดับ', SORT_OPTIONS, 'sort')}
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            <TouchableOpacity style={styles.resetBtn} onPress={() => setTempFilters({ date: 'all', status: 'all', paymentMethod: 'all', sort: 'newest' })}>
                                <Text style={styles.resetBtnText}>รีเซ็ต</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.applyBtn} onPress={applyFilters}>
                                <Text style={styles.applyBtnText}>ใช้งานตัวกรอง</Text>
                            </TouchableOpacity>
                        </View>
                    </Animated.View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 15, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
    headerTitle: { fontSize: 20, fontWeight: 'bold' },
    backBtn: { padding: 4 },
    filterBtn: { padding: 4, position: 'relative' },
    filterBadge: { position: 'absolute', top: 4, right: 4, width: 8, height: 8, borderRadius: 4, backgroundColor: 'red', borderWidth: 1, borderColor: '#fff' },
    
    // Active Filters
    activeFiltersBar: { maxHeight: 50, backgroundColor: '#FAFAFA', borderBottomWidth: 1, borderBottomColor: '#eee' },
    activeFilterChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F37021', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 16, marginRight: 8 },
    activeFilterText: { color: '#fff', fontSize: 12, fontWeight: '600' },

    // Loading & Empty
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyContainer: { alignItems: 'center', marginTop: 60 },
    emptyText: { fontSize: 18, fontWeight: 'bold', color: '#666', marginTop: 10 },
    emptySubText: { fontSize: 14, color: '#999', marginTop: 4 },

    // Card
    card: { flexDirection: 'row', backgroundColor: '#fff', padding: 16, borderRadius: 16, marginBottom: 12, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2, borderWidth: 1, borderColor: '#f0f0f0', height: 100 },
    iconContainer: { marginRight: 16 },
    info: { flex: 1, marginRight: 8 },
    customer: { fontSize: 16, fontWeight: 'bold', color: '#333' },
    date: { fontSize: 13, color: '#999' },
    amount: { fontSize: 18, fontWeight: 'bold', color: '#F37021' },
    creditBadge: { backgroundColor: '#E3F2FD', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 8 },
    creditText: { fontSize: 10, color: '#2196F3', fontWeight: 'bold' },
    statusText: { fontSize: 12 },
    methodBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    methodText: { fontSize: 10, fontWeight: 'bold' },

    // Modal Styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalBackdrop: { ...StyleSheet.absoluteFillObject },
    modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, height: '80%', paddingBottom: 20 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
    modalTitle: { fontSize: 18, fontWeight: 'bold' },
    modalBody: { padding: 20 },
    modalFooter: { flexDirection: 'row', padding: 20, borderTopWidth: 1, borderTopColor: '#f0f0f0', gap: 15 },
    
    // Filter Chips inside Modal
    filterSection: { marginBottom: 25 },
    filterLabel: { fontSize: 16, fontWeight: '600', marginBottom: 12, color: '#333' },
    chipContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 25, backgroundColor: '#F5F5F5', borderWidth: 1, borderColor: '#E0E0E0' },
    activeChip: { backgroundColor: '#FFF0E0', borderColor: '#F37021' },
    chipText: { fontSize: 14, color: '#666' },
    activeChipText: { color: '#F37021', fontWeight: 'bold' },

    // Buttons
    resetBtn: { flex: 1, padding: 15, borderRadius: 12, backgroundColor: '#F5F5F5', alignItems: 'center' },
    resetBtnText: { color: '#666', fontWeight: 'bold' },
    applyBtn: { flex: 2, padding: 15, borderRadius: 12, backgroundColor: '#F37021', alignItems: 'center' },
    applyBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});