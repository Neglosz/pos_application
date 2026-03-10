import React, { useRef, useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    Animated,
    Dimensions,
    ScrollView,
    ActivityIndicator,
    Alert
} from 'react-native';
import AntDesign from '@expo/vector-icons/AntDesign';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { getOrderDetails } from '../../services/api';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Mockup store info (Default fallback)
const DEFAULT_STORE = {
    name: 'เจเค ปาร์ค',
    address: '100 ถ.ทุ่งสลา อ.ศรีราชา จ.ชลบุรี',
    phone: '012-xxx-xxxx',
};

export default function ReceiptModal({
    visible,
    transaction,
    onPrint,
    onNewTransaction,
    onClose,
    onCancelOrder,
}) {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
    const scaleAnim = useRef(new Animated.Value(0.9)).current;

    const [details, setDetails] = useState(transaction || {});
    const [loadingDetails, setLoadingDetails] = useState(false);

    useEffect(() => {
        if (visible) {
            // Reset to initial passed transaction
            setDetails(transaction || {});

            // Check if we need to fetch full details (if items are missing)
            if (transaction && transaction.id && (!transaction.items || transaction.items.length === 0)) {
                fetchFullDetails(transaction.id);
            }

            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.spring(slideAnim, {
                    toValue: 0,
                    tension: 65,
                    friction: 11,
                    useNativeDriver: true,
                }),
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    tension: 65,
                    friction: 11,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                }),
                Animated.timing(slideAnim, {
                    toValue: SCREEN_HEIGHT,
                    duration: 250,
                    useNativeDriver: true,
                }),
                Animated.timing(scaleAnim, {
                    toValue: 0.9,
                    duration: 200,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [visible, transaction]);

    const fetchFullDetails = async (id) => {
        setLoadingDetails(true);
        try {
            const res = await getOrderDetails(id);
            if (res.success) {
                // Merge new details with existing info (preserve ID, etc)
                setDetails(prev => ({ ...prev, ...res.data }));
            }
        } catch (error) {
            console.log("Failed to load receipt details", error);
        } finally {
            setLoadingDetails(false);
        }
    };

    const handleCancelOrder = () => {
        Alert.alert(
            'ยืนยันการยกเลิกบิล',
            'บิลนี้จะถูกยกเลิกและยอดขายจะถูกปรับ คุณแน่ใจหรือไม่?',
            [
                { text: 'ไม่ใช่', style: 'cancel' },
                { text: 'ยืนยัน ยกเลิกบิล', style: 'destructive', onPress: () => onCancelOrder?.() }
            ]
        );
    };

    const handleClose = () => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: SCREEN_HEIGHT,
                duration: 250,
                useNativeDriver: true,
            }),
        ]).start(() => {
            onClose?.();
        });
    };

    // Safe destructuring with defaults
    const {
        receiptNo = 'TX...',
        date = '',
        paymentMethod = '',
        items = [],
        total = 0,
        received = 0,
        change = 0,
        store = DEFAULT_STORE
    } = details;

    return (
        <Modal
            animationType="none"
            transparent={true}
            visible={visible}
            onRequestClose={handleClose}
            statusBarTranslucent={true}
        >
            <View style={styles.modalWrapper}>
                {/* Overlay */}
                <Animated.View style={[styles.modalOverlay, { opacity: fadeAnim }]}>
                    <TouchableOpacity
                        style={styles.overlayTouchable}
                        activeOpacity={1}
                        onPress={handleClose}
                    />
                </Animated.View>

                {/* Content */}
                <Animated.View
                    style={[
                        styles.modalContent,
                        {
                            transform: [
                                { translateY: slideAnim },
                                { scale: scaleAnim }
                            ],
                            opacity: fadeAnim,
                        }
                    ]}
                >
                    {/* Header */}
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>ใบเสร็จรับเงิน</Text>
                        <TouchableOpacity
                            onPress={handleClose}
                            style={styles.closeButton}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <AntDesign name="close" size={24} color="#000" />
                        </TouchableOpacity>
                    </View>

                    {/* Store Info */}
                    <View style={styles.storeInfo}>
                        <Text style={styles.storeName}>{store?.name || DEFAULT_STORE.name}</Text>
                        <Text style={styles.storeAddress}>{store?.address || DEFAULT_STORE.address}</Text>
                        <Text style={styles.storePhone}>โทร : {store?.phone || DEFAULT_STORE.phone}</Text>
                    </View>

                    {/* Receipt Details */}
                    <View style={styles.receiptDetails}>
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>เลขที่ :</Text>
                            <Text style={styles.detailValue}>{receiptNo || transaction?.orderNo}</Text>
                        </View>
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>วันที่ :</Text>
                            <Text style={styles.detailValue}>{date || transaction?.date}</Text>
                        </View>
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>วิธีชำระเงิน :</Text>
                            <Text style={styles.detailValue}>{paymentMethod}</Text>
                        </View>
                    </View>

                    {/* Items */}
                    <View style={styles.itemsContainer}>
                        {/* Table Header */}
                        <View style={styles.itemHeader}>
                            <Text style={[styles.itemHeaderText, { flex: 1 }]}>ชื่อสินค้า</Text>
                            <Text style={styles.itemHeaderText}>ราคา</Text>
                            <Text style={[styles.itemHeaderText, { minWidth: 70, textAlign: 'right' }]}>รวม</Text>
                        </View>
                        {loadingDetails ? (
                            <View style={{ padding: 20, alignItems: 'center' }}>
                                <ActivityIndicator size="small" color="#F37021" />
                                <Text style={{ color: '#999', fontSize: 12, marginTop: 5 }}>กำลังโหลดรายการ...</Text>
                            </View>
                        ) : (
                            <ScrollView style={styles.itemsList} nestedScrollEnabled>
                                {items.map((item, index) => (
                                    <View key={index} style={styles.itemRow}>
                                        <Text style={[styles.itemName, { flex: 1 }]}>{item.name} x{item.quantity} {item.unit || 'ชิ้น'}</Text>
                                        <Text style={styles.itemPrice}>{item.price.toFixed(1)}</Text>
                                        <Text style={styles.itemTotal}>{(item.price * item.quantity).toFixed(1)}</Text>
                                    </View>
                                ))}
                            </ScrollView>
                        )}
                    </View>

                    {/* Totals */}
                    <View style={styles.totalsContainer}>
                        <View style={styles.totalRow}>
                            <Text style={styles.totalLabel}>รวมทั้งหมด</Text>
                            <Text style={styles.totalValue}>฿{(total || transaction?.amount || 0).toLocaleString()}</Text>
                        </View>
                        <View style={styles.totalRow}>
                            <Text style={styles.totalLabelSmall}>รับเงิน</Text>
                            <Text style={styles.totalValueSmall}>฿{received.toLocaleString()}</Text>
                        </View>
                        <View style={styles.totalRow}>
                            <Text style={[styles.totalLabelSmall, { color: '#35E0AD' }]}>เงินทอน</Text>
                            <Text style={[styles.totalValueSmall, { color: '#35E0AD' }]}>฿{change.toLocaleString()}</Text>
                        </View>
                    </View>

                    {/* Note */}
                    <Text style={styles.noteText}>*** กรุณาเก็บใบเสร็จไว้เป็นหลักฐาน ***</Text>

                    {/* Action Buttons */}
                    <View style={styles.actionButtons}>
                        <TouchableOpacity
                            style={styles.printButton}
                            onPress={onPrint}
                            activeOpacity={0.8}
                        >
                            <MaterialCommunityIcons name="printer" size={20} color="#fff" />
                            <Text style={styles.printButtonText}>พิมพ์</Text>
                        </TouchableOpacity>
                        {onCancelOrder ? (
                            <TouchableOpacity
                                style={styles.cancelOrderButton}
                                onPress={handleCancelOrder}
                                activeOpacity={0.8}
                            >
                                <AntDesign name="close" size={20} color="#fff" />
                                <Text style={styles.cancelOrderButtonText}>ยกเลิกบิล</Text>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity
                                style={styles.newTransactionButton}
                                onPress={onNewTransaction}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.newTransactionButtonText}>รายการใหม่</Text>
                                <AntDesign name="arrow-right" size={18} color="#fff" />
                            </TouchableOpacity>
                        )}
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalWrapper: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    overlayTouchable: {
        flex: 1,
    },
    modalContent: {
        position: 'absolute',
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 20,
        width: '90%',
        maxWidth: 400,
        maxHeight: '90%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    closeButton: {
        padding: 4,
    },
    successContainer: {
        alignItems: 'center',
        marginBottom: 15,
    },
    successIcon: {
        marginBottom: 10,
    },
    successTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#35E0AD',
        marginBottom: 2,
    },
    successSubtitle: {
        fontSize: 14,
        color: '#888',
    },
    storeInfo: {
        alignItems: 'center',
        marginBottom: 15,
        paddingBottom: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
        borderStyle: 'dashed',
    },
    storeName: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 3,
    },
    storeAddress: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
    },
    storePhone: {
        fontSize: 14,
        color: '#666',
    },
    receiptDetails: {
        marginBottom: 15,
    },
    detailRow: {
        flexDirection: 'row',
        marginBottom: 5,
    },
    detailLabel: {
        fontSize: 16,
        color: '#666',
        width: 100,
    },
    detailValue: {
        fontSize: 16,
        color: '#333',
        flex: 1,
    },
    itemsContainer: {
        maxHeight: 120,
        marginBottom: 15,
    },
    itemHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingBottom: 8,
        marginBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
        borderStyle: 'dashed',
    },
    itemHeaderText: {
        fontSize: 16,
        color: '#000',
        fontWeight: '600',
    },
    itemsList: {
        flexGrow: 0,
    },
    itemRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    itemName: {
        fontSize: 16,
        color: '#333',
    },
    itemTotal: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        minWidth: 70,
        textAlign: 'right',
    },
    itemPrice: {
        fontSize: 16,
        color: '#333',
    },
    totalsContainer: {
        borderTopWidth: 1,
        borderTopColor: '#E0E0E0',
        paddingTop: 15,
        marginBottom: 10,
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 5,
    },
    totalLabel: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
    },
    totalValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
    },
    totalLabelSmall: {
        fontSize: 16,
        color: '#666',
    },
    totalValueSmall: {
        fontSize: 16,
        color: '#666',
    },
    noteText: {
        fontSize: 14,
        color: '#888',
        textAlign: 'center',
        marginBottom: 15,
    },
    actionButtons: {
        flexDirection: 'row',
        gap: 10,
    },
    printButton: {
        flex: 1,
        backgroundColor: '#4A90D9',
        borderRadius: 25,
        paddingVertical: 12,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
    },
    printButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
    newTransactionButton: {
        flex: 1,
        backgroundColor: '#35E0AD',
        borderRadius: 25,
        paddingVertical: 12,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
    },
    newTransactionButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
    cancelOrderButton: {
        flex: 1,
        backgroundColor: '#EF4444',
        borderRadius: 25,
        paddingVertical: 12,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
    },
    cancelOrderButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
});
