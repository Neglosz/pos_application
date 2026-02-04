import React, { useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    Animated,
    Dimensions,
    ScrollView,
} from 'react-native';
import AntDesign from '@expo/vector-icons/AntDesign';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Mockup store info
const STORE_INFO = {
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
}) {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
    const scaleAnim = useRef(new Animated.Value(0.9)).current;

    // Default transaction data with null safety
    const safeTransaction = transaction || {};
    const {
        receiptNo = 'TXHM123456',
        date = new Date().toLocaleDateString('th-TH', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }),
        paymentMethod = 'เงินสด',
        items = [],
        total = 0,
        received = 0,
        change = 0,
        store = {
            name: 'เจเค ปาร์ค',
            address: '100 ถ.ทุ่งสลา อ.ศรีราชา จ.ชลบุรี',
            phone: '012-xxx-xxxx',
        }
    } = safeTransaction;

    useEffect(() => {
        if (visible) {
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
    }, [visible]);

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

                    {/* Success Icon */}
                    <View style={styles.successContainer}>
                        <View style={styles.successIcon}>
                            <AntDesign name="check-circle" size={50} color="#35E0AD" />
                        </View>
                        <Text style={styles.successTitle}>ชำระเงินสำเร็จ</Text>
                        <Text style={styles.successSubtitle}>ขอบคุณที่ใช้บริการ</Text>
                    </View>

                    {/* Store Info */}
                    <View style={styles.storeInfo}>
                        <Text style={styles.storeName}>{store.name}</Text>
                        <Text style={styles.storeAddress}>{store.address}</Text>
                        <Text style={styles.storePhone}>โทร : {store.phone}</Text>
                    </View>

                    {/* Receipt Details */}
                    <View style={styles.receiptDetails}>
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>เลขที่ :</Text>
                            <Text style={styles.detailValue}>{receiptNo}</Text>
                        </View>
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>วันที่ :</Text>
                            <Text style={styles.detailValue}>{date}</Text>
                        </View>
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>วิธีชำระเงิน :</Text>
                            <Text style={styles.detailValue}>{paymentMethod}</Text>
                        </View>
                    </View>

                    {/* Items */}
                    <View style={styles.itemsContainer}>
                        <ScrollView style={styles.itemsList} nestedScrollEnabled>
                            {items.map((item, index) => (
                                <View key={index} style={styles.itemRow}>
                                    <Text style={styles.itemName}>{item.name} x{item.quantity}</Text>
                                    <Text style={styles.itemPrice}>฿{item.price.toFixed(2)}</Text>
                                </View>
                            ))}
                        </ScrollView>
                    </View>

                    {/* Totals */}
                    <View style={styles.totalsContainer}>
                        <View style={styles.totalRow}>
                            <Text style={styles.totalLabel}>รวมทั้งหมด</Text>
                            <Text style={styles.totalValue}>฿{total.toFixed(2)}</Text>
                        </View>
                        <View style={styles.totalRow}>
                            <Text style={styles.totalLabelSmall}>รับเงิน</Text>
                            <Text style={styles.totalValueSmall}>฿{received.toFixed(2)}</Text>
                        </View>
                        <View style={styles.totalRow}>
                            <Text style={[styles.totalLabelSmall, { color: '#35E0AD' }]}>เงินทอน</Text>
                            <Text style={[styles.totalValueSmall, { color: '#35E0AD' }]}>฿{change.toFixed(2)}</Text>
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
                        <TouchableOpacity
                            style={styles.newTransactionButton}
                            onPress={onNewTransaction}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.newTransactionButtonText}>รายการใหม่</Text>
                            <AntDesign name="arrow-right" size={18} color="#fff" />
                        </TouchableOpacity>
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
        fontSize: 12,
        color: '#666',
        textAlign: 'center',
    },
    storePhone: {
        fontSize: 12,
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
        fontSize: 13,
        color: '#666',
        width: 100,
    },
    detailValue: {
        fontSize: 13,
        color: '#333',
        flex: 1,
    },
    itemsContainer: {
        maxHeight: 120,
        marginBottom: 15,
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
        fontSize: 14,
        color: '#333',
    },
    itemPrice: {
        fontSize: 14,
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
        fontSize: 14,
        color: '#666',
    },
    totalValueSmall: {
        fontSize: 14,
        color: '#666',
    },
    noteText: {
        fontSize: 11,
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
        fontSize: 14,
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
        fontSize: 14,
        fontWeight: '600',
    },
});
