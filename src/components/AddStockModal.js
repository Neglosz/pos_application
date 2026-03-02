import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, Modal, StyleSheet, TouchableOpacity, TextInput, Image, ScrollView, Platform, KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard, Alert, ActivityIndicator } from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getProductCategories, addProduct, getProductByBarcode, addProductBatch, getCurrentStoreId } from '../services/api';
import { uploadProductImage, isLocalUri } from '../services/supabaseStorage';
import CategoryManageModal from './CategoryManageModal';

export default function AddStockModal({ visible, onClose, onConfirm, scannedCode }) {
    // Mode: 'loading', 'new', 'restock'
    const [mode, setMode] = useState('loading');
    const [existingProduct, setExistingProduct] = useState(null);

    // Form fields
    const [name, setName] = useState('');
    const [quantity, setQuantity] = useState('');
    const [costPrice, setCostPrice] = useState('');
    const [salePrice, setSalePrice] = useState('');
    const [lowStockThreshold, setLowStockThreshold] = useState('');
    const [categoryId, setCategoryId] = useState(null);
    const [image, setImage] = useState(null);
    const [unitType, setUnitType] = useState('ชิ้น');
    const [expireDate, setExpireDate] = useState(null);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [loading, setLoading] = useState(false);
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [fieldErrors, setFieldErrors] = useState({});

    // Datas
    const [categories, setCategories] = useState([]);

    useEffect(() => {
        let cancelToken = { cancelled: false };
        if (visible && scannedCode) {
            // เรียกตรวจสอบบาร์โค้ดจาก API ใหม่ทุกครั้งที่เปิด Modal
            checkExistingProduct(scannedCode, cancelToken);
            loadCategories();
        }
        return () => {
            cancelToken.cancelled = true;
        };
    }, [visible, scannedCode]);

    const checkExistingProduct = async (code, cancelToken) => {
        setMode('loading');
        try {
            const res = await getProductByBarcode(code);
            // ป้องกัน race condition: ถ้า effect ถูก cleanup แล้ว ไม่ต้อง set state
            if (cancelToken.cancelled) return;
            if (res.success && res.exists) {
                // Product exists - restock mode
                setExistingProduct(res.data);
                setMode('restock');
                // Pre-fill prices from existing
                setCostPrice(res.data.cost_price?.toString() || '');
                setSalePrice(res.data.price?.toString() || '');
                // Reset batch-specific fields
                setQuantity('');
                setExpireDate(null);
            } else {
                // New product mode
                setExistingProduct(null);
                setMode('new');
                resetForm();
            }
        } catch (error) {
            if (cancelToken.cancelled) return;
            console.error("Error checking product:", error);
            setMode('new');
            resetForm();
        }
    };

    const resetForm = () => {
        setName('');
        setQuantity('');
        setCostPrice('');
        setSalePrice('');
        setLowStockThreshold('');
        setCategoryId(null);
        setImage(null);
        setUnitType('ชิ้น');
        setExpireDate(null);
        setFieldErrors({});
    };

    const loadCategories = async () => {
        try {
            const res = await getProductCategories();
            if (res && res.data) {
                setCategories(res.data);
            }
        } catch (error) {
            console.log("Error loading categories:", error);
        }
    };

    const pickImage = async () => {
        Alert.alert(
            "เพิ่มรูปสินค้า",
            "เลือกแหล่งที่มาของรูปภาพ",
            [
                {
                    text: "ถ่ายรูป",
                    onPress: async () => {
                        const permission = await ImagePicker.requestCameraPermissionsAsync();
                        if (permission.granted) {
                            let result = await ImagePicker.launchCameraAsync({
                                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                                allowsEditing: true,
                                aspect: [1, 1],
                                quality: 0.5,
                            });
                            if (!result.canceled) {
                                setImage(result.assets[0].uri);
                            }
                        } else {
                            alert("ต้องการสิทธิ์การเข้าถึงกล้อง");
                        }
                    }
                },
                {
                    text: "เลือกจากอัลบั้ม",
                    onPress: async () => {
                        let result = await ImagePicker.launchImageLibraryAsync({
                            mediaTypes: ImagePicker.MediaTypeOptions.Images,
                            allowsEditing: true,
                            aspect: [1, 1],
                            quality: 0.5,
                        });
                        if (!result.canceled) {
                            setImage(result.assets[0].uri);
                        }
                    }
                },
                {
                    text: "ยกเลิก",
                    style: "cancel"
                }
            ]
        );
    };

    const handleConfirmNew = async () => {
        // Validate required fields with red borders
        const errors = {};
        if (!name) errors.name = true;
        if (!quantity) errors.quantity = true;
        if (!costPrice) errors.costPrice = true;
        if (!salePrice) errors.salePrice = true;
        if (!lowStockThreshold) errors.lowStockThreshold = true;
        if (!expireDate) errors.expireDate = true;
        if (Object.keys(errors).length > 0) {
            setFieldErrors(errors);
            return;
        }
        setFieldErrors({});

        // Confirm if no image
        if (!image) {
            Alert.alert(
                'ไม่มีรูปสินค้า',
                'ไม่ต้องการเพิ่มรูปภาพใช่ไหม?',
                [
                    { text: 'กลับไปเพิ่มรูป', style: 'cancel' },
                    { text: 'ไม่ใส่รูป', onPress: () => doConfirmNew() }
                ]
            );
            return;
        }

        doConfirmNew();
    };

    const doConfirmNew = async () => {
        setLoading(true);
        try {
            let imageUrl = null;

            // Upload image to Supabase Storage if exists
            if (image && isLocalUri(image)) {
                const storeId = getCurrentStoreId();
                if (!storeId) {
                    alert('ไม่พบ Store ID');
                    setLoading(false);
                    return;
                }

                const uploadResult = await uploadProductImage(image, storeId);
                if (uploadResult.success) {
                    imageUrl = uploadResult.url;
                } else {
                    console.error('Image upload failed:', uploadResult.error);
                    // Continue without image
                }
            }

            const productData = {
                code: scannedCode,
                name,
                categoryId,
                quantity: parseFloat(quantity) || 0,
                costPrice: parseFloat(costPrice) || 0,
                salePrice: parseFloat(salePrice) || 0,
                lowStockThreshold: parseFloat(lowStockThreshold) || 0,
                unitType: unitType || 'ชิ้น',
                expireDate,
                imageUrl, // Supabase URL instead of local image
            };

            const res = await addProduct(productData);
            if (res.success) {
                onConfirm({
                    ...res.data,
                    addedQty: parseFloat(quantity) || 0,
                    isNew: true
                });
            } else {
                alert('เกิดข้อผิดพลาด: ' + (res.error || 'Unknown error'));
            }
        } catch (error) {
            alert('เกิดข้อผิดพลาดในการบันทึก');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmRestock = async () => {
        const errors = {};
        if (!quantity) errors.quantity = true;
        if (!expireDate) errors.expireDate = true;
        if (Object.keys(errors).length > 0) {
            setFieldErrors(errors);
            return;
        }
        setFieldErrors({});
        setLoading(true);
        try {
            const day = expireDate.getDate().toString().padStart(2, '0');
            const month = (expireDate.getMonth() + 1).toString().padStart(2, '0');
            const year = expireDate.getFullYear();

            const batchData = {
                quantity: parseFloat(quantity) || 0,
                costPrice: parseFloat(costPrice) || 0,
                salePrice: parseFloat(salePrice) || 0,
                expireDate: `${day}/${month}/${year}`
            };

            const res = await addProductBatch(existingProduct.id, batchData);
            if (res.success) {
                onConfirm({
                    ...existingProduct,
                    addedQty: res.data.addedQty,
                    newStockQty: res.data.newStockQty,
                    isNew: false
                });
            } else {
                alert('เกิดข้อผิดพลาด: ' + (res.error || 'Unknown error'));
            }
        } catch (error) {
            alert('เกิดข้อผิดพลาดในการเติมสต็อก');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const onDateChange = (event, selectedDate) => {
        if (Platform.OS === 'android') {
            setShowDatePicker(false);
            if (event.type === 'set' && selectedDate) {
                setExpireDate(selectedDate);
            }
        } else {
            // iOS: update live, dismiss via confirm button
            if (selectedDate) setExpireDate(selectedDate);
        }
    };

    const renderLoading = () => (
        <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#1E2022" />
            <Text style={styles.loadingText}>กำลังตรวจสอบสินค้า...</Text>
        </View>
    );

    const renderRestockMode = () => (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Existing Product Info */}
            <View style={styles.existingProductCard}>
                <View style={styles.existingHeader}>
                    <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
                    <Text style={styles.existingTitle}>พบสินค้าในระบบ</Text>
                </View>
                <View style={styles.existingInfo}>
                    <Text style={styles.productName}>{existingProduct?.name}</Text>
                    <Text style={styles.productDetail}>
                        หมวดหมู่: {existingProduct?.product_categories?.name || 'ไม่ระบุ'}
                    </Text>
                    <Text style={styles.productDetail}>
                        สต็อกปัจจุบัน: {existingProduct?.stock_qty || 0} ชิ้น
                    </Text>
                    <Text style={styles.productDetail}>
                        ราคาขาย: ฿{existingProduct?.price?.toFixed(2) || '0.00'}
                    </Text>
                </View>
            </View>

            {/* Restock Form */}
            <Text style={styles.sectionTitle}>เติมสต็อก (Lot ใหม่)</Text>

            <View style={styles.inputGroup}>
                <Text style={[styles.label, fieldErrors.quantity && styles.errorLabel]}>จำนวนที่เติม *</Text>
                <TextInput
                    style={[styles.input, fieldErrors.quantity && styles.errorInput]}
                    value={quantity}
                    onChangeText={(text) => {
                        setQuantity(text);
                        // ถ้าพิมพ์ค่าเข้าไปใหม่ ให้เอาขอบแดงออก
                        setFieldErrors(prev => ({ ...prev, quantity: false }));
                    }}
                    keyboardType="numeric"
                    placeholder="0"
                />
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>ราคาทุน (Lot นี้)</Text>
                <TextInput
                    style={styles.input}
                    value={costPrice}
                    onChangeText={setCostPrice}
                    keyboardType="numeric"
                    placeholder="0.00"
                />
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>ราคาขาย (อัพเดททุก Lot)</Text>
                <TextInput
                    style={styles.input}
                    value={salePrice}
                    onChangeText={setSalePrice}
                    keyboardType="numeric"
                    placeholder={existingProduct?.price?.toString() || '0.00'}
                />
            </View>

            <View style={styles.inputGroup}>
                <Text style={[styles.label, fieldErrors.expireDate && styles.errorLabel]}>วันหมดอายุ (Lot นี้) *</Text>
                <TouchableOpacity
                    style={[styles.dateInput, fieldErrors.expireDate && styles.errorInput]}
                    onPress={() => setShowDatePicker(true)}
                >
                    <Text style={[styles.dateText, !expireDate && { color: '#999' }]}>
                        {expireDate ? expireDate.toLocaleDateString('th-TH') : 'เลือกวันหมดอายุ'}
                    </Text>
                    <Ionicons name="calendar-outline" size={20} color="#666" />
                </TouchableOpacity>
                {showDatePicker && Platform.OS === 'android' && (
                    <DateTimePicker
                        value={expireDate || new Date()}
                        mode="date"
                        display="default"
                        onChange={onDateChange}
                        locale="th-TH"
                    />
                )}
            </View>

            <TouchableOpacity
                style={[styles.saveButton, styles.restockButton]}
                onPress={handleConfirmRestock}
                disabled={loading}
            >
                {loading ? (
                    <ActivityIndicator color="#fff" />
                ) : (
                    <>
                        <Ionicons name="add-circle" size={22} color="#fff" style={{ marginRight: 8 }} />
                        <Text style={styles.saveButtonText}>เติมสต็อก</Text>
                    </>
                )}
            </TouchableOpacity>

            <View style={{ height: 20 }} />
        </ScrollView>
    );

    const renderNewMode = () => (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* New Product Notice */}
            <View style={styles.newProductCard}>
                <View style={styles.existingHeader}>
                    <Ionicons name="bag-add" size={24} color="#2196F3" />
                    <Text style={styles.newTitle}>สินค้าใหม่</Text>
                </View>
                <Text style={styles.newSubtitle}>กรุณากรอกข้อมูลสินค้า</Text>
            </View>

            {/* Top Section: Image & Basic Info */}
            <View style={styles.topSection}>
                <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
                    {image ? (
                        <Image source={{ uri: image }} style={styles.image} />
                    ) : (
                        <View style={styles.placeholderImage}>
                            <Ionicons name="camera-outline" size={32} color="#999" />
                            <Text style={styles.imagePickerLabel}>เพิ่มรูป</Text>
                        </View>
                    )}
                </TouchableOpacity>

                <View style={styles.basicInfo}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>รหัสสินค้า</Text>
                        <TextInput
                            style={[styles.input, styles.readOnlyInput]}
                            value={scannedCode}
                            editable={false}
                        />
                    </View>
                    <View style={styles.inputGroup}>
                        <Text style={[styles.label, fieldErrors.name && styles.errorLabel]}>ชื่อสินค้า *</Text>
                        <TextInput
                            style={[styles.input, fieldErrors.name && styles.errorInput]}
                            value={name}
                            onChangeText={(text) => { setName(text); setFieldErrors(prev => ({ ...prev, name: false })); }}
                            placeholder="ชื่อสินค้า"
                        />
                    </View>
                </View>
            </View>

            {/* Row 2: Category & Quantity */}
            <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
                    <Text style={styles.label}>หมวดหมู่</Text>
                    <TouchableOpacity
                        style={styles.pickerContainer}
                        onPress={() => setShowCategoryModal(true)}
                    >
                        <Text style={styles.pickerText}>
                            {categoryId ? categories.find(c => c.id === categoryId)?.name : 'เลือกหมวดหมู่'}
                        </Text>
                        <Ionicons name="chevron-down" size={20} color="#666" />
                    </TouchableOpacity>

                    <CategoryManageModal
                        visible={showCategoryModal}
                        onClose={() => {
                            setShowCategoryModal(false);
                            loadCategories();
                        }}
                        onSelect={(id) => setCategoryId(id)}
                        selectedCategoryId={categoryId}
                    />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={[styles.label, fieldErrors.quantity && styles.errorLabel]}>จำนวน *</Text>
                    <TextInput
                        style={[styles.input, fieldErrors.quantity && styles.errorInput]}
                        value={quantity}
                        onChangeText={(text) => { setQuantity(text); setFieldErrors(prev => ({ ...prev, quantity: false })); }}
                        keyboardType="numeric"
                        placeholder="0"
                    />
                </View>
            </View>

            {/* Row: Unit Type */}
            <View style={styles.inputGroup}>
                <Text style={styles.label}>หน่วย</Text>
                <TextInput
                    style={styles.input}
                    value={unitType}
                    onChangeText={setUnitType}
                    placeholder="ชิ้น, กก., ขวด, ลัง..."
                />
            </View>

            {/* Row 3: Cost & Sale Price */}
            <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
                    <Text style={[styles.label, fieldErrors.costPrice && styles.errorLabel]}>ราคาทุน *</Text>
                    <TextInput
                        style={[styles.input, fieldErrors.costPrice && styles.errorInput]}
                        value={costPrice}
                        onChangeText={(text) => { setCostPrice(text); setFieldErrors(prev => ({ ...prev, costPrice: false })); }}
                        keyboardType="numeric"
                        placeholder="0.00"
                    />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={[styles.label, fieldErrors.salePrice && styles.errorLabel]}>ราคาขาย *</Text>
                    <TextInput
                        style={[styles.input, fieldErrors.salePrice && styles.errorInput]}
                        value={salePrice}
                        onChangeText={(text) => { setSalePrice(text); setFieldErrors(prev => ({ ...prev, salePrice: false })); }}
                        keyboardType="numeric"
                        placeholder="0.00"
                    />
                </View>
            </View>

            {/* Row 4: Expiry Date */}
            <View style={styles.inputGroup}>
                <Text style={[styles.label, fieldErrors.expireDate && styles.errorLabel]}>วันหมดอายุ *</Text>
                <TouchableOpacity
                    style={[styles.dateInput, fieldErrors.expireDate && styles.errorInput]}
                    onPress={() => setShowDatePicker(true)}
                >
                    <Text style={[styles.dateText, !expireDate && { color: '#999' }]}>
                        {expireDate ? expireDate.toLocaleDateString('th-TH') : 'เลือกวันหมดอายุ'}
                    </Text>
                    <Ionicons name="calendar-outline" size={20} color="#666" />
                </TouchableOpacity>
                {showDatePicker && Platform.OS === 'android' && (
                    <DateTimePicker
                        value={expireDate || new Date()}
                        mode="date"
                        display="default"
                        onChange={onDateChange}
                        locale="th-TH"
                    />
                )}
            </View>

            {/* Row 5: Low Stock Threshold */}
            <View style={styles.inputGroup}>
                <Text style={[styles.label, fieldErrors.lowStockThreshold && styles.errorLabel]}>แจ้งเตือนเมื่อสต็อกต่ำกว่า *</Text>
                <TextInput
                    style={[styles.input, fieldErrors.lowStockThreshold && styles.errorInput]}
                    value={lowStockThreshold}
                    onChangeText={(text) => { setLowStockThreshold(text); setFieldErrors(prev => ({ ...prev, lowStockThreshold: false })); }}
                    keyboardType="numeric"
                    placeholder="เช่น 10 (ชิ้น)"
                />
            </View>

            <TouchableOpacity
                style={styles.saveButton}
                onPress={handleConfirmNew}
                disabled={loading}
            >
                {loading ? (
                    <ActivityIndicator color="#fff" />
                ) : (
                    <Text style={styles.saveButtonText}>เพิ่มสินค้าใหม่</Text>
                )}
            </TouchableOpacity>

            <View style={{ height: 20 }} />
        </ScrollView>
    );

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
            statusBarTranslucent={true}
        >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View style={styles.centeredView}>
                    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                        <KeyboardAvoidingView
                            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                            style={styles.modalView}
                        >
                            <View style={styles.header}>
                                <Text style={styles.modalTitle}>
                                    {mode === 'restock' ? 'เติมสต็อก' : 'เพิ่มสินค้า'}
                                </Text>
                                <TouchableOpacity onPress={onClose}>
                                    <Ionicons name="close" size={28} color="#000" />
                                </TouchableOpacity>
                            </View>

                            {mode === 'loading' && renderLoading()}
                            {mode === 'restock' && renderRestockMode()}
                            {mode === 'new' && renderNewMode()}
                        </KeyboardAvoidingView>
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
                                    <Text style={styles.datePickerTitle}>เลือกวันหมดอายุ</Text>
                                    <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                                        <Text style={styles.datePickerDone}>ตกลง</Text>
                                    </TouchableOpacity>
                                </View>
                                <DateTimePicker
                                    value={expireDate || new Date()}
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
    centeredView: {
        flex: 1,
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        padding: 20,
    },
    modalView: {
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
        maxHeight: '90%',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
    },
    modalTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1E2022',
    },
    content: {
        width: '100%',
    },
    loadingContainer: {
        padding: 40,
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: '#666',
    },
    // Existing Product Card
    existingProductCard: {
        backgroundColor: '#e8f5e9',
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
        borderLeftWidth: 4,
        borderLeftColor: '#4CAF50',
    },
    existingHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    existingTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#2e7d32',
        marginLeft: 8,
    },
    existingInfo: {
        marginLeft: 32,
    },
    productName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 4,
    },
    productDetail: {
        fontSize: 14,
        color: '#666',
        marginTop: 2,
    },
    // New Product Card
    newProductCard: {
        backgroundColor: '#e3f2fd',
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
        borderLeftWidth: 4,
        borderLeftColor: '#2196F3',
    },
    newTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1565c0',
        marginLeft: 8,
    },
    newSubtitle: {
        marginLeft: 32,
        color: '#666',
        fontSize: 14,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 15,
    },
    topSection: {
        flexDirection: 'row',
        marginBottom: 15,
    },
    imagePicker: {
        width: 100,
        height: 100,
        backgroundColor: '#f8f8f8',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
        overflow: 'hidden',
        borderWidth: 1.5,
        borderColor: '#ddd',
        borderStyle: 'dashed',
    },
    placeholderImage: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    imagePickerLabel: {
        fontSize: 12,
        color: '#999',
        marginTop: 4,
    },
    image: {
        width: '100%',
        height: '100%',
    },
    basicInfo: {
        flex: 1,
        justifyContent: 'space-between',
    },
    inputGroup: {
        marginBottom: 12,
    },
    label: {
        fontSize: 14,
        color: '#333',
        marginBottom: 6,
    },
    input: {
        backgroundColor: '#f5f5f5',
        borderRadius: 8,
        padding: 10,
        fontSize: 16,
        color: '#333',
        borderWidth: 1,
        borderColor: 'transparent',
    },
    errorInput: {
        borderColor: '#EF5350',
        backgroundColor: '#FFF5F5',
    },
    errorLabel: {
        color: '#EF5350',
    },
    readOnlyInput: {
        color: '#666',
        backgroundColor: '#eee',
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    pickerContainer: {
        backgroundColor: '#f5f5f5',
        borderRadius: 8,
        padding: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    pickerText: {
        fontSize: 16,
        color: '#333',
    },
    dateInput: {
        backgroundColor: '#f5f5f5',
        borderRadius: 8,
        padding: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    dateText: {
        fontSize: 16,
        color: '#333',
    },
    saveButton: {
        backgroundColor: '#1E2022',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        marginTop: 10,
        flexDirection: 'row',
        justifyContent: 'center',
    },
    restockButton: {
        backgroundColor: '#4CAF50',
    },
    saveButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 18,
    },

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
