import React, { useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    Animated,
    Dimensions,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import AntDesign from '@expo/vector-icons/AntDesign';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function PaymentMethodModal({
    visible,
    amount = 0,
    onSelectCash,
    onSelectQR,
    onSelectDebt,
    onClose,
    hideDebtOption = false,
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

                    {/* Payment Options */}
                    <View style={styles.optionsContainer}>
                        {/* Cash Option */}
                        <TouchableOpacity
                            style={styles.optionButton}
                            onPress={onSelectCash}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.optionIcon, { backgroundColor: '#E8F5E9' }]}>
                                <MaterialCommunityIcons name="cash" size={28} color="#4CAF50" />
                            </View>
                            <View style={styles.optionTextContainer}>
                                <Text style={styles.optionTitle}>เงินสด</Text>
                                <Text style={styles.optionSubtitle}>รับเงินสดจากลูกค้า</Text>
                            </View>
                            <AntDesign name="right" size={20} color="#ccc" />
                        </TouchableOpacity>

                        {/* QR PromptPay Option */}
                        <TouchableOpacity
                            style={styles.optionButton}
                            onPress={onSelectQR}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.optionIcon, { backgroundColor: '#E3F2FD' }]}>
                                <MaterialCommunityIcons name="qrcode-scan" size={28} color="#2196F3" />
                            </View>
                            <View style={styles.optionTextContainer}>
                                <Text style={styles.optionTitle}>Thai QR PromptPay</Text>
                                <Text style={styles.optionSubtitle}>สแกน QR code</Text>
                            </View>
                            <AntDesign name="right" size={20} color="#ccc" />
                        </TouchableOpacity>

                        {/* Debt/Credit Option */}
                        {!hideDebtOption && (
                            <TouchableOpacity
                                style={styles.optionButton}
                                onPress={onSelectDebt}
                                activeOpacity={0.7}
                            >
                                <View style={[styles.optionIcon, { backgroundColor: '#FFF3E0' }]}>
                                    <MaterialCommunityIcons name="account-clock" size={28} color="#FF9800" />
                                </View>
                                <View style={styles.optionTextContainer}>
                                    <Text style={styles.optionTitle}>เชื่อ/ค้างชำระ</Text>
                                    <Text style={styles.optionSubtitle}>ลูกค้าค้างจ่าย</Text>
                                </View>
                                <AntDesign name="right" size={20} color="#ccc" />
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
    optionsContainer: {
        gap: 12,
    },
    optionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 15,
        borderWidth: 1,
        borderColor: '#E0E0E0',
    },
    optionIcon: {
        width: 50,
        height: 50,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    optionTextContainer: {
        flex: 1,
    },
    optionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 2,
    },
    optionSubtitle: {
        fontSize: 13,
        color: '#888',
    },
});
