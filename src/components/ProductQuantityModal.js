import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Image, TextInput, TouchableWithoutFeedback, Keyboard, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function ProductQuantityModal({ visible, product, onClose, onConfirm }) {
    const [quantity, setQuantity] = useState(1);
    const [inputText, setInputText] = useState('1');

    useEffect(() => {
        if (visible) {
            setQuantity(1);
            setInputText('1');
        }
    }, [visible]);

    const maxQty = parseFloat(product?.stock_qty || 999);
    const handleIncrease = () => {
        setQuantity(prev => {
            const next = prev < maxQty ? prev + 1 : prev;
            setInputText(String(next));
            return next;
        });
    };
    const handleDecrease = () => {
        if (quantity > 1) {
            setQuantity(prev => {
                const next = prev - 1;
                setInputText(String(next));
                return next;
            });
        }
    };

    if (!product) return null;

    return (
        <Modal
            transparent={true}
            visible={visible}
            animationType="fade"
            onRequestClose={onClose}
        >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View style={styles.modalOverlay}>
                    <TouchableWithoutFeedback>
                        <View style={styles.modalContent}>
                            {/* Header */}
                            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                                <Ionicons name="close" size={24} color="#333" />
                            </TouchableOpacity>

                            <View style={styles.productInfoRow}>
                                {/* Image */}
                                <Image
                                    source={{ uri: product.image_url || 'https://via.placeholder.com/150' }}
                                    style={styles.productImage}
                                />

                                {/* Info */}
                                <View style={styles.productDetails}>
                                    <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
                                    <Text style={styles.productPrice}>
                                        ฿{product.price}
                                        <Text style={styles.productUnit}> / {product.unit_type || 'ชิ้น'}</Text>
                                    </Text>
                                    <Text style={{ fontSize: 12, color: '#999', marginTop: 2 }}>คงเหลือ: {product.stock_qty || 0} {product.unit_type || 'ชิ้น'}</Text>
                                </View>
                            </View>

                            {/* Quantity Selector */}
                            <View style={styles.quantityContainer}>
                                <TouchableOpacity onPress={handleDecrease} style={styles.quantityButtonMinus}>
                                    <Ionicons name="remove" size={24} color="#E53935" />
                                </TouchableOpacity>

                                <View style={styles.quantityBox}>
                                    <TextInput
                                        style={styles.quantityText}
                                        keyboardType="number-pad"
                                        value={inputText}
                                        onChangeText={(text) => {
                                            // อนุญาตให้ลบจนว่างได้ ไม่บังคับเลข
                                            setInputText(text.replace(/[^0-9]/g, ''));
                                        }}
                                        onEndEditing={() => {
                                            // ตรวจสอบค่าตอนออกจากแป้นพิมพ์
                                            const num = parseInt(inputText) || 0;
                                            if (num <= 0) {
                                                setQuantity(1);
                                                setInputText('1');
                                            } else if (num > maxQty) {
                                                Alert.alert('เกินจำนวนสต็อก', `"${product.name}" มีสต็อกเพียง ${maxQty} ชิ้น`);
                                                setQuantity(maxQty);
                                                setInputText(String(maxQty));
                                            } else {
                                                setQuantity(num);
                                                setInputText(String(num));
                                            }
                                        }}
                                        selectTextOnFocus={true}
                                    />
                                </View>

                                <TouchableOpacity onPress={handleIncrease} style={[styles.quantityButtonPlus, quantity >= maxQty && { opacity: 0.3 }]} disabled={quantity >= maxQty}>
                                    <Ionicons name="add" size={24} color="#4CAF50" />
                                </TouchableOpacity>
                            </View>

                            {/* Confirm Button */}
                            <TouchableOpacity
                                style={styles.confirmButton}
                                onPress={() => onConfirm(quantity)}
                            >
                                <Text style={styles.confirmButtonText}>ตกลง</Text>
                            </TouchableOpacity>
                        </View>
                    </TouchableWithoutFeedback>
                </View>
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
        width: '85%',
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 20,
        alignItems: 'center',
        elevation: 5,
    },
    closeButton: {
        position: 'absolute',
        top: 15,
        right: 15,
        zIndex: 1,
    },
    productInfoRow: {
        flexDirection: 'row',
        width: '100%',
        marginBottom: 25,
        alignItems: 'center',
    },
    productImage: {
        width: 80,
        height: 80,
        borderRadius: 10,
        backgroundColor: '#f0f0f0',
    },
    productDetails: {
        flex: 1,
        marginLeft: 15,
        justifyContent: 'center',
    },
    productName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 5,
    },
    productPrice: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#4CAF50',
    },
    productUnit: {
        fontSize: 14,
        color: '#999',
        fontWeight: 'normal',
    },
    quantityContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 25,
    },
    quantityButtonMinus: {
        width: 45,
        height: 45,
        borderRadius: 22.5,
        borderWidth: 2,
        borderColor: '#E53935',
        justifyContent: 'center',
        alignItems: 'center',
    },
    quantityButtonPlus: {
        width: 45,
        height: 45,
        borderRadius: 22.5,
        borderWidth: 2,
        borderColor: '#4CAF50',
        justifyContent: 'center',
        alignItems: 'center',
    },
    quantityBox: {
        width: 80,
        height: 45,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f5f5f5',
        borderRadius: 10,
        marginHorizontal: 15,
    },
    quantityText: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
        textAlign: 'center',
        minWidth: 50,
        padding: 0,
    },

    confirmButton: {
        backgroundColor: '#00C853',
        paddingVertical: 12,
        paddingHorizontal: 50,
        borderRadius: 25,
        width: '100%',
        alignItems: 'center',
    },
    confirmButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
});
