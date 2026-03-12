import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, TouchableWithoutFeedback, Alert, Keyboard, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function AddTransactionModal({ visible, onClose, onSave }) {
    const [type, setType] = useState('expense');
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState('');
    const [description, setDescription] = useState('');
    const [date, setDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);

    const handleSave = () => {
        const parsedAmount = parseFloat(amount);
        if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
            Alert.alert('ข้อผิดพลาด', 'กรุณาระบุจำนวนเงินที่มากกว่า 0');
            return;
        }
        if (!category.trim()) {
            Alert.alert('ข้อผิดพลาด', 'กรุณาระบุหมวดหมู่ก่อนบันทึก');
            return;
        }
        onSave({
            trans_type: type,
            amount: parsedAmount,
            category,
            description,
            trans_date: date.toISOString().split('T')[0],
            payment_method: 'cash' // Default for manual entry
        });
        resetForm();
    };

    const resetForm = () => {
        setAmount('');
        setCategory('');
        setDescription('');
        setType('expense');
        setDate(new Date());
    };

    const onDateChange = (event, selectedDate) => {
        if (Platform.OS === 'android') {
            setShowDatePicker(false);
            if (event.type === 'set' && selectedDate) {
                setDate(selectedDate);
            }
        } else {
            // iOS: update live, dismiss via confirm button
            if (selectedDate) setDate(selectedDate);
        }
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View style={styles.overlay}>
                    <TouchableWithoutFeedback>
                        <View style={styles.container}>
                            <Text style={styles.title}>เพิ่มรายการ</Text>

                            <View style={styles.typeSelector}>
                                <TouchableOpacity 
                                    style={[styles.typeBtn, type === 'income' && styles.activeIncome]}
                                    onPress={() => setType('income')}
                                >
                                    <Text style={[styles.typeText, type === 'income' && styles.activeText]}>รายรับ</Text>
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    style={[styles.typeBtn, type === 'expense' && styles.activeExpense]}
                                    onPress={() => setType('expense')}
                                >
                                    <Text style={[styles.typeText, type === 'expense' && styles.activeText]}>รายจ่าย</Text>
                                </TouchableOpacity>
                            </View>

                            <Text style={styles.label}>วันที่</Text>
                            <TouchableOpacity style={styles.input} onPress={() => setShowDatePicker(true)}>
                                <Text>{date.toLocaleDateString('th-TH-u-ca-buddhist')}</Text>
                            </TouchableOpacity>
                            {showDatePicker && Platform.OS === 'android' && (
                                <DateTimePicker
                                    value={date}
                                    mode="date"
                                    display="default"
                                    onChange={onDateChange}
                                />
                            )}

                            <Text style={styles.label}>จำนวนเงิน</Text>
                            <TextInput 
                                style={styles.input} 
                                value={amount} 
                                onChangeText={setAmount} 
                                keyboardType="numeric" 
                                placeholder="0.00"
                            />

                            <Text style={styles.label}>หมวดหมู่ (เช่น ค่าไฟ, ค่าของ)</Text>
                            <TextInput 
                                style={styles.input} 
                                value={category} 
                                onChangeText={setCategory} 
                                placeholder="ระบุหมวดหมู่..."
                            />

                            <Text style={styles.label}>รายละเอียด (Optional)</Text>
                            <TextInput 
                                style={[styles.input, { height: 80 }]} 
                                value={description} 
                                onChangeText={setDescription} 
                                multiline 
                                placeholder="บันทึกเพิ่มเติม..."
                            />

                            <View style={styles.actions}>
                                <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                                    <Text style={styles.cancelText}>ยกเลิก</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                                    <Text style={styles.saveText}>บันทึก</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>

            {/* iOS Date Picker Overlay (inside main modal) */}
            {Platform.OS === 'ios' && showDatePicker && (
                <TouchableWithoutFeedback onPress={() => setShowDatePicker(false)}>
                    <View style={styles.datePickerOverlay}>
                        <TouchableWithoutFeedback>
                            <View style={styles.datePickerContainer}>
                                <View style={styles.datePickerHeader}>
                                    <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                                        <Text style={styles.datePickerCancel}>ยกเลิก</Text>
                                    </TouchableOpacity>
                                    <Text style={styles.datePickerTitle}>เลือกวันที่</Text>
                                    <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                                        <Text style={styles.datePickerDone}>ตกลง</Text>
                                    </TouchableOpacity>
                                </View>
                                <DateTimePicker
                                    value={date}
                                    mode="date"
                                    display="spinner"
                                    onChange={onDateChange}
                                    locale="th-TH"
                                    textColor="#333"
                                    style={{ height: 200 }}
                                />
                            </View>
                        </TouchableWithoutFeedback>
                    </View>
                </TouchableWithoutFeedback>
            )}
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
    container: { backgroundColor: '#fff', borderRadius: 16, padding: 20 },
    title: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
    typeSelector: { flexDirection: 'row', marginBottom: 20, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#eee' },
    typeBtn: { flex: 1, paddingVertical: 12, alignItems: 'center' },
    activeIncome: { backgroundColor: '#4CAF50' },
    activeExpense: { backgroundColor: '#F44336' },
    typeText: { fontSize: 16, color: '#666' },
    activeText: { color: '#fff', fontWeight: 'bold' },
    label: { fontSize: 14, color: '#666', marginBottom: 6, marginTop: 10 },
    input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 16, backgroundColor: '#FAFAFA' },
    actions: { flexDirection: 'row', marginTop: 30, gap: 10 },
    cancelBtn: { flex: 1, padding: 14, borderRadius: 8, backgroundColor: '#f0f0f0', alignItems: 'center' },
    saveBtn: { flex: 1, padding: 14, borderRadius: 8, backgroundColor: '#F37021', alignItems: 'center' },
    cancelText: { color: '#666', fontWeight: 'bold' },
    saveText: { color: '#fff', fontWeight: 'bold' },

    // Date Picker Modal (iOS)
    datePickerOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    datePickerContainer: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingBottom: 30,
    },
    datePickerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    datePickerTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
    },
    datePickerCancel: {
        fontSize: 16,
        color: '#888',
    },
    datePickerDone: {
        fontSize: 16,
        color: '#007AFF',
        fontWeight: '600',
    },
});
