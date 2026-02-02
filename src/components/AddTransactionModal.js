import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, TouchableWithoutFeedback, Alert } from 'react-native';
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
        if (!amount || !category) {
            Alert.alert('Error', 'Please fill Amount and Category');
            return;
        }
        onSave({
            trans_type: type,
            amount: parseFloat(amount),
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

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <TouchableWithoutFeedback onPress={onClose}>
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
                                <Text>{date.toLocaleDateString('th-TH')}</Text>
                            </TouchableOpacity>
                            {showDatePicker && (
                                <DateTimePicker
                                    value={date}
                                    mode="date"
                                    display="default"
                                    onChange={(event, selectedDate) => {
                                        setShowDatePicker(false);
                                        if (selectedDate) setDate(selectedDate);
                                    }}
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
});
