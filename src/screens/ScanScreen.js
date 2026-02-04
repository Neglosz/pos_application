import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Vibration, ActivityIndicator, Dimensions, Image, TextInput, ScrollView, FlatList, Animated, Platform } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Audio } from 'expo-av';
import { Ionicons, FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';

// Stores
import { useProductStore } from '../stores/useProductStore';
import { useCartStore } from '../stores/useCartStore';

// API
import { createCreditSale, createSale } from '../services/api';

// Components
import { PaymentMethodModal, QRPaymentModal, DebtPaymentModal, ReceiptModal, CashPaymentModal } from '../components/payment';
import ProductQuantityModal from '../components/ProductQuantityModal';

const { width, height } = Dimensions.get('window');

// Weight Data (Mock from SaleScreen)
const WEIGHT_CATEGORIES = [
    {
        id: 'pork', name: 'หมู', items: [
            { id: 'p1', name: 'สามชั้นสไลด์', price: 150 },
            { id: 'p2', name: 'สามชั้น', price: 140 },
            { id: 'p3', name: 'สันคอ', price: 160 },
            { id: 'p4', name: 'สันนอก', price: 150 },
            { id: 'p5', name: 'สันใน', price: 170 },
        ]
    },
    {
        id: 'chicken', name: 'ไก่', items: [
            { id: 'c1', name: 'อกไก่', price: 80 },
            { id: 'c2', name: 'น่องไก่', price: 75 },
            { id: 'c3', name: 'ปีกไก่', price: 85 },
        ]
    },
    { id: 'seafood', name: 'ทะเล', items: [{ id: 's1', name: 'กุ้งขาว', price: 280 }, { id: 's2', name: 'หมึกกล้วย', price: 250 }] },
    { id: 'veg', name: 'ผัก', items: [{ id: 'v1', name: 'คะน้า', price: 40 }, { id: 'v2', name: 'กวางตุ้ง', price: 35 }] },
    { id: 'fruit', name: 'ผลไม้', items: [{ id: 'f1', name: 'ส้ม', price: 60 }, { id: 'f2', name: 'แอปเปิ้ล', price: 90 }] },
];

const WEIGHT_UNITS = [
    { label: 'กิโลกรัม', value: 'kg', multiplier: 1 },
    { label: 'กรัม', value: 'g', multiplier: 0.001 },
    { label: 'ขีด', value: 'h', multiplier: 0.1 },
];

export default function ScanScreen({ navigation, route }) {
    // --- Permissions & Stores ---
    const [permission, requestPermission] = useCameraPermissions();
    const insets = useSafeAreaInsets();
    const isFocused = useIsFocused(); // Track if screen is focused
    const { getProductByBarcode, products: storeProducts, categories, fetchProducts, fetchCategories, refreshProducts, setSearchQuery, selectedCategoryId, setSelectedCategory, isLoading, hasMore } = useProductStore();
    const { cart: products, addToCart, removeFromCart, updateQuantity, clearCart } = useCartStore();

    const handleDecreaseQty = (item) => {
        if (item.quantity > 1) {
            updateQuantity(item.id, item.quantity - 1);
        } else {
            Alert.alert(
                'ลบสินค้า',
                'ต้องการลบสินค้านี้ใช่หรือไม่?',
                [
                    { text: 'ยกเลิก', style: 'cancel' },
                    { text: 'ลบ', style: 'destructive', onPress: () => removeFromCart(item.id) }
                ]
            );
        }
    };

    // --- State: UI Modes ---
    const [activeTab, setActiveTab] = useState('scan'); // 'scan', 'search', 'weight'
    const [scanMode, setScanMode] = useState('sale'); // 'sale', 'price_check'

    // --- State: Camera & Logic ---
    const [isCameraActive, setIsCameraActive] = useState(true);
    const [flash, setFlash] = useState(false);
    const [scannedProduct, setScannedProduct] = useState(null); // For Price Check modal
    const [sound, setSound] = useState();

    // Auto-off Timer
    const inactivityTimer = useRef(null);

    // --- State: Payment ---
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showCashModal, setShowCashModal] = useState(false);
    const [showQRModal, setShowQRModal] = useState(false);
    const [showDebtPaymentModal, setShowDebtPaymentModal] = useState(false);
    const [showReceiptModal, setShowReceiptModal] = useState(false);
    const [lastTransaction, setLastTransaction] = useState(null);

    // Auto-close camera when any payment modal is open
    useEffect(() => {
        if (showPaymentModal || showCashModal || showQRModal || showDebtPaymentModal || showReceiptModal) {
            setIsCameraActive(false);
        } else if (activeTab === 'scan') {
            setIsCameraActive(true);
        }
    }, [showPaymentModal, showCashModal, showQRModal, showDebtPaymentModal, showReceiptModal, activeTab]);

    // --- State: Search Tab ---
    const [searchQueryLocal, setSearchQueryLocal] = useState('');
    const [showCategoryFilter, setShowCategoryFilter] = useState(false);

    // --- State: Weight Tab ---
    const [selectedWeightCategory, setSelectedWeightCategory] = useState(WEIGHT_CATEGORIES[0]);
    const [selectedItem, setSelectedItem] = useState(WEIGHT_CATEGORIES[0].items[0]);
    const [weightInput, setWeightInput] = useState('1.0');
    const [selectedUnit, setSelectedUnit] = useState(WEIGHT_UNITS[0]);

    // --- State: Modals ---
    const [quantityModalVisible, setQuantityModalVisible] = useState(false);
    const [selectedProductToAdd, setSelectedProductToAdd] = useState(null);

    // --- Effects: Sound & Permissions ---
    useEffect(() => {
        if (!permission) requestPermission();
        async function loadSound() {
            try {
                const { sound: newSound } = await Audio.Sound.createAsync(
                    require('../../assets/beep.wav')
                );
                setSound(newSound);
            } catch (error) { console.log('Error loading sound', error); }
        }
        loadSound();
        return () => { if (sound) sound.unloadAsync(); };
    }, [permission]);

    // --- Effects: Camera Auto-off ---
    const resetInactivityTimer = useCallback(() => {
        if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
        if (isCameraActive && activeTab === 'scan') {
            inactivityTimer.current = setTimeout(() => {
                setIsCameraActive(false);
            }, 60000); // 60 seconds
        }
    }, [isCameraActive, activeTab]);

    useEffect(() => {
        resetInactivityTimer();
        return () => { if (inactivityTimer.current) clearTimeout(inactivityTimer.current); };
    }, [resetInactivityTimer]);

    // Re-activate camera when tab switches to scan
    useEffect(() => {
        if (activeTab === 'scan') {
            setIsCameraActive(true);
        } else {
            setIsCameraActive(false);
            setFlash(false); // Turn off flash when leaving scan tab
        }
    }, [activeTab]);

    // Turn off flash when leaving the screen
    useFocusEffect(
        useCallback(() => {
            return () => {
                setFlash(false);
                setIsCameraActive(false);
            };
        }, [])
    );

    // --- Initial Data Load (for Search) ---
    useEffect(() => {
        if (storeProducts.length === 0) fetchProducts(true);
        if (categories.length === 0) fetchCategories();
    }, []);

    // --- Logic: Sound ---
    const playSound = async () => {
        try { if (sound) await sound.replayAsync(); } catch (e) { }
    };

    // --- Logic: Scan ---
    const isProcessingRef = useRef(false);
    const handleBarCodeScanned = async ({ data }) => {
        // Use ref instead of state for immediate synchronous blocking
        if (isProcessingRef.current) return;
        isProcessingRef.current = true;

        resetInactivityTimer();
        playSound();
        Vibration.vibrate(50);

        try {
            const product = await getProductByBarcode(data);
            if (!product) {
                Alert.alert("ไม่พบสินค้า", `บาร์โค้ด: ${data} ไม่มีในระบบ`);
            } else {
                if (scanMode === 'sale') {
                    addToCart(product, 1);
                } else {
                    // Price Check Mode
                    Alert.alert(
                        product.name,
                        `ราคา: ฿${product.price}\nสต็อก: ${product.stock_qty || 0} ${product.unit_type || 'ชิ้น'}`
                    );
                }
            }
        } catch (error) {
            console.log(error);
        } finally {
            // Longer debounce for iOS
            setTimeout(() => { isProcessingRef.current = false; }, 2000);
        }
    };

    // --- Logic: Payment ---
    const totalAmount = products.reduce((sum, p) => sum + (p.price * p.quantity), 0);
    const totalItems = products.length;

    const handleConfirmAddToCart = (quantity) => {
        if (selectedProductToAdd) {
            addToCart(selectedProductToAdd, quantity);
            setQuantityModalVisible(false);
            if (activeTab !== 'scan') {
                Alert.alert('สำเร็จ', 'เพิ่มลงตะกร้าแล้ว');
            }
        }
    };

    const handleLoadMore = () => {
        if (!isLoading && hasMore) fetchProducts();
    };

    // --- Logic: Credit Sale ---
    const handleDebtConfirm = async (debtData) => {
        try {
            const response = await createCreditSale({
                customer_id: debtData.customerId,
                customer_name: debtData.customerName,
                customer_phone: debtData.customerPhone,
                customer_image: debtData.customerImage,
                is_new_customer: debtData.isNewCustomer,
                due_date: debtData.dueDate,
                amount: debtData.amount,
                items: products,
            });

            setShowDebtPaymentModal(false);

            if (response.success) {
                const orderNo = response.data?.order?.order_no || 'N/A';
                const customerName = response.data?.customer?.name || 'N/A';
                Alert.alert(
                    'สำเร็จ',
                    `บันทึกการขายเชื่อเรียบร้อย\n\nคำสั่งซื้อ: ${orderNo}\nลูกค้า: ${customerName}`
                );
                clearCart();
            } else {
                Alert.alert('ผิดพลาด', response.error || 'ไม่สามารถบันทึกได้');
            }
        } catch (error) {
            setShowDebtPaymentModal(false);
            Alert.alert('ผิดพลาด', `ไม่สามารถเชื่อมต่อ Server ได้\n\n${error.message}`);
        }
    };

    // --- Logic: Normal Sale (Cash/QR) ---
    const handleNormalSale = async (paymentMethod, receivedAmount = 0) => {
        try {
            // Close modals first
            setShowPaymentModal(false);
            setShowQRModal(false);
            setShowCashModal(false); // Close cash modal

            const response = await createSale({
                items: products,
                paymentMethod: paymentMethod, // 'cash' or 'qr'
                totalAmount: totalAmount,
                receivedAmount: receivedAmount, // Pass received amount from modal
            });

            if (response.success) {
                const transactionData = response.data;
                setLastTransaction({
                    receiptNo: transactionData.order_no,
                    date: new Date(transactionData.created_at).toLocaleString('th-TH'),
                    paymentMethod: paymentMethod === 'qr' ? 'Thai QR' : 'เงินสด',
                    items: transactionData.order_items.map(item => ({
                        name: item.products.name,
                        quantity: item.qty,
                        price: item.price_per_unit
                    })),
                    total: transactionData.total_amount,
                    received: receivedAmount || transactionData.total_amount,
                    change: (receivedAmount || transactionData.total_amount) - transactionData.total_amount,
                    store: transactionData.stores
                });

                clearCart();
                refreshProducts();
                setShowReceiptModal(true);
            } else {
                Alert.alert('ผิดพลาด', response.error || 'ไม่สามารถบันทึกการขายได้');
            }
        } catch (error) {
            Alert.alert('ผิดพลาด', `เกิดข้อผิดพลาดในการเชื่อมต่อ\n${error.message}`);
        }
    };

    // --- Render Logic ---

    // 1. TABS
    const renderTabs = () => (
        <View style={[styles.tabContainer, { paddingTop: 10, paddingBottom: 20 }]}>
            <View style={styles.tabWrapper}>
                {['scan', 'search', 'weight'].map((tab) => (
                    <TouchableOpacity
                        key={tab}
                        style={[styles.tab, activeTab === tab && styles.activeTab]}
                        onPress={() => setActiveTab(tab)}
                    >
                        <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
                            {tab === 'scan' ? 'สแกน' : tab === 'search' ? 'ค้นหา' : 'ชั่ง'}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );

    // 2. CAMERA SECTION
    const renderCameraSection = () => {
        if (activeTab !== 'scan') return null;

        // Only show camera when both isCameraActive AND screen is focused
        // This prevents flickering when navigating to other screens
        const shouldShowCamera = isCameraActive && isFocused;

        return (
            <View style={styles.cameraSection}>
                {shouldShowCamera ? (
                    <>
                        {/* CameraView without children to avoid the warning */}
                        <CameraView
                            style={styles.camera}
                            facing="back"
                            enableTorch={flash}
                            onBarcodeScanned={handleBarCodeScanned}
                            barcodeScannerSettings={{ barcodeTypes: ["ean13", "ean8", "qr"] }}
                        />
                        {/* Controls Overlay - positioned absolutely on top of camera */}
                        <TouchableOpacity
                            style={styles.cameraOverlay}
                            activeOpacity={1}
                            onPress={resetInactivityTimer}
                        >
                            <TouchableOpacity style={styles.flashButton} onPress={() => setFlash(!flash)}>
                                <Ionicons name={flash ? "flash" : "flash-off"} size={20} color={flash ? "#FFD700" : "#fff"} />
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.powerButton} onPress={() => setIsCameraActive(false)}>
                                <Ionicons name="power" size={20} color="#fff" />
                            </TouchableOpacity>

                            {/* Focus Frame */}
                            <View style={styles.focusFrame} />
                        </TouchableOpacity>
                    </>
                ) : (
                    <TouchableOpacity style={styles.cameraOffView} onPress={() => setIsCameraActive(true)}>
                        <Ionicons name="camera" size={40} color="#666" />
                        <Text style={styles.cameraOffText}>แตะเพื่อเปิดกล้อง</Text>
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    // 3. SCAN MODES
    const renderScanModes = () => {
        if (activeTab !== 'scan') return null;
        return (
            <View style={styles.modeContainer}>
                <TouchableOpacity
                    style={[styles.modeButton, scanMode === 'sale' && styles.activeModeButton]}
                    onPress={() => setScanMode('sale')}
                >
                    <Text style={[styles.modeText, scanMode === 'sale' && styles.activeModeText]}>สแกนขาย</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.modeButton, scanMode === 'price_check' && styles.activeModeButton]}
                    onPress={() => setScanMode('price_check')}
                >
                    <Text style={[styles.modeText, scanMode === 'price_check' && styles.activeModeText]}>เช็คราคา</Text>
                </TouchableOpacity>
            </View>
        );
    }

    // 4. CART LIST (For Scan Mode)
    const renderCartList = () => {
        if (activeTab !== 'scan') return null;
        return (
            <FlatList
                data={products}
                keyExtractor={item => item.id}
                style={styles.cartList}
                contentContainerStyle={{ padding: 15, paddingBottom: 100 }}
                ListEmptyComponent={
                    <View style={styles.emptyCart}>
                        <Text style={{ color: '#aaa' }}>ยังไม่มีสินค้าในตะกร้า</Text>
                    </View>
                }
                renderItem={({ item }) => (
                    <View style={styles.cartItem}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                            <Image source={{ uri: item.image_url || item.image || 'https://via.placeholder.com/50' }} style={styles.cartItemImage} />
                            <View style={{ marginLeft: 10, flex: 1 }}>
                                <Text style={styles.cartItemName} numberOfLines={1}>{item.name}</Text>
                                <Text style={styles.cartItemPrice}>฿{item.price}</Text>
                            </View>
                        </View>
                        {/* Qty Controls */}
                        <View style={styles.qtyContainer}>
                            <TouchableOpacity onPress={() => handleDecreaseQty(item)} style={styles.qtyBtn}>
                                {item.quantity > 1 ? (
                                    <Ionicons name="remove" size={16} color="#555" />
                                ) : (
                                    <Ionicons name="trash" size={16} color="#FF3B30" />
                                )}
                            </TouchableOpacity>
                            <Text style={styles.qtyText}>{item.quantity}</Text>
                            <TouchableOpacity onPress={() => addToCart(item, 1)} style={styles.qtyBtn}><Ionicons name="add" size={16} color="#555" /></TouchableOpacity>
                        </View>
                    </View>
                )}
            />
        );
    };

    // 5. SEARCH VIEW
    const renderSearchView = () => {
        if (activeTab !== 'search') return null;
        const displayProducts = storeProducts; // Already filtered by store
        return (
            <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
                {/* Search Bar */}
                <View style={styles.searchHeader}>
                    <View style={styles.searchBar}>
                        <Ionicons name="search" size={20} color="#999" />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="ค้นหาสินค้า..."
                            value={searchQueryLocal}
                            onChangeText={(text) => {
                                setSearchQueryLocal(text);
                                setTimeout(() => setSearchQuery(text), 500);
                            }}
                        />
                    </View>
                </View>

                {/* Grid */}
                <FlatList
                    data={displayProducts}
                    numColumns={2}
                    keyExtractor={item => item.id}
                    contentContainerStyle={{ padding: 10, paddingBottom: 100 }}
                    columnWrapperStyle={{ justifyContent: 'space-between' }}
                    onEndReached={handleLoadMore}
                    renderItem={({ item }) => (
                        <View style={styles.gridItem}>
                            <Image source={{ uri: item.image_url || 'https://via.placeholder.com/100' }} style={styles.gridImage} />
                            <Text numberOfLines={1} style={styles.gridName}>{item.name}</Text>
                            <Text style={styles.gridPrice}>฿{item.price}</Text>
                            <TouchableOpacity style={styles.addButton} onPress={() => { setSelectedProductToAdd(item); setQuantityModalVisible(true); }}>
                                <Ionicons name="add" size={24} color="#fff" />
                            </TouchableOpacity>
                        </View>
                    )}
                />
            </View>
        );
    };

    // 6. WEIGHT VIEW
    const renderWeightView = () => {
        if (activeTab !== 'weight') return null;
        const total = (parseFloat(weightInput) || 0) * selectedUnit.multiplier * selectedItem.price;

        return (
            <View style={{ flex: 1, padding: 20 }}>
                {/* Categories */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 15 }}>
                    {WEIGHT_CATEGORIES.map(cat => (
                        <TouchableOpacity
                            key={cat.id}
                            style={[styles.categoryPill, selectedWeightCategory.id === cat.id && styles.activeCategoryPill]}
                            onPress={() => { setSelectedWeightCategory(cat); setSelectedItem(cat.items[0]); }}
                        >
                            <Text style={[styles.categoryText, selectedWeightCategory.id === cat.id && styles.activeCategoryText]}>{cat.name}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
                {/* Items */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 20 }}>
                    {selectedWeightCategory.items.map(item => (
                        <TouchableOpacity
                            key={item.id}
                            style={[styles.itemPill, selectedItem.id === item.id && styles.activeItemPill]}
                            onPress={() => setSelectedItem(item)}
                        >
                            <Text style={[styles.itemText, selectedItem.id === item.id && styles.activeItemText]}>{item.name}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Card */}
                <View style={styles.unifiedCard}>
                    <Text style={styles.unifiedProductName}>{selectedItem.name}</Text>
                    <Text style={{ textAlign: 'center', color: '#666', marginBottom: 15 }}>฿{selectedItem.price} / {selectedUnit.label}</Text>
                    <TextInput
                        style={styles.unifiedInput}
                        value={weightInput}
                        onChangeText={setWeightInput}
                        keyboardType="decimal-pad"
                        textAlign="center"
                    />
                    <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 15, gap: 10 }}>
                        {WEIGHT_UNITS.map(unit => (
                            <TouchableOpacity
                                key={unit.value}
                                style={[styles.unitQuickButton, selectedUnit.value === unit.value && styles.activeUnitQuickButton]}
                                onPress={() => setSelectedUnit(unit)}
                            >
                                <Text style={[styles.unitQuickText, selectedUnit.value === unit.value && styles.activeUnitQuickText]}>{unit.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Add Button */}
                <TouchableOpacity
                    style={styles.addButtonData}
                    onPress={() => {
                        const product = { ...selectedItem, unit: selectedUnit.label, isWeight: true }; // Mock product structure
                        // In real app, you might map this to a real DB product
                        addToCart({
                            ...product,
                            id: `weight-${product.id}`, // Unique ID for cart
                            image: null,
                            unit_type: selectedUnit.label
                        }, parseFloat(weightInput));
                        Alert.alert('สำเร็จ', 'เพิ่มรายการชั่งน้ำหนักแล้ว');
                    }}
                >
                    <Text style={styles.addButtonDataText}>เพิ่มใส่ตะกร้า • ฿{total.toFixed(0)}</Text>
                </TouchableOpacity>
            </View >
        );
    };

    // 7. FOOTER (PAYMENT)
    const renderFooter = () => (
        <View style={[styles.footer, { bottom: Platform.OS === 'ios' ? 50 : 50 }]}>
            <TouchableOpacity
                style={styles.payButton}
                onPress={() => setShowPaymentModal(true)}
            >
                {/* Left: Count Badge */}
                <View style={styles.itemCountBadge}>
                    <Text style={styles.itemCountText}>{totalItems}</Text>
                </View>

                {/* Center: Text */}
                <Text style={styles.payButtonText}>ชำระเงิน</Text>

                {/* Right: Total Price */}
                <Text style={styles.payTotalText}>฿{totalAmount.toLocaleString()}</Text>
            </TouchableOpacity>
        </View>
    );

    // --- Main Render ---
    if (!permission) return <View style={styles.container} />;
    if (!permission.granted) return (
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
            <Text>ต้องการสิทธิ์กล้อง</Text>
            <TouchableOpacity onPress={requestPermission}><Text>อนุญาต</Text></TouchableOpacity>
        </View>
    );

    return (
        <View style={styles.container}>
            {renderTabs()}

            {/* Split View Container for Scan Tab */}
            {activeTab === 'scan' ? (
                <View style={{ flex: 1 }}>
                    {renderCameraSection()}
                    {renderScanModes()}
                    {renderCartList()}
                </View>
            ) : (
                /* Full View for Search/Weight */
                activeTab === 'search' ? renderSearchView() : renderWeightView()
            )}

            {/* Footer only for Scan Tab */}
            {activeTab === 'scan' && renderFooter()}

            {/* Modals */}
            <PaymentMethodModal
                visible={showPaymentModal}
                amount={totalAmount}
                onSelectCash={() => { setShowPaymentModal(false); setShowCashModal(true); }}
                onSelectQR={() => { setShowPaymentModal(false); setShowQRModal(true); }}
                onSelectDebt={() => { setShowPaymentModal(false); setShowDebtPaymentModal(true); }}
                onClose={() => setShowPaymentModal(false)}
            />
            <CashPaymentModal
                visible={showCashModal}
                amount={totalAmount}
                onConfirm={(received) => handleNormalSale('cash', received)}
                onClose={() => setShowCashModal(false)}
            />
            <QRPaymentModal
                visible={showQRModal}
                amount={totalAmount}
                onConfirm={() => handleNormalSale('qr', totalAmount)}
                onClose={() => setShowQRModal(false)}
            />
            <DebtPaymentModal visible={showDebtPaymentModal} amount={totalAmount} onConfirm={handleDebtConfirm} onCancel={() => setShowDebtPaymentModal(false)} />
            <ProductQuantityModal visible={quantityModalVisible} product={selectedProductToAdd} onClose={() => setQuantityModalVisible(false)} onConfirm={handleConfirmAddToCart} />
            <ReceiptModal
                visible={showReceiptModal}
                transaction={lastTransaction}
                onClose={() => setShowReceiptModal(false)}
                onNewTransaction={() => setShowReceiptModal(false)}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },

    // Tabs
    tabContainer: { paddingHorizontal: 20, paddingBottom: 10, zIndex: 10 },
    tabWrapper: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 25, padding: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
    tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 22 },
    activeTab: { backgroundColor: '#F37021' },
    tabText: { fontSize: 14, color: '#888', fontWeight: '500' },
    activeTabText: { color: '#fff', fontWeight: 'bold' },

    // Camera (Middle 1)
    cameraSection: { height: height * 0.25, backgroundColor: '#000', position: 'relative' },
    camera: { flex: 1 },
    cameraOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
    cameraOffView: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#222' },
    cameraOffText: { color: '#aaa', marginTop: 10 },
    focusFrame: { width: width * 0.70, height: height * 0.10, borderWidth: 2, borderColor: '#fff', borderRadius: 10, opacity: 0.5 },
    flashButton: { position: 'absolute', top: 15, right: 15, padding: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 },
    powerButton: { position: 'absolute', top: 15, left: 15, padding: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 },

    // Modes (Middle 2)
    modeContainer: { flexDirection: 'row', padding: 10 },
    modeButton: { flex: 1, paddingVertical: 10, alignItems: 'center', marginHorizontal: 5, borderRadius: 10, backgroundColor: '#F5F5F5', borderWidth: 1, borderColor: '#eee', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 2 },
    activeModeButton: { backgroundColor: '#FFF3E0', borderColor: '#F37021' },
    modeText: { color: '#666', fontWeight: '500' },
    activeModeText: { color: '#F37021', fontWeight: 'bold' },

    // Cart List
    cartList: { flex: 1, backgroundColor: '#F9FAFB' },
    emptyCart: { padding: 40, alignItems: 'center' },
    cartItem: { flexDirection: 'row', backgroundColor: '#fff', padding: 15, marginBottom: 8, borderRadius: 12, alignItems: 'center', borderWidth: 1.2, borderColor: '#eee' },
    cartItemImage: { width: 50, height: 50, borderRadius: 8, backgroundColor: '#eee' },
    cartItemName: { fontSize: 16, fontWeight: '600', color: '#333' },
    cartItemPrice: { fontSize: 16, color: '#F37021', fontWeight: 'bold' },
    qtyContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F0F0', borderRadius: 20, padding: 5 },
    qtyBtn: { padding: 5 },
    qtyText: { paddingHorizontal: 8, fontSize: 14, fontWeight: '600' },

    // Footer
    footer: { position: 'absolute', bottom: 20, left: 0, right: 0, paddingHorizontal: 15, backgroundColor: 'transparent' },
    payButton: {
        backgroundColor: '#F37021',
        borderRadius: 50,
        paddingVertical: 15,
        paddingHorizontal: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        shadowColor: '#F37021', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5
    },
    itemCountBadge: { backgroundColor: '#fff', width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    itemCountText: { color: '#F37021', fontWeight: 'bold', fontSize: 14 },
    payButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    payTotalText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },

    // Search & Grid Styles (Simplified)
    searchHeader: { padding: 15, backgroundColor: '#fff' },
    searchBar: { flexDirection: 'row', backgroundColor: '#F3F4F6', borderRadius: 12, padding: 10, alignItems: 'center' },
    searchInput: { flex: 1, marginLeft: 10, fontSize: 16 },
    gridItem: { width: '48%', backgroundColor: '#fff', padding: 10, marginBottom: 15, borderRadius: 12, alignItems: 'center' },
    gridImage: { width: 80, height: 80, borderRadius: 8, marginBottom: 8 },
    gridName: { fontWeight: '600', marginBottom: 5 },
    gridPrice: { color: '#F37021', fontWeight: 'bold' },
    addButton: { marginTop: 5, backgroundColor: '#F37021', borderRadius: 20, padding: 5 },

    // Weight Styles (Simplified)
    categoryPill: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', marginRight: 10, marginBottom: 10, borderWidth: 1, borderColor: '#eee' },
    activeCategoryPill: { backgroundColor: '#F37021', borderColor: '#F37021' },
    categoryText: { color: '#666' },
    activeCategoryText: { color: '#fff' },
    itemPill: { width: '30%', paddingVertical: 15, borderRadius: 10, backgroundColor: '#fff', marginRight: '3%', marginBottom: 10, alignItems: 'center' },
    activeItemPill: { backgroundColor: '#FFF3E0', borderColor: '#F37021', borderWidth: 1 },
    itemText: { fontSize: 12 },
    activeItemText: { color: '#F37021', fontWeight: 'bold' },
    unifiedCard: { backgroundColor: '#fff', borderRadius: 20, padding: 20, alignItems: 'center', marginBottom: 20 },
    unifiedProductName: { fontSize: 20, fontWeight: 'bold', marginBottom: 5 },
    unifiedInput: { fontSize: 40, fontWeight: 'bold', color: '#333', width: '100%' },
    unitQuickButton: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 15, backgroundColor: '#F3F4F6' },
    activeUnitQuickButton: { backgroundColor: '#F37021' },
    unitQuickText: { color: '#666' },
    activeUnitQuickText: { color: '#fff' },
    addButtonData: { backgroundColor: '#F37021', padding: 15, borderRadius: 15, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
    addButtonDataText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
