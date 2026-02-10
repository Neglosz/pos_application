import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getTransactions, createTransaction, deleteTransaction } from '../services/api';
import AddTransactionModal from '../components/AddTransactionModal';

export default function TransactionHistoryScreen({ navigation }) {
    const insets = useSafeAreaInsets();
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // all, income, expense
    const [modalVisible, setModalVisible] = useState(false);

    const fetchTransactions = async () => {
        setLoading(true);
        try {
            const res = await getTransactions({ type: filter, limit: 100 });
            if (res.success) {
                setTransactions(res.data);
            }
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Failed to fetch transactions');
        } finally {
            setLoading(false);
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
                Alert.alert('Error', res.error || 'Failed to save');
            }
        } catch (error) {
            Alert.alert('Error', 'Network error');
        }
    };

    const handleDelete = (id) => {
        Alert.alert('Confirm', 'Are you sure you want to delete this transaction?', [
            { text: 'Cancel', style: 'cancel' },
            { 
                text: 'Delete', 
                style: 'destructive', 
                onPress: async () => {
                    await deleteTransaction(id);
                    fetchTransactions();
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
                <Text style={styles.date}>{new Date(item.trans_date).toLocaleDateString('th-TH')}</Text>
            </View>
            <View style={styles.amountContainer}>
                <Text style={[styles.amount, { color: item.trans_type === 'income' ? '#4CAF50' : '#F44336' }]}>
                    {item.trans_type === 'income' ? '+' : '-'} ฿{parseFloat(item.amount).toLocaleString()}
                </Text>
                {/* Only allow deleting manual entries if needed, or all. For now allow all for owner/manager */}
                <TouchableOpacity onPress={() => handleDelete(item.id)}>
                    <Ionicons name="trash-outline" size={18} color="#ccc" />
                </TouchableOpacity>
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
                />
            )}

            <AddTransactionModal 
                visible={modalVisible} 
                onClose={() => setModalVisible(false)} 
                onSave={handleSaveTransaction} 
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
