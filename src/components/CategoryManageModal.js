import React, { useState, useEffect } from 'react';
import { View, Text, Modal, StyleSheet, TouchableOpacity, TextInput, FlatList, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getProductCategories, addProductCategory, updateProductCategory, deleteProductCategory } from '../services/api';

export default function CategoryManageModal({ visible, onClose, onSelect, selectedCategoryId }) {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [inputValue, setInputValue] = useState('');

    useEffect(() => {
        if (visible) {
            loadCategories();
            setIsAdding(false);
            setEditingId(null);
            setInputValue('');
        }
    }, [visible]);

    const loadCategories = async () => {
        setLoading(true);
        try {
            const res = await getProductCategories();
            if (res && res.data) {
                setCategories(res.data);
            }
        } catch (error) {
            console.error("Error loading categories:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddCategory = async () => {
        if (!inputValue.trim()) {
            Alert.alert('แจ้งเตือน', 'กรุณากรอกชื่อหมวดหมู่');
            return;
        }
        setLoading(true);
        try {
            const res = await addProductCategory(inputValue.trim());
            if (res.success) {
                await loadCategories();
                setIsAdding(false);
                setInputValue('');
            } else {
                Alert.alert('ข้อผิดพลาด', res.error || 'ไม่สามารถเพิ่มหมวดหมู่ได้');
            }
        } catch (error) {
            Alert.alert('ข้อผิดพลาด', 'เกิดข้อผิดพลาดในการเพิ่มหมวดหมู่');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateCategory = async (id) => {
        if (!inputValue.trim()) {
            Alert.alert('แจ้งเตือน', 'กรุณากรอกชื่อหมวดหมู่');
            return;
        }
        setLoading(true);
        try {
            const res = await updateProductCategory(id, inputValue.trim());
            if (res.success) {
                await loadCategories();
                setEditingId(null);
                setInputValue('');
            } else {
                Alert.alert('ข้อผิดพลาด', res.error || 'ไม่สามารถแก้ไขหมวดหมู่ได้');
            }
        } catch (error) {
            Alert.alert('ข้อผิดพลาด', 'เกิดข้อผิดพลาดในการแก้ไขหมวดหมู่');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteCategory = (id, name) => {
        Alert.alert(
            'ยืนยันการลบ',
            `ต้องการลบหมวดหมู่ "${name}" หรือไม่?`,
            [
                { text: 'ยกเลิก', style: 'cancel' },
                {
                    text: 'ลบ',
                    style: 'destructive',
                    onPress: async () => {
                        setLoading(true);
                        try {
                            const res = await deleteProductCategory(id);
                            if (res.success) {
                                await loadCategories();
                            } else {
                                Alert.alert('ข้อผิดพลาด', res.error || 'ไม่สามารถลบหมวดหมู่ได้');
                            }
                        } catch (error) {
                            Alert.alert('ข้อผิดพลาด', 'เกิดข้อผิดพลาดในการลบหมวดหมู่');
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    const startEdit = (category) => {
        setEditingId(category.id);
        setInputValue(category.name);
        setIsAdding(false);
    };

    const cancelEdit = () => {
        setEditingId(null);
        setIsAdding(false);
        setInputValue('');
    };

    const renderCategory = ({ item }) => {
        const isEditing = editingId === item.id;
        const isSelected = selectedCategoryId === item.id;

        if (isEditing) {
            return (
                <View style={styles.editRow}>
                    <TextInput
                        style={styles.editInput}
                        value={inputValue}
                        onChangeText={setInputValue}
                        placeholder="ชื่อหมวดหมู่"
                        autoFocus
                    />
                    <TouchableOpacity style={styles.saveBtn} onPress={() => handleUpdateCategory(item.id)}>
                        <Ionicons name="checkmark" size={20} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.cancelBtn} onPress={cancelEdit}>
                        <Ionicons name="close" size={20} color="#fff" />
                    </TouchableOpacity>
                </View>
            );
        }

        return (
            <TouchableOpacity
                style={[styles.categoryRow, isSelected && styles.selectedRow]}
                onPress={() => {
                    onSelect(item.id);
                    onClose();
                }}
            >
                <View style={styles.categoryInfo}>
                    {isSelected && <Ionicons name="checkmark-circle" size={20} color="#4CAF50" style={styles.checkIcon} />}
                    <Text style={[styles.categoryName, isSelected && styles.selectedText]}>{item.name}</Text>
                </View>
                <View style={styles.actions}>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => startEdit(item)}>
                        <Ionicons name="pencil" size={18} color="#666" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => handleDeleteCategory(item.id, item.name)}>
                        <Ionicons name="trash" size={18} color="#e74c3c" />
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
            statusBarTranslucent={true}
        >
            <View style={styles.overlay}>
                <View style={styles.container}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.title}>จัดการหมวดหมู่</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={28} color="#000" />
                        </TouchableOpacity>
                    </View>

                    {/* Add New Section */}
                    {isAdding ? (
                        <View style={styles.addSection}>
                            <TextInput
                                style={styles.addInput}
                                value={inputValue}
                                onChangeText={setInputValue}
                                placeholder="ชื่อหมวดหมู่ใหม่"
                                autoFocus
                            />
                            <TouchableOpacity style={styles.addConfirmBtn} onPress={handleAddCategory}>
                                <Text style={styles.addConfirmText}>เพิ่ม</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.addCancelBtn} onPress={cancelEdit}>
                                <Text style={styles.addCancelText}>ยกเลิก</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <TouchableOpacity style={styles.addButton} onPress={() => { setIsAdding(true); setInputValue(''); }}>
                            <Ionicons name="add-circle" size={24} color="#4CAF50" />
                            <Text style={styles.addButtonText}>เพิ่มหมวดหมู่ใหม่</Text>
                        </TouchableOpacity>
                    )}

                    {/* Category List */}
                    {loading ? (
                        <ActivityIndicator size="large" color="#1E2022" style={styles.loader} />
                    ) : categories.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Ionicons name="folder-open-outline" size={48} color="#ccc" />
                            <Text style={styles.emptyText}>ยังไม่มีหมวดหมู่</Text>
                            <Text style={styles.emptySubtext}>กดปุ่มด้านบนเพื่อเพิ่มหมวดหมู่ใหม่</Text>
                        </View>
                    ) : (
                        <FlatList
                            data={categories}
                            keyExtractor={(item) => item.id}
                            renderItem={renderCategory}
                            style={styles.list}
                            showsVerticalScrollIndicator={false}
                        />
                    )}

                    {/* Clear Selection */}
                    {selectedCategoryId && (
                        <TouchableOpacity
                            style={styles.clearButton}
                            onPress={() => {
                                onSelect(null);
                                onClose();
                            }}
                        >
                            <Text style={styles.clearButtonText}>ไม่ระบุหมวดหมู่</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: 20,
    },
    container: {
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 20,
        maxHeight: '80%',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1E2022',
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#f0f9f0',
        borderRadius: 8,
        marginBottom: 15,
    },
    addButtonText: {
        marginLeft: 8,
        color: '#4CAF50',
        fontWeight: '600',
        fontSize: 16,
    },
    addSection: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15,
    },
    addInput: {
        flex: 1,
        backgroundColor: '#f5f5f5',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
    },
    addConfirmBtn: {
        backgroundColor: '#4CAF50',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 8,
        marginLeft: 8,
    },
    addConfirmText: {
        color: '#fff',
        fontWeight: '600',
    },
    addCancelBtn: {
        backgroundColor: '#ccc',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 8,
        marginLeft: 8,
    },
    addCancelText: {
        color: '#333',
    },
    list: {
        flexGrow: 0,
    },
    categoryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 14,
        backgroundColor: '#f8f8f8',
        borderRadius: 8,
        marginBottom: 8,
    },
    selectedRow: {
        backgroundColor: '#e8f5e9',
        borderColor: '#4CAF50',
        borderWidth: 1,
    },
    categoryInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    checkIcon: {
        marginRight: 8,
    },
    categoryName: {
        fontSize: 16,
        color: '#333',
    },
    selectedText: {
        fontWeight: '600',
        color: '#2e7d32',
    },
    actions: {
        flexDirection: 'row',
    },
    actionBtn: {
        padding: 8,
        marginLeft: 4,
    },
    editRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    editInput: {
        flex: 1,
        backgroundColor: '#f5f5f5',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
    },
    saveBtn: {
        backgroundColor: '#4CAF50',
        padding: 10,
        borderRadius: 8,
        marginLeft: 8,
    },
    cancelBtn: {
        backgroundColor: '#e74c3c',
        padding: 10,
        borderRadius: 8,
        marginLeft: 8,
    },
    loader: {
        marginTop: 30,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 40,
    },
    emptyText: {
        marginTop: 12,
        fontSize: 16,
        color: '#666',
    },
    emptySubtext: {
        marginTop: 4,
        fontSize: 14,
        color: '#999',
    },
    clearButton: {
        marginTop: 15,
        padding: 12,
        backgroundColor: '#f0f0f0',
        borderRadius: 8,
        alignItems: 'center',
    },
    clearButtonText: {
        color: '#666',
        fontSize: 14,
    },
});
