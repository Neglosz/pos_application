import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getTransactions, createTransaction, deleteTransaction, cancelOrder } from '../services/api';
import AddTransactionModal from '../components/AddTransactionModal';
import { useBluetooth } from '../contexts/BluetoothContext';
import { ReceiptModal } from '../components/payment';

// แปล category เป็นภาษาไทย
const CATEGORY_TH = {
    sales: 'ยอดขาย',
    debt_payment: 'รับชำระหนี้',
    expense: 'รายจ่ายทั่วไป',
    purchase: 'ซื้อสินค้า',
    salary: 'เงินเดือน/ค่าแรง',
    utility: 'ค่าสาธารณูปโภค',
    rent: 'ค่าเช่า',
    other: 'อื่นๆ',
};

const PAYMENT_TH = {
    cash: 'เงินสด',
    qr: 'QR พร้อมเพย์',
    qr_promptpay: 'QR พร้อมเพย์',
    credit: 'เชื่อ/ลูกหนี้',
};

const toCategoryTH = (cat) => CATEGORY_TH[cat] || cat;
const toPaymentTH = (pm) => PAYMENT_TH[pm] || pm;

// คำนวณช่วงวันที่จาก period
const getDateRange = (period) => {
    const today = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const todayStr = fmt(today);

    if (period === 'today') {
        return { startDate: todayStr, endDate: todayStr };
    }
    if (period === 'week') {
        const day = today.getDay(); // 0=อาทิตย์
        const diff = day === 0 ? 6 : day - 1; // เริ่มจันทร์
        const mon = new Date(today);
        mon.setDate(today.getDate() - diff);
        return { startDate: fmt(mon), endDate: todayStr };
    }
    if (period === 'month') {
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        return { startDate: fmt(firstDay), endDate: todayStr };
    }
    return {}; // ทั้งหมด
};

const PERIODS = [
    { key: 'today', label: 'วันนี้' },
    { key: 'week', label: 'สัปดาห์นี้' },
    { key: 'month', label: 'เดือนนี้' },
    { key: 'all', label: 'ทั้งหมด' },
];

const TYPES = [
    { key: 'all', label: 'ทั้งหมด' },
    { key: 'income', label: 'รายรับ' },
    { key: 'expense', label: 'รายจ่าย' },
];

