import React, { useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    Animated,
    Dimensions,
    Image,
} from 'react-native';
import AntDesign from '@expo/vector-icons/AntDesign';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Mockup QR Code - using a placeholder
const MOCK_QR_CODE = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=00020101021129370016A000000677010111011300668123456785802TH53037646304';

export default function QRPaymentModal({
    visible,
    amount = 0,
    onConfirm,
    onClose,
}) {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
    const scaleAnim = useRef(new Animated.Value(0.9)).current;

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
                        <Text style={styles.modalTitle}>เลือกวิธีชำระเงิน</Text>
                        <TouchableOpacity
                            onPress={handleClose}
                            style={styles.closeButton}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <AntDesign name="close" size={24} color="#000" />
                        </TouchableOpacity>
                    </View>

                    {/* Amount Display */}
                    <View style={styles.amountContainer}>
                        <Text style={styles.amountLabel}>ยอดชำระทั้งหมด</Text>
                        <Text style={styles.amountValue}>฿ {amount.toFixed(2)}</Text>
                    </View>

                    {/* QR Code Container */}
                    <View style={styles.qrContainer}>
                        <View style={styles.qrCodeWrapper}>
                            <Image
                                source={{ uri: MOCK_QR_CODE }}
                                style={styles.qrCode}
                                resizeMode="contain"
                            />
                        </View>
                        <View style={styles.qrInfo}>
                            <Text style={styles.qrInfoTitle}>แจ้งลูกค้าสแกน QR Code</Text>
                            <Text style={styles.qrInfoAmount}>ยอดที่ต้องชำระ : <Text style={styles.qrAmountHighlight}>฿{amount.toFixed(2)}</Text></Text>
                        </View>
                    </View>

                    {/* Confirm Button */}
                    <TouchableOpacity
                        style={styles.confirmButton}
                        onPress={onConfirm}
                        activeOpacity={0.8}
                    >
                        <AntDesign name="check-circle" size={20} color="#fff" style={{ marginRight: 8 }} />
                        <Text style={styles.confirmButtonText}>ยืนยันได้รับเงินแล้ว</Text>
                    </TouchableOpacity>
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
    },
    closeButton: {
        padding: 4,
    },
    amountContainer: {
        backgroundColor: '#F5F5F5',
        borderRadius: 12,
        padding: 15,
        marginBottom: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    amountLabel: {
        fontSize: 14,
        color: '#666',
    },
    amountValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
    },
    qrContainer: {
        alignItems: 'center',
        marginBottom: 20,
    },
    qrCodeWrapper: {
        backgroundColor: '#fff',
        padding: 15,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: '#E0E0E0',
        marginBottom: 15,
    },
    qrCode: {
        width: 200,
        height: 200,
    },
    qrInfo: {
        alignItems: 'center',
    },
    qrInfoTitle: {
        fontSize: 16,
        color: '#333',
        marginBottom: 5,
    },
    qrInfoAmount: {
        fontSize: 14,
        color: '#666',
    },
    qrAmountHighlight: {
        color: '#4CAF50',
        fontWeight: 'bold',
    },
    confirmButton: {
        backgroundColor: '#35E0AD',
        borderRadius: 25,
        paddingVertical: 15,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    confirmButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});
