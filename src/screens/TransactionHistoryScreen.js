import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getTransactions, createTransaction, deleteTransaction, cancelOrder } from '../services/api';
import AddTransactionModal from '../components/AddTransactionModal';
import { useBluetooth } from '../contexts/BluetoothContext';
import { ReceiptModal } from '../components/payment';

export default function TransactionHistoryScreen({ navigation }) {
    const insets = useSafeAreaInsets();
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // all, income, expense
    const [modalVisible, setModalVisible] = useState(false);
    const { connectedPrinter } = useBluetooth();
    const [receiptModalVisible, setReceiptModalVisible] = useState(false);
    const [selectedTransaction, setSelectedTransaction] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const fetchTransactions = async () => {
        setLoading(true);
        try {
            const res = await getTransactions({ type: filter, limit: 100 });
            if (res.success) {
                setTransactions(res.data);
            }
        } catch (error) {
            console.error(error);
            Alert.alert('ข้อผิดพลาด', 'ไม่สามารถโหลดรายการได้ กรุณาลองใหม่อีกครั้ง');
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        try {
            const res = await getTransactions({ type: filter, limit: 100 });
            if (res.success) {
                setTransactions(res.data);
            }
        } catch (error) {
            Alert.alert('ข้อผิดพลาด', 'ไม่สามารถโหลดรายการได้ กรุณาลองใหม่อีกครั้ง');
        } finally {
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchTransactions();
    }, [filter]);

    const handleSaveTransaction = async (data) => {
        try {
            const res = await createTransaction(data);
            if (res.success) {
                setModalVisible(false);
                fetchTransactions();
            } else {
                Alert.alert('ข้อผิดพลาด', res.error || 'บันทึกรายการไม่สำเร็จ กรุณาลองใหม่');
            }
        } catch (error) {
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
            message = 'รายการนี้เชื่อมโยงกับการชำระหนี้ หากลบอาจส่งผลต่อยอดค้างชำระ คุณต้องการลบต่อหรือไม่?';
        }

        Alert.alert('ยืนยันการลบ', message, [
            { text: 'ยกเลิก', style: 'cancel' },
            {
                text: 'ลบ',
                style: 'destructive',
                onPress: async () => {
                    setIsDeleting(true);
                    try {
                        // ถ้าเป็น sales ที่ linked กับ order → cancel order ด้วย เพื่อให้รายงานอัปเดตถูกต้อง
                        if (isLinkedToSale && item.reference_order_id) {
                            await cancelOrder(item.reference_order_id);
                        }
                        await deleteTransaction(item.id);
                        fetchTransactions();
                    } catch (e) {
                        Alert.alert('ข้อผิดพลาด', 'ลบรายการไม่สำเร็จ กรุณาลองใหม่');
                    } finally {
                        setIsDeleting(false);
                    }
                }
            }
        ]);
    };

    const renderItem = ({ item }) => (
        <View style={styles.card}>
            <View style={styles.iconContainer}>
                <Ionicons 
                    name={item.trans_type === 'income' ? 'arrow-down-circle' : 'arrow-up-circle'} 
                    size={32} 
                    color={item.trans_type === 'income' ? '#4CAF50' : '#F44336'} 
                />
            </View>
            <View style={styles.info}>
                <Text style={styles.category}>{item.category}</Text>
                <Text style={styles.desc} numberOfLines={1}>{item.description || ''}</Text>
                <Text style={styles.date}>{new Date(item.trans_date).toLocaleDateString('th-TH-u-ca-buddhist')}</Text>
            </View>
            <View style={styles.amountContainer}>
                <Text style={[styles.amount, { color: item.trans_type === 'income' ? '#4CAF50' : '#F44336' }]}>
                    {item.trans_type === 'income' ? '+' : '-'} ฿{parseFloat(item.amount).toLocaleString()}
                </Text>
                
                <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                    {/* ปุ่มพิมพ์ใบเสร็จย้อนหลัง (โผล่เฉพาะรายรับเมื่อมีปรินเตอร์) */}
                    {item.trans_type === 'income' && connectedPrinter && (
                        <TouchableOpacity 
                            onPress={() => {
                                // แปลงข้อมูลให้ตรงกับที่ ReceiptModal ต้องการ
                                setSelectedTransaction({
                                    id: item.reference_id || item.id, // ใช้ order_id ถ้ามี
                                    receiptNo: item.order_no || `MANUAL-${item.id}`,
                                    date: new Date(item.trans_date).toLocaleString('th-TH-u-ca-buddhist'),
                                    total: parseFloat(item.amount),
                                    paymentMethod: item.payment_method === 'cash' ? 'เงินสด' : (item.payment_method === 'qr' ? 'Thai QR' : 'อื่นๆ'),
                                    received: parseFloat(item.amount), // สมมติว่ารับเต็ม
                                    change: 0,
                                    // items จะโดนดึงมาอัตโนมัติเมื่อ Modal เปิด (logic ของพี่ทำไว้แล้ว)
                                });
                                setReceiptModalVisible(true);
                            }}
                        >
                            <Ionicons name="print" size={20} color="#0A84FF" />
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={() => handleDelete(item)} disabled={isDeleting}>
                        <Ionicons name="trash-outline" size={18} color={isDeleting ? '#eee' : '#ccc'} />
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#000" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>รายการเดินบัญชี</Text>
                <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.addBtn}>
                    <Ionicons name="add" size={24} color="#fff" />
                </TouchableOpacity>
            </View>

            <View style={styles.filters}>
                {['all', 'income', 'expense'].map(f => (
                    <TouchableOpacity 
                        key={f} 
                        style={[styles.filterChip, filter === f && styles.activeFilter]} 
                        onPress={() => setFilter(f)}
                    >
                        <Text style={[styles.filterText, filter === f && styles.activeFilterText]}>
                            {f === 'all' ? 'ทั้งหมด' : f === 'income' ? 'รายรับ' : 'รายจ่าย'}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {loading ? (
                <ActivityIndicator size="large" color="#F37021" style={{ marginTop: 20 }} />
            ) : (
                <FlatList
                    data={transactions}
                    renderItem={renderItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={{ padding: 20 }}
                    ListEmptyComponent={<Text style={styles.emptyText}>ไม่มีรายการ</Text>}
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
                onPrint={() => Alert.alert('Printing...', 'กำลังส่งข้อมูลไปเครื่องพิมพ์')} 
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 15, backgroundColor: '#fff' },
    headerTitle: { fontSize: 20, fontWeight: 'bold' },
    backBtn: { padding: 8 },
    addBtn: { backgroundColor: '#F37021', width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
    filters: { flexDirection: 'row', paddingHorizontal: 20, paddingTop: 15, gap: 10 },
    filterChip: { paddingVertical: 6, paddingHorizontal: 16, borderRadius: 20, backgroundColor: '#eee' },
    activeFilter: { backgroundColor: '#F37021' },
    filterText: { color: '#666' },
    activeFilterText: { color: '#fff', fontWeight: 'bold' },
    card: { flexDirection: 'row', backgroundColor: '#fff', padding: 15, borderRadius: 12, marginBottom: 10, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
    iconContainer: { marginRight: 15 },
    info: { flex: 1 },
    category: { fontSize: 16, fontWeight: 'bold', color: '#333' },
    desc: { fontSize: 14, color: '#888' },
    date: { fontSize: 12, color: '#aaa', marginTop: 4 },
    amountContainer: { alignItems: 'flex-end', gap: 8 },
    amount: { fontSize: 16, fontWeight: 'bold' },
    emptyText: { textAlign: 'center', color: '#999', marginTop: 50 },
});
