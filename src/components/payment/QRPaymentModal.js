import React, { useRef, useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    Animated,
    Dimensions,
    ActivityIndicator,
} from 'react-native';
import AntDesign from '@expo/vector-icons/AntDesign';
import QRCode from 'react-native-qrcode-svg';
import { getQRPayload, getStoreSettings } from '../../services/api';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

export default function QRPaymentModal({
    visible,
    amount = 0,
    onConfirm,
    onClose,
}) {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
    const scaleAnim = useRef(new Animated.Value(0.9)).current;

    const [qrPayload, setQrPayload] = useState(null);
    const [storeInfo, setStoreInfo] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (visible) {
            fetchQRData();
            Animated.parallel([
                Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
                Animated.spring(slideAnim, { toValue: 0, tension: 65, friction: 11, useNativeDriver: true }),
                Animated.spring(scaleAnim, { toValue: 1, tension: 65, friction: 11, useNativeDriver: true }),
            ]).start();
        } else {
            setQrPayload(null);
            Animated.parallel([
                Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
                Animated.timing(slideAnim, { toValue: SCREEN_HEIGHT, duration: 250, useNativeDriver: true }),
                Animated.timing(scaleAnim, { toValue: 0.9, duration: 200, useNativeDriver: true }),
            ]).start();
        }
    }, [visible, amount]);

    const fetchQRData = async () => {
        setLoading(true);
        try {
            // 1. Get Store Info (for name)
            const storeRes = await getStoreSettings();
            if (storeRes.success) setStoreInfo(storeRes.data);

            // 2. Get QR Payload from Backend
            const qrRes = await getQRPayload(amount);
            if (qrRes.success) {
                setQrPayload(qrRes.payload);
            } else {
                console.error('QR Payload Error:', qrRes.error);
            }
        } catch (error) {
            console.error('Fetch QR Data Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
            Animated.timing(slideAnim, { toValue: SCREEN_HEIGHT, duration: 250, useNativeDriver: true }),
        ]).start(() => onClose?.());
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
                    <TouchableOpacity style={styles.overlayTouchable} activeOpacity={1} onPress={handleClose} />
                </Animated.View>

                {/* Content */}
                <Animated.View style={[styles.modalContent, { transform: [{ translateY: slideAnim }, { scale: scaleAnim }], opacity: fadeAnim }]}>
                    {/* Header */}
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Thai QR Payment</Text>
                        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                            <AntDesign name="close" size={24} color="#000" />
                        </TouchableOpacity>
                    </View>

                    {/* Amount */}
                    <View style={styles.amountContainer}>
                        <Text style={styles.amountLabel}>ยอดชำระเงิน</Text>
                        <Text style={styles.amountValue}>฿ {amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                    </View>

                    {/* QR Code Section */}
                    <View style={styles.qrSection}>
                        {loading ? (
                            <ActivityIndicator size="large" color="#007AFF" />
                        ) : qrPayload ? (
                            <View style={styles.qrWrapper}>
                                <View style={styles.promptpayLogo}>
                                    <Text style={styles.promptpayText}>Prompt Pay</Text>
                                </View>
                                <QRCode
                                    value={qrPayload}
                                    size={SCREEN_WIDTH * 0.6}
                                    color="black"
                                    backgroundColor="white"
                                />
                                <Text style={styles.accountName}>{storeInfo?.promptpay_name || 'ไม่ระบุชื่อบัญชี'}</Text>
                            </View>
                        ) : (
                            <View style={styles.errorContainer}>
                                <AntDesign name="exclamationcircleo" size={40} color="#FF3B30" />
                                <Text style={styles.errorText}>ไม่สามารถสร้าง QR Code ได้</Text>
                                <Text style={styles.errorSubText}>กรุณาตรวจสอบการตั้งค่าพร้อมเพย์</Text>
                            </View>
                        )}
                    </View>

                    {/* Instructions */}
                    <View style={styles.instructions}>
                        <Text style={styles.instructionText}>• ลูกค้าสแกนเพื่อโอนเงิน</Text>
                        <Text style={styles.instructionText}>• ตรวจสอบยอดเงินและชื่อบัญชีให้ถูกต้อง</Text>
                    </View>

                    {/* Footer Buttons */}
                    <View style={styles.footer}>
                        <TouchableOpacity style={styles.confirmButton} onPress={onConfirm}>
                            <Text style={styles.confirmButtonText}>ยืนยันการรับเงิน</Text>
                            <AntDesign name="check" size={20} color="#fff" style={{ marginLeft: 8 }} />
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
        borderRadius: 24,
        padding: 24,
        width: '90%',
        maxWidth: 450,
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
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
    },
    closeButton: {
        padding: 4,
    },
    amountContainer: {
        alignItems: 'center',
        marginBottom: 24,
    },
    amountLabel: {
        fontSize: 14,
        color: '#666',
        marginBottom: 4,
    },
    amountValue: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#000',
    },
    qrSection: {
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: SCREEN_WIDTH * 0.7,
        backgroundColor: '#f9f9f9',
        borderRadius: 16,
        padding: 20,
        marginBottom: 24,
    },
    qrWrapper: {
        alignItems: 'center',
    },
    promptpayLogo: {
        backgroundColor: '#003764',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 4,
        marginBottom: 10,
    },
    promptpayText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14,
    },
    accountName: {
        marginTop: 15,
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },
    errorContainer: {
        alignItems: 'center',
    },
    errorText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#FF3B30',
        marginTop: 10,
    },
    errorSubText: {
        fontSize: 13,
        color: '#666',
        marginTop: 4,
    },
    instructions: {
        marginBottom: 24,
    },
    instructionText: {
        fontSize: 13,
        color: '#666',
        marginBottom: 4,
    },
    footer: {
        flexDirection: 'row',
        gap: 12,
    },
    confirmButton: {
        flex: 1,
        backgroundColor: '#007AFF',
        borderRadius: 14,
        paddingVertical: 16,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    confirmButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
