import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    TextInput,
    Alert,
    TouchableWithoutFeedback,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function CashPaymentModal({
    visible,
    amount,
    onConfirm,
    onClose,
}) {
    const [receivedAmount, setReceivedAmount] = useState('');
    const [change, setChange] = useState(0);

    // Reset when modal opens
    useEffect(() => {
        if (visible) {
            setReceivedAmount('');
            setChange(0);
        }
    }, [visible]);

    // Calculate change
    useEffect(() => {
        const received = parseFloat(receivedAmount) || 0;
        const total = parseFloat(amount) || 0;
        setChange(received - total);
    }, [receivedAmount, amount]);

    const handleConfirm = () => {
        const received = parseFloat(receivedAmount) || 0;
        const total = parseFloat(amount) || 0;

        if (received < total) {
            Alert.alert('ยอดเงินไม่พอ', 'กรุณารับเงินให้ครบตามจำนวน');
            return;
        }

        onConfirm(received);
    };

    const addAmount = (value) => {
        const current = parseFloat(receivedAmount) || 0;
        setReceivedAmount((current + value).toString());
    };

    const exactAmount = () => {
        setReceivedAmount(amount.toString());
    };

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.modalOverlay}
                >
                    <View style={styles.modalContent}>
                        {/* Header */}
                        <View style={styles.header}>
                            <Text style={styles.headerTitle}>ชำระเงินสด</Text>
                            <TouchableOpacity onPress={onClose}>
                                <Ionicons name="close" size={24} color="#333" />
                            </TouchableOpacity>
                        </View>

                        {/* Amount Display */}
                        <View style={styles.amountDisplay}>
                            <Text style={styles.amountLabel}>ยอดชำระ</Text>
                            <Text style={styles.amountValue}>฿{amount.toLocaleString()}</Text>
                        </View>

                        {/* Input */}
                        <View style={styles.inputContainer}>
                            <Text style={styles.inputLabel}>รับเงินมา</Text>
                            <TextInput
                                style={styles.input}
                                value={receivedAmount}
                                onChangeText={setReceivedAmount}
                                keyboardType="decimal-pad"
                                placeholder="0.00"
                                autoFocus={true}
                            />
                        </View>

                        {/* Quick Buttons */}
                        <View style={styles.quickButtons}>
                            <TouchableOpacity style={styles.quickBtn} onPress={exactAmount}>
                                <Text style={styles.quickBtnText}>พอดี</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.quickBtn} onPress={() => addAmount(20)}>
                                <Text style={styles.quickBtnText}>+20</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.quickBtn} onPress={() => addAmount(100)}>
                                <Text style={styles.quickBtnText}>+100</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.quickBtn} onPress={() => addAmount(500)}>
                                <Text style={styles.quickBtnText}>+500</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.quickBtn} onPress={() => addAmount(1000)}>
                                <Text style={styles.quickBtnText}>+1000</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Change Display */}
                        <View style={[styles.changeContainer, change >= 0 ? styles.changePositive : styles.changeNegative]}>
                            <Text style={styles.changeLabel}>เงินทอน</Text>
                            <Text style={styles.changeValue}>฿{change.toFixed(2)}</Text>
                        </View>

                        {/* Confirm Button */}
                        <TouchableOpacity
                            style={[styles.confirmBtn, (parseFloat(receivedAmount) || 0) < amount && styles.disabledBtn]}
                            onPress={handleConfirm}
                            disabled={(parseFloat(receivedAmount) || 0) < amount}
                        >
                            <Text style={styles.confirmBtnText}>ยืนยันการชำระเงิน</Text>
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </TouchableWithoutFeedback>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        width: '90%',
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 20,
        elevation: 5,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
    },
    amountDisplay: {
        alignItems: 'center',
        marginBottom: 20,
    },
    amountLabel: {
        fontSize: 16,
        color: '#666',
    },
    amountValue: {
        fontSize: 36,
        fontWeight: 'bold',
        color: '#F37021',
    },
    inputContainer: {
        marginBottom: 15,
    },
    inputLabel: {
        fontSize: 14,
        color: '#666',
        marginBottom: 5,
    },
    input: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 10,
        padding: 15,
        fontSize: 24,
        fontWeight: 'bold',
        textAlign: 'right',
        backgroundColor: '#f9f9f9',
    },
    quickButtons: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 20,
        justifyContent: 'center',
    },
    quickBtn: {
        backgroundColor: '#eee',
        paddingVertical: 10,
        paddingHorizontal: 15,
        borderRadius: 20,
    },
    quickBtnText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
    },
    changeContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 15,
        borderRadius: 10,
        marginBottom: 20,
    },
    changePositive: {
        backgroundColor: '#E8F5E9',
    },
    changeNegative: {
        backgroundColor: '#FFEBEE',
    },
    changeLabel: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
    },
    changeValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
    },
    confirmBtn: {
        backgroundColor: '#F37021',
        padding: 15,
        borderRadius: 50,
        alignItems: 'center',
    },
    disabledBtn: {
        backgroundColor: '#ccc',
    },
    confirmBtnText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
});