export default function TransactionHistoryScreen({ navigation }) {
    const insets = useSafeAreaInsets();
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [typeFilter, setTypeFilter] = useState('all');
    const [periodFilter, setPeriodFilter] = useState('all');
    const [modalVisible, setModalVisible] = useState(false);
    const { connectedPrinter } = useBluetooth();
    const [receiptModalVisible, setReceiptModalVisible] = useState(false);
    const [selectedTransaction, setSelectedTransaction] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const buildParams = (type, period) => {
        const params = { type, limit: 200 };
        const range = getDateRange(period);
        if (range.startDate) params.startDate = range.startDate;
        if (range.endDate) params.endDate = range.endDate;
        return params;
    };

    const fetchTransactions = async (type = typeFilter, period = periodFilter) => {
        setLoading(true);
        try {
            const res = await getTransactions(buildParams(type, period));
            if (res.success) setTransactions(res.data);
        } catch (error) {
            Alert.alert('ข้อผิดพลาด', 'ไม่สามารถโหลดรายการได้ กรุณาลองใหม่อีกครั้ง');
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        try {
            const res = await getTransactions(buildParams(typeFilter, periodFilter));
            if (res.success) setTransactions(res.data);
        } catch {
            Alert.alert('ข้อผิดพลาด', 'ไม่สามารถโหลดรายการได้');
        } finally {
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchTransactions(typeFilter, periodFilter);
    }, [typeFilter, periodFilter]);

    // คำนวณสรุปยอด
    const summary = transactions.reduce(
        (acc, t) => {
            const amt = parseFloat(t.amount) || 0;
            if (t.trans_type === 'income') acc.income += amt;
            else acc.expense += amt;
            return acc;
        },
        { income: 0, expense: 0 }
    );
    summary.net = summary.income - summary.expense;

    const handleSaveTransaction = async (data) => {
        try {
            const res = await createTransaction(data);
            if (res.success) {
                setModalVisible(false);
                fetchTransactions();
            } else {
                Alert.alert('ข้อผิดพลาด', res.error || 'บันทึกรายการไม่สำเร็จ กรุณาลองใหม่');
            }
        } catch {
            Alert.alert('ข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อได้ กรุณาตรวจสอบอินเทอร์เน็ต');
        }
    };

    const handleDelete = (item) => {
        if (isDeleting) return;

        const isLinkedToSale = item.category === 'sales';
        const isLinkedToDebt = item.category === 'debt_payment';

        let message = 'คุณต้องการลบรายการนี้ใช่หรือไม่?';
        if (isLinkedToSale) {
            message = 'รายการนี้เชื่อมโยงกับการขาย หากลบอาจส่งผลต่อรายงาน คุณต้องการลบต่อหรือไม่?';
        } else if (isLinkedToDebt) {
            message = 'รายการนี้เชื่อมโยงกับการชำระหนี้ หากลบจะย้อนยอดค้างชำระด้วย คุณต้องการลบต่อหรือไม่?';
        }

        Alert.alert('ยืนยันการลบ', message, [
            { text: 'ยกเลิก', style: 'cancel' },
            {
                text: 'ลบ',
                style: 'destructive',
                onPress: async () => {
                    setIsDeleting(true);
                    try {
                        if (isLinkedToSale && item.reference_order_id) {
                            await cancelOrder(item.reference_order_id);
                        }
                        await deleteTransaction(item.id);
                        fetchTransactions();
                    } catch {
                        Alert.alert('ข้อผิดพลาด', 'ลบรายการไม่สำเร็จ กรุณาลองใหม่');
                    } finally {
                        setIsDeleting(false);
                    }
                },
            },
        ]);
    };

    const renderItem = ({ item }) => {
        const isIncome = item.trans_type === 'income';
        const color = isIncome ? '#4CAF50' : '#F44336';
        const catLabel = toCategoryTH(item.category);
        const pmLabel = item.payment_method ? toPaymentTH(item.payment_method) : null;
        const dateStr = new Date(item.trans_date).toLocaleDateString('th-TH-u-ca-buddhist', {
            day: 'numeric', month: 'short', year: 'numeric',
        });

        return (
            <View style={styles.card}>
                <View style={[styles.iconWrap, { backgroundColor: isIncome ? '#E8F5E9' : '#FFEBEE' }]}>
                    <Ionicons
                        name={isIncome ? 'arrow-down-circle' : 'arrow-up-circle'}
                        size={28}
                        color={color}
                    />
                </View>

                <View style={styles.info}>
                    <Text style={styles.category}>{catLabel}</Text>
                    {item.description ? (
                        <Text
                            style={[styles.desc, item.category === 'debt_payment' && styles.descHighlight]}
                            numberOfLines={1}
                        >
                            {item.description}
                        </Text>
                    ) : null}
                    <View style={styles.metaRow}>
                        <Ionicons name="calendar-outline" size={11} color="#aaa" />
                        <Text style={styles.metaText}>{dateStr}</Text>
                        {pmLabel ? (
                            <>
                                <Text style={styles.metaDot}>·</Text>
                                <Ionicons name="wallet-outline" size={11} color="#aaa" />
                                <Text style={styles.metaText}>{pmLabel}</Text>
                            </>
                        ) : null}
                    </View>
                </View>

                <View style={styles.right}>
                    <Text style={[styles.amount, { color }]}>
                        {isIncome ? '+' : '-'}฿{parseFloat(item.amount).toLocaleString('th-TH')}
                    </Text>
                    <View style={styles.actions}>
                        {isIncome && connectedPrinter ? (
                            <TouchableOpacity
                                onPress={() => {
                                    setSelectedTransaction({
                                        id: item.reference_id || item.id,
                                        receiptNo: item.order_no || `MANUAL-${item.id}`,
                                        date: new Date(item.trans_date).toLocaleString('th-TH-u-ca-buddhist'),
                                        total: parseFloat(item.amount),
                                        paymentMethod: pmLabel || 'เงินสด',
                                        received: parseFloat(item.amount),
                                        change: 0,
                                    });
                                    setReceiptModalVisible(true);
                                }}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                                <Ionicons name="print-outline" size={18} color="#0A84FF" />
                            </TouchableOpacity>
                        ) : null}
                        <TouchableOpacity
                            onPress={() => handleDelete(item)}
                            disabled={isDeleting}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <Ionicons name="trash-outline" size={18} color={isDeleting ? '#eee' : '#ccc'} />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#000" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>รายการเดินบัญชี</Text>
                <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.addBtn}>
                    <Ionicons name="add" size={24} color="#fff" />
                </TouchableOpacity>
            </View>

            {/* กรองช่วงเวลา */}
            <View style={styles.periodRow}>
                {PERIODS.map((p) => (
                    <TouchableOpacity
                        key={p.key}
                        style={[styles.chip, periodFilter === p.key && styles.chipActive]}
                        onPress={() => setPeriodFilter(p.key)}
                    >
                        <Text style={[styles.chipText, periodFilter === p.key && styles.chipTextActive]}>
                            {p.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* กรองประเภท */}
            <View style={styles.typeRow}>
                {TYPES.map((t) => (
                    <TouchableOpacity
                        key={t.key}
                        style={[styles.typeChip, typeFilter === t.key && styles.typeChipActive]}
                        onPress={() => setTypeFilter(t.key)}
                    >
                        <Text style={[styles.typeChipText, typeFilter === t.key && styles.typeChipTextActive]}>
                            {t.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* สรุปยอด */}
            {!loading && (
                <View style={styles.summaryRow}>
                    <View style={[styles.summaryCard, { borderLeftColor: '#4CAF50' }]}>
                        <Text style={styles.summaryLabel}>รายรับ</Text>
                        <Text style={[styles.summaryValue, { color: '#4CAF50' }]}>
                            ฿{summary.income.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                        </Text>
                    </View>
                    <View style={[styles.summaryCard, { borderLeftColor: '#F44336' }]}>
                        <Text style={styles.summaryLabel}>รายจ่าย</Text>
                        <Text style={[styles.summaryValue, { color: '#F44336' }]}>
                            ฿{summary.expense.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                        </Text>
                    </View>
                </View>
            )}

            {/* รายการ */}
            {loading ? (
                <ActivityIndicator size="large" color="#F37021" style={{ marginTop: 40 }} />
            ) : (
                <FlatList
                    data={transactions}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
                    ListEmptyComponent={
                        <View style={styles.emptyWrap}>
                            <Ionicons name="receipt-outline" size={48} color="#ddd" />
                            <Text style={styles.emptyText}>ไม่มีรายการในช่วงเวลานี้</Text>
                        </View>
                    }
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            colors={['#F37021']}
                            tintColor="#F37021"
                        />
                    }
                />
            )}

            <AddTransactionModal
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
                onSave={handleSaveTransaction}
            />

            <ReceiptModal
                visible={receiptModalVisible}
                transaction={selectedTransaction}
                onClose={() => setReceiptModalVisible(false)}
                onNewTransaction={() => setReceiptModalVisible(false)}
                onPrint={() => Alert.alert('กำลังพิมพ์...', 'กำลังส่งข้อมูลไปเครื่องพิมพ์')}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },

    // Header
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, paddingBottom: 14, backgroundColor: '#fff',
        borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
    },
    headerTitle: { fontSize: 18, fontWeight: 'bold' },
    backBtn: { padding: 8 },
    addBtn: {
        backgroundColor: '#F37021', width: 36, height: 36,
        borderRadius: 18, justifyContent: 'center', alignItems: 'center',
    },

    // กรองช่วงเวลา
    periodRow: {
        flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12, gap: 8,
        backgroundColor: '#fff',
    },
    chip: {
        flex: 1, paddingVertical: 7, alignItems: 'center',
        borderRadius: 20, backgroundColor: '#F3F4F6',
    },
    chipActive: { backgroundColor: '#F37021' },
    chipText: { fontSize: 12, color: '#666' },
    chipTextActive: { color: '#fff', fontWeight: 'bold' },

    // กรองประเภท
    typeRow: {
        flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, gap: 8,
        backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
    },
    typeChip: {
        paddingVertical: 5, paddingHorizontal: 14,
        borderRadius: 20, borderWidth: 1, borderColor: '#E0E0E0',
    },
    typeChipActive: { borderColor: '#F37021', backgroundColor: '#FFF3EC' },
    typeChipText: { fontSize: 13, color: '#666' },
    typeChipTextActive: { color: '#F37021', fontWeight: 'bold' },

    // สรุปยอด
    summaryRow: {
        flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 10, gap: 8,
    },
    summaryCard: {
        flex: 1, backgroundColor: '#fff', borderRadius: 10,
        padding: 10, borderLeftWidth: 4,
        shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
    },
    summaryLabel: { fontSize: 11, color: '#888', marginBottom: 3 },
    summaryValue: { fontSize: 13, fontWeight: 'bold' },

    // การ์ดรายการ
    card: {
        flexDirection: 'row', backgroundColor: '#fff', padding: 14,
        borderRadius: 12, marginBottom: 8, alignItems: 'center',
        shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
    },
    iconWrap: {
        width: 46, height: 46, borderRadius: 23,
        justifyContent: 'center', alignItems: 'center', marginRight: 12,
    },
    info: { flex: 1, marginRight: 8 },
    category: { fontSize: 15, fontWeight: '600', color: '#222', marginBottom: 2 },
    desc: { fontSize: 13, color: '#888', marginBottom: 3 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    metaText: { fontSize: 11, color: '#aaa' },
    metaDot: { fontSize: 11, color: '#ccc', marginHorizontal: 2 },

    right: { alignItems: 'flex-end', gap: 8 },
    amount: { fontSize: 15, fontWeight: 'bold' },
    actions: { flexDirection: 'row', gap: 12, alignItems: 'center' },

    // Empty
    emptyWrap: { alignItems: 'center', paddingTop: 60 },
    emptyText: { color: '#bbb', marginTop: 12, fontSize: 15 },
});
