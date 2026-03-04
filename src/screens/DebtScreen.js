import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Modal, Animated, Dimensions, KeyboardAvoidingView, Platform, FlatList, Keyboard, TouchableWithoutFeedback, Image, ActivityIndicator } from 'react-native';
import { AntDesign, Ionicons, Feather } from '@expo/vector-icons';
import { PaymentMethodModal, QRPaymentModal, ReceiptModal } from '../components/payment';
import { getCustomersWithDebt, createCreditPayment, getCustomerPendingBills } from '../services/api';
import { useFocusEffect } from '@react-navigation/native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const getAvatarColor = (name) => {
    if (!name) return '#FF8A65';
    const colors = ['#FFAB91', '#F48FB1', '#90CAF9', '#80CBC4', '#FFE082', '#BCAAA4'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
};

export default function DebtScreen() {
    const [modalVisible, setModalVisible] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [selectedDebtor, setSelectedDebtor] = useState(null);
    const [paymentAmount, setPaymentAmount] = useState('0.00');
    const [searchText, setSearchText] = useState('');

    // Data from API
    const [debtors, setDebtors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [pendingBills, setPendingBills] = useState([]);
    const [filterType, setFilterType] = useState('all');

    const filterOptions = [
        { id: 'all', label: 'ทั้งหมด' },
        { id: 'nearDue', label: 'ใกล้ครบกำหนด' },
        { id: 'overDue', label: 'เกินกำหนด' },
    ];

    // Fetch data when screen is focused (auto-refresh)
    useFocusEffect(
        useCallback(() => {
            fetchDebtData();
        }, [])
    );

    const fetchDebtData = async () => {
        try {
            setLoading(true);
            const response = await getCustomersWithDebt();
            if (response.success) {
                setDebtors(response.data);
            } else {
                setError('ไม่สามารถโหลดข้อมูลได้');
            }
        } catch (error) {
            setError('ไม่สามารถเชื่อมต่อ Server ได้');
        } finally {
            setLoading(false);
        }
    };

    // Format date for display
    const formatDate = (dateString, format = 'short') => {
        if (!dateString) return '-';
        const date = new Date(dateString);
        if (format === 'full') {
            return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
        }
        return date.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' });
    };

    const getFilterCounts = () => {
        let nearDue = 0;
        let overDue = 0;
        debtors.forEach(debtor => {
            if (!debtor.due_date) return;
            const dueDate = new Date(debtor.due_date);
            const today = new Date();
            // Reset time part for accurate day calculation
            today.setHours(0, 0, 0, 0);
            dueDate.setHours(0, 0, 0, 0);

            const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));

            if (diffDays < 0) overDue++;
            else if (diffDays <= 3) nearDue++;
        });
        return { all: debtors.length, nearDue, overDue };
    };

    const filterCounts = getFilterCounts();

    const getFilteredDebtors = () => {
        let result = debtors;
        if (searchText.trim()) {
            result = result.filter(d => d.name?.toLowerCase().includes(searchText.toLowerCase()));
        }

        if (filterType === 'all') return result;

        return result.filter(debtor => {
            return result.filter(debtor => {
                if (!debtor.due_date) return false;
                const dueDate = new Date(debtor.due_date);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                dueDate.setHours(0, 0, 0, 0);

                const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));

                if (filterType === 'nearDue') return diffDays >= 0 && diffDays <= 3;
                if (filterType === 'overDue') return diffDays < 0;
                return false;
            });
        });
    };

    const filteredDebtors = getFilteredDebtors();

    // Payment flow states
    const [paymentMethodVisible, setPaymentMethodVisible] = useState(false);
    const [qrPaymentVisible, setQRPaymentVisible] = useState(false);
    const [receiptVisible, setReceiptVisible] = useState(false);
    const [currentTransaction, setCurrentTransaction] = useState(null);

    // Animation values
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
    const scaleAnim = useRef(new Animated.Value(0.9)).current;

    // Summary values from API
    const totalDebt = debtors.reduce((sum, d) => sum + (parseFloat(d.total_debt) || 0), 0);

    // Open modal with animation
    const openModal = async (debtor) => {
        setSelectedDebtor(debtor);
        setPaymentAmount('0.00');
        setPendingBills([]);
        setShowModal(true);
        setModalVisible(true);

        try {
            const response = await getCustomerPendingBills(debtor.id);
            if (response.success) {
                setPendingBills(response.data);
            }
        } catch (error) {
            console.error('Error fetching bills:', error);
        }

        // Run animations in parallel
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
            Animated.spring(slideAnim, { toValue: 0, tension: 65, friction: 11, useNativeDriver: true }),
            Animated.spring(scaleAnim, { toValue: 1, tension: 65, friction: 11, useNativeDriver: true }),
        ]).start();
    };

    // Close modal with animation
    const closeModal = (callback) => {
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
            Animated.timing(slideAnim, { toValue: SCREEN_HEIGHT, duration: 250, useNativeDriver: true }),
            Animated.timing(scaleAnim, { toValue: 0.9, duration: 200, useNativeDriver: true }),
        ]).start(() => {
            setModalVisible(false);
            setShowModal(false);
            if (!callback) {
                setSelectedDebtor(null);
                setPaymentAmount('0.00');
            }
            if (callback) callback();
        });
    };

    const handleEdit = (debtor) => {
        openModal(debtor);
    };

    const handlePayFull = () => {
        if (selectedDebtor) {
            setPaymentAmount((selectedDebtor.total_debt || 0).toFixed(2));
        }
    };

    const handleConfirm = () => {
        // Close debt modal and open payment method modal
        closeModal(() => {
            setPaymentMethodVisible(true);
        });
    };

    const handleCancel = () => {
        closeModal();
    };

    // Payment flow handlers
    const handleSelectCash = async () => {
        setPaymentMethodVisible(false);
        const payment = parseFloat(paymentAmount) || 0;

        // Call API to record payment
        try {
            await createCreditPayment({
                customer_id: selectedDebtor.id,
                amount: payment,
                payment_method: 'cash'
            });
            // Refresh data after payment
            fetchDebtData();
            // Close modal after successful payment
            setModalVisible(false);
        } catch (err) {
            console.error('Payment error:', err);
        }

        // Create transaction data for receipt
        setCurrentTransaction({
            receiptNo: `TXHM${Date.now().toString().slice(-6)}`,
            date: new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
            paymentMethod: 'เงินสด',
            items: [{
                name: `ชำระหนี้ - ${selectedDebtor?.name || 'ลูกค้า'}`,
                quantity: 1,
                price: payment
            }],
            total: payment,
            received: payment,
            change: 0,
        });
        setReceiptVisible(true);
    };

    const handleSelectQR = () => {
        setPaymentMethodVisible(false);
        setQRPaymentVisible(true);
    };

    const handleQRConfirm = async () => {
        setQRPaymentVisible(false);
        const payment = parseFloat(paymentAmount) || 0;

        try {
            await createCreditPayment({
                customer_id: selectedDebtor.id,
                amount: payment,
                payment_method: 'qr'
            });
            fetchDebtData();
            setModalVisible(false);
        } catch (err) {
            console.error('Payment error:', err);
        }

        setCurrentTransaction({
            receiptNo: `TXHM${Date.now().toString().slice(-6)}`,
            date: new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
            paymentMethod: 'Thai QR PromptPay',
            items: [{
                name: `ชำระหนี้ - ${selectedDebtor?.name || 'ลูกค้า'}`,
                quantity: 1,
                price: payment
            }],
            total: payment,
            received: payment,
            change: 0,
        });
        setReceiptVisible(true);
    };

    const handlePrint = () => console.log('Printing receipt...');

    const handleNewTransaction = () => {
        setReceiptVisible(false);
        setCurrentTransaction(null);
        setSelectedDebtor(null);
        setPaymentAmount('0.00');
    };

    const getRemainingBalance = () => {
        const totalAmount = pendingBills.reduce((sum, bill) => sum + (parseFloat(bill.remaining_amount) || 0), 0);
        const payment = parseFloat(paymentAmount) || 0;
        return Math.max(0, totalAmount - payment).toFixed(2);
    };

    const getLatestDueDate = (debtor) => {
        return debtor.due_date;
    };

    const getStatusInfo = (debtor) => {
        if (!debtor.accounts || debtor.accounts.length === 0) return { label: 'ปกติ', color: '#4CAF50', bg: '#E8F5E9' };

        if (!debtor.due_date) return { label: 'ปกติ', color: '#4CAF50', bg: '#E8F5E9' };

        const dueDate = new Date(debtor.due_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        dueDate.setHours(0, 0, 0, 0);

        const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));

        if (diffDays < 0) return { label: 'เกินกำหนด', color: '#D32F2F', bg: '#FFEBEE' };
        if (diffDays <= 3) return { label: 'ใกล้ครบกำหนด', color: '#F57F17', bg: '#FFF8E1' };

        return { label: 'ปกติ', color: '#4CAF50', bg: '#E8F5E9' };
    };

    return (
        <View style={styles.container}>
            {loading ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color="#F37021" />
                    <Text style={{ marginTop: 10, color: '#888' }}>กำลังโหลดข้อมูล...</Text>
                </View>
            ) : (
                <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                    {/* Unified Dashboard Card */}
                    <View style={styles.dashboardCard}>
                        <View style={styles.dashboardTop}>
                            <View>
                                <Text style={styles.dashboardLabel}>ยอดค้างชำระทั้งหมด</Text>
                                <Text style={styles.dashboardTotalAmount}>฿{totalDebt.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</Text>
                            </View>
                            <View style={styles.walletIconContainer}>
                                <Ionicons name="wallet-outline" size={24} color="#F37021" />
                            </View>
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.dashboardStatsRow}>
                            <View style={styles.statItem}>
                                <View style={[styles.statIconCircle, { backgroundColor: '#212121' }]}>
                                    <Feather name="users" size={16} color="#fff" />
                                </View>
                                <View style={styles.statTextContainer}>
                                    <Text style={styles.statValue}>{filterCounts.all}</Text>
                                    <Text style={styles.statLabel}>รายการทั้งหมด</Text>
                                </View>
                            </View>
                            <View style={styles.statItem}>
                                <View style={[styles.statIconCircle, { backgroundColor: '#FFF8E1' }]}>
                                    <Feather name="alert-circle" size={16} color="#F57F17" />
                                </View>
                                <View style={styles.statTextContainer}>
                                    <Text style={[styles.statValue, { color: '#F57F17' }]}>{filterCounts.nearDue}</Text>
                                    <Text style={styles.statLabel}>ใกล้ครบกำหนด</Text>
                                </View>
                            </View>
                        </View>
                    </View>

                    {/* Search & Filter Section */}
                    <View style={styles.searchSection}>
                        <View style={styles.searchBar}>
                            <Feather name="search" size={20} color="#666" style={styles.searchIcon} />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="ค้นหาชื่อ, เบอร์โทร..."
                                placeholderTextColor="#666"
                                value={searchText}
                                onChangeText={setSearchText}
                            />
                        </View>

                        <View style={styles.filterRow}>
                            {filterOptions.map(option => {
                                const isActive = filterType === option.id;
                                const count = filterCounts[option.id];
                                return (
                                    <TouchableOpacity
                                        key={option.id}
                                        style={[styles.filterPill, isActive && styles.filterPillActive]}
                                        onPress={() => setFilterType(option.id)}
                                    >
                                        <Text style={[styles.filterText, isActive && styles.filterTextActive]}>{option.label}</Text>
                                        <View style={[styles.filterCountBadge, isActive && styles.filterCountBadgeActive]}>
                                            <Text style={[styles.filterCountText, isActive && styles.filterCountTextActive]}>{count}</Text>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>

                    {/* Debtors List */}
                    <View style={styles.listSection}>
                        {filteredDebtors.map((debtor) => {
                            const status = getStatusInfo(debtor);
                            const latestDue = getLatestDueDate(debtor);
                            return (
                                <TouchableOpacity key={debtor.id} style={styles.debtorCard} onPress={() => handleEdit(debtor)}>
                                    <View style={styles.cardHeader}>
                                        <View style={styles.userInfo}>
                                            {debtor.image_url ? (
                                                <Image source={{ uri: debtor.image_url }} style={[styles.avatar, { backgroundColor: '#f0f0f0' }]} />
                                            ) : (
                                                <View style={[styles.avatar, { backgroundColor: getAvatarColor(debtor.name) }]}>
                                                    <Text style={styles.avatarText}>{debtor.name ? debtor.name.charAt(0).toUpperCase() : '?'}</Text>
                                                </View>
                                            )}
                                            <View>
                                                <Text style={styles.userName}>{debtor.name}</Text>
                                                <Text style={styles.userPhone}>
                                                    <Feather name="phone" size={12} /> {debtor.phone || 'ไม่ระบุเบอร์'}
                                                </Text>
                                            </View>
                                        </View>
                                        <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                                            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                                        </View>
                                    </View>

                                    <View style={styles.cardFooter}>
                                        <View>
                                            <Text style={styles.debtLabel}>ยอดค้าง</Text>
                                            <Text style={styles.debtAmount}>฿{parseFloat(debtor.total_debt).toLocaleString()}</Text>
                                        </View>
                                        {latestDue && (
                                            <View style={styles.dueContainer}>
                                                <Feather name="clock" size={14} color="#F57F17" style={{ marginRight: 4 }} />
                                                <View style={styles.dueTextContainer}>
                                                    <Text style={styles.dueLabel}>ครบกำหนด</Text>
                                                    <Text style={styles.dueValue}>{formatDate(latestDue, 'full')}</Text>
                                                </View>
                                            </View>
                                        )}
                                        <TouchableOpacity style={styles.cardArrow} onPress={() => handleEdit(debtor)}>
                                            <Feather name="chevron-right" size={20} color="#ccc" />
                                        </TouchableOpacity>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                        <View style={{ height: 100 }} />
                    </View>
                </ScrollView>
            )}

            {/* Edit Modal */}
            <Modal
                animationType="none"
                transparent={true}
                visible={showModal}
                onRequestClose={handleCancel}
                statusBarTranslucent={true}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.modalWrapper}
                >
                    <Animated.View style={[styles.modalOverlay, { opacity: fadeAnim }]}>
                        <TouchableOpacity style={styles.overlayTouchable} activeOpacity={1} onPress={handleCancel} />
                    </Animated.View>
                    <Animated.View style={[styles.modalContent, { transform: [{ translateY: slideAnim }, { scale: scaleAnim }], opacity: fadeAnim }]}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>ชำระหนี้</Text>
                            <TouchableOpacity onPress={handleCancel} style={styles.closeButton}>
                                <AntDesign name="close" size={24} color="#000" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                                <View>
                                    <View style={styles.customerInfoModal}>
                                        {selectedDebtor?.image_url ? (
                                            <Image source={{ uri: selectedDebtor.image_url }} style={[styles.avatarLarge, { backgroundColor: '#f0f0f0' }]} />
                                        ) : (
                                            <View style={[styles.avatarLarge, { backgroundColor: getAvatarColor(selectedDebtor?.name || '') }]}>
                                                <Text style={styles.avatarTextLarge}>{selectedDebtor?.name ? selectedDebtor.name.charAt(0).toUpperCase() : '?'}</Text>
                                            </View>
                                        )}
                                        <Text style={styles.customerNameModal}>คุณ{selectedDebtor?.name || '-'}</Text>
                                    </View>
                                    <View style={styles.billsContainer}>
                                        <View style={styles.billsHeader}>
                                            <Text style={styles.billsTitle}>รายการค้างชำระ</Text>
                                            <View style={styles.billsTotalContainer}>
                                                <Text style={styles.billsTotalAmount}>รวม ฿{pendingBills.reduce((sum, bill) => sum + (parseFloat(bill.remaining_amount) || 0), 0).toFixed(2)}</Text>
                                            </View>
                                        </View>
                                        <ScrollView style={styles.billsList} nestedScrollEnabled={true}>
                                            {pendingBills.map((bill) => (
                                                <View key={bill.id} style={styles.billItem}>
                                                    <Text style={{ fontSize: 16 }}>บิล #{bill.order_id ? bill.order_id.slice(0, 8) : bill.id}</Text>
                                                    <Text style={{ fontSize: 16 }}>฿{parseFloat(bill.total_debt).toFixed(2)}</Text>
                                                </View>
                                            ))}
                                        </ScrollView>
                                    </View>
                                    <View style={styles.paymentSection}>
                                        <Text style={styles.paymentLabel}>จำนวนที่ชำระ(บาท)</Text>
                                        <View style={styles.paymentInputContainer}>
                                            <TextInput
                                                style={styles.paymentInput}
                                                value={paymentAmount}
                                                onChangeText={setPaymentAmount}
                                                keyboardType="numeric"
                                                placeholder="0.00"
                                            />
                                            <TouchableOpacity style={styles.fullAmountButton} onPress={handlePayFull}>
                                                <Text style={styles.fullAmountText}>เต็มจำนวน</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                    <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
                                        <Text style={styles.confirmButtonText}>ยืนยันการชำระ</Text>
                                    </TouchableOpacity>
                                </View>
                            </TouchableWithoutFeedback>
                        </ScrollView>
                    </Animated.View>
                </KeyboardAvoidingView>
            </Modal>

            <PaymentMethodModal visible={paymentMethodVisible} amount={parseFloat(paymentAmount) || 0} onSelectCash={handleSelectCash} onSelectQR={handleSelectQR} onClose={() => setPaymentMethodVisible(false)} hideDebtOption={true} />
            <QRPaymentModal visible={qrPaymentVisible} amount={parseFloat(paymentAmount) || 0} onConfirm={handleQRConfirm} onClose={() => setQRPaymentVisible(false)} />
            <ReceiptModal visible={receiptVisible} transaction={currentTransaction} onPrint={handlePrint} onNewTransaction={handleNewTransaction} onClose={() => setReceiptVisible(false)} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    content: { flex: 1, padding: 20 },

    // Dashboard Card
    dashboardCard: {
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 20,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#eee',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 3,
    },
    dashboardTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    dashboardLabel: {
        fontSize: 18,
        color: '#666',
        marginBottom: 4,
    },
    dashboardTotalAmount: {
        fontSize: 36,
        fontWeight: 'bold',
        color: '#1E2022',
    },
    walletIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 16,
        backgroundColor: '#FFF3E0',
        justifyContent: 'center',
        alignItems: 'center',
    },
    divider: {
        height: 1,
        backgroundColor: '#f0f0f0',
        marginVertical: 16,
    },
    dashboardStatsRow: {
        flexDirection: 'row',
        gap: 20,
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statIconCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    statTextContainer: {
    },
    statValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1E2022',
    },
    statLabel: {
        fontSize: 16,
        color: '#888',
    },

    // Search & Filter
    searchSection: {
        marginBottom: 20,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff', // Dark background
        borderRadius: 16,
        paddingHorizontal: 16,
        height: 50,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 3,
    },
    searchIcon: {
        marginRight: 10,
    },
    searchInput: {
        flex: 1,
        color: '#000',
        fontSize: 16,
    },
    filterRow: {
        flexDirection: 'row',
        justifyContent: 'flex-start',
        gap: 10,
    },
    filterPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 20,
        paddingVertical: 8,
        paddingHorizontal: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    filterPillActive: {
        backgroundColor: '#F37021',
    },
    filterText: {
        color: '#000',
        fontSize: 16,
        fontWeight: '600',
        marginRight: 6,
    },
    filterTextActive: {
        color: '#fff',
    },
    filterCountBadge: {
        backgroundColor: '#fff',
        borderRadius: 10,
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    filterCountBadgeActive: {
        backgroundColor: '#fff',
    },
    filterCountText: {
        color: '#000',
        fontSize: 14,
        fontWeight: 'bold',
    },

    // List Items
    listSection: {
        gap: 12,
    },
    debtorCard: {
        backgroundColor: '#FFF8F0',
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: '#FFF3E0',
        marginBottom: 12,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    avatarText: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
    },
    userName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1E2022',
        marginBottom: 2,
    },
    userPhone: {
        fontSize: 16,
        color: '#666',
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusText: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.05)',
    },
    debtLabel: {
        fontSize: 16,
        color: '#888',
        marginBottom: 2,
    },
    debtAmount: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1E2022',
    },
    dueContainer: {
        backgroundColor: '#FFF3E0',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
    },
    dueTextContainer: {
        marginLeft: 4,
    },
    dueLabel: {
        fontSize: 16,
        color: '#F57F17',
        fontWeight: 'bold',
    },
    dueValue: {
        fontSize: 16,
        color: '#1E2022',
    },
    cardArrow: {
        padding: 4,
    },
    // Modal Styles
    modalWrapper: {
        flex: 1, justifyContent: 'flex-end'
    },
    modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
    overlayTouchable: { flex: 1 },
    modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, height: '80%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 20, fontWeight: 'bold' },
    customerInfoModal: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    avatarLarge: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
    avatarTextLarge: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
    customerNameModal: { fontSize: 18, fontWeight: 'bold' },
    billsContainer: { backgroundColor: '#f9f9f9', padding: 16, borderRadius: 12, maxHeight: 200, marginBottom: 20 },
    billsHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
    billsTitle: { fontWeight: '600', fontSize: 18 },
    billsTotalAmount: { fontWeight: 'bold', color: '#F37021', fontSize: 18 },
    billsList: { maxHeight: 150 },
    billItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#eee' },
    paymentSection: { marginBottom: 20 },
    paymentLabel: { fontSize: 18, marginBottom: 8, color: '#666' },
    paymentInputContainer: { flexDirection: 'row', gap: 10 },
    paymentInput: { flex: 1, height: 50, borderWidth: 1, borderColor: '#eee', borderRadius: 12, paddingHorizontal: 16, fontSize: 18 },
    fullAmountButton: { backgroundColor: '#1E2022', justifyContent: 'center', paddingHorizontal: 20, borderRadius: 12 },
    fullAmountText: { color: '#fff', fontSize: 18 },
    confirmButton: { backgroundColor: '#F37021', height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
    confirmButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});