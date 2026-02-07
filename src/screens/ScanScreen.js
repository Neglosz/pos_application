import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Vibration, ActivityIndicator, Dimensions, Image, TextInput, ScrollView, FlatList, Animated, Platform, Modal, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
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
// Weight Data (Fixed Categories per user request)
const FIXED_WEIGHT_CATEGORIES = [
    { id: 'meats', name: 'เนื้อสัตว์', keywords: ['เนื้อ', 'หมู', 'ไก่', 'เป็ด', 'เครื่องใน', 'ลูกชิ้น', 'ไส้กรอก'] },
    { id: 'seafood', name: 'ทะเล', keywords: ['ทะเล', 'กุ้ง', 'หมึก', 'ปลา', 'หอย', 'ปู'] },
    { id: 'veg', name: 'ผัก', keywords: ['ผัก'] },
    { id: 'fruit', name: 'ผลไม้', keywords: ['ผลไม้'] },
    { id: 'dried', name: 'ของแห้ง/อื่นๆ', keywords: ['แห้ง', 'ข้าว', 'ธัญพืช', 'กระเทียม', 'หอม', 'พริก', 'กะปิ', 'อาหารสัตว์'] },
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
    const { getProductByBarcode, products: storeProducts, weightProducts, categories, fetchProducts, fetchWeightProducts, fetchCategories, addProduct, refreshProducts, setSearchQuery, selectedCategoryId, setSelectedCategory, isLoading, hasMore } = useProductStore();
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
    const [selectedWeightCategory, setSelectedWeightCategory] = useState(FIXED_WEIGHT_CATEGORIES[0]);
    const [selectedItem, setSelectedItem] = useState(null);
    const [weightInput, setWeightInput] = useState('1.0');
    const [selectedUnit, setSelectedUnit] = useState(WEIGHT_UNITS[0]);

    // Computed Weight Categories
    const weightCategories = useMemo(() => {
        // 1. Initialize groups with fixed categories
        const groups = FIXED_WEIGHT_CATEGORIES.map(cat => ({ ...cat, items: [] }));

        // 2. Distribute products
        if (weightProducts && weightProducts.length > 0) {
            weightProducts.forEach(p => {
                const catName = categories.find(c => c.id === p.category_id)?.name || '';

                // Find matching group
                const group = groups.find(g => g.keywords.some(kw => catName.includes(kw)));
                if (group) {
                    group.items.push(p);
                }
            });
        }
        return groups;
    }, [weightProducts, categories]);

    // Fetch weight products when entering tab
    useEffect(() => {
        if (activeTab === 'weight') {
            fetchWeightProducts();
        }
    }, [activeTab]);

    // Auto-select first item
    useEffect(() => {
        // Re-select category if needed (e.g. after refresh), but prefer staying on current valid one
        if (selectedWeightCategory) {
            const currentGroup = weightCategories.find(g => g.id === selectedWeightCategory.id);
            if (currentGroup && currentGroup.items.length > 0) {
                // Try to keep selected item
                if (!selectedItem || !currentGroup.items.find(i => i.id === selectedItem.id)) {
                    setSelectedItem(currentGroup.items[0]);
                }
                return;
            }
        }
        // Fallback
        const firstPopulated = weightCategories.find(g => g.items.length > 0);
        if (firstPopulated) {
            setSelectedWeightCategory(firstPopulated);
            setSelectedItem(firstPopulated.items[0]);
        }
    }, [weightCategories]);

    // Update items when category changes
    useEffect(() => {
        if (selectedWeightCategory) {
            const currentGroup = weightCategories.find(g => g.id === selectedWeightCategory.id);
            if (currentGroup && currentGroup.items.length > 0) {
                setSelectedItem(currentGroup.items[0]);
            } else {
                setSelectedItem(null);
            }
        }
    }, [selectedWeightCategory]);

    // --- State: Modals ---
    const [quantityModalVisible, setQuantityModalVisible] = useState(false);
    const [selectedProductToAdd, setSelectedProductToAdd] = useState(null);

    // --- State: Add Product Modal ---
    const [showAddProductModal, setShowAddProductModal] = useState(false);
    const [newProductCategory, setNewProductCategory] = useState(null);
    const [newProductName, setNewProductName] = useState('');
    const [newProductPrice, setNewProductPrice] = useState('');
    const [newProductCost, setNewProductCost] = useState('');
    const [newProductStock, setNewProductStock] = useState(''); // New state for stock
    const [newProductLowStock, setNewProductLowStock] = useState('5'); // Default Low Stock = 5kg
    const [newProductImage, setNewProductImage] = useState(null); // New: Image
    const [newProductExpireDate, setNewProductExpireDate] = useState(null); // New: Expire Date
    const [showDatePicker, setShowDatePicker] = useState(false); // New: Date Picker Visibility
    const [newProductUnit, setNewProductUnit] = useState(WEIGHT_UNITS[0]);

    // Image Picker Helper
    // Image Picker Helper
    const pickImage = async () => {
        Alert.alert(
            'เลือกรูปภาพ',
            'เลือกแหล่งที่มาของรูปภาพ',
            [
                {
                    text: 'ถ่ายภาพ',
                    onPress: async () => {
                        let result = await ImagePicker.launchCameraAsync({
                            mediaTypes: ImagePicker.MediaTypeOptions.Images,
                            allowsEditing: true,
                            aspect: [1, 1],
                            quality: 0.5,
                            base64: true,
                        });
                        if (!result.canceled) {
                            setNewProductImage(`data:image/jpeg;base64,${result.assets[0].base64}`);
                        }
                    }
                },
                {
                    text: 'เลือกจากอัลบั้ม',
                    onPress: async () => {
                        let result = await ImagePicker.launchImageLibraryAsync({
                            mediaTypes: ImagePicker.MediaTypeOptions.Images,
                            allowsEditing: true,
                            aspect: [1, 1],
                            quality: 0.5,
                            base64: true,
                        });
                        if (!result.canceled) {
                            setNewProductImage(`data:image/jpeg;base64,${result.assets[0].base64}`);
                        }
                    }
                },
                { text: 'ยกเลิก', style: 'cancel' }
            ]
        );
    };

    // Pre-fill category when opening modal
    useEffect(() => {
        if (showAddProductModal && selectedWeightCategory) {
            setNewProductCategory(selectedWeightCategory);
        }
    }, [showAddProductModal, selectedWeightCategory]);

    const handleAddProduct = async () => {
        if (!newProductName || !newProductPrice) {
            Alert.alert('ข้อมูลไม่ครบ', 'กรุณากรอกชื่อและราคา');
            return;
        }

        // Resolve DB Category ID
        let dbCategoryId = null;
        if (newProductCategory) {
            const matchingDbCat = categories.find(c =>
                // Check if any keyword matches the category name
                newProductCategory.keywords.some(kw => c.name.includes(kw))
            );

            if (matchingDbCat) {
                dbCategoryId = matchingDbCat.id;
            } else {
                // Category not found, create it!
                try {
                    const { createCategory } = useProductStore.getState();
                    const result = await createCategory(newProductCategory.name);

                    if (result.success && result.data) {
                        dbCategoryId = result.data.id;
                    } else {
                        Alert.alert('ผิดพลาด', 'ไม่สามารถสร้างหมวดหมู่ใหม่ได้: ' + (result.error || 'Server Error'));
                        return;
                    }
                } catch (e) {
                    console.log("Auto-create category failed", e);
                }
            }
        }

        const productData = {
            name: newProductName,
            salePrice: newProductPrice,
            costPrice: newProductCost || 0,
            categoryId: dbCategoryId,
            unitType: 'kg',
            quantity: newProductStock ? parseFloat(newProductStock) : 0,
            salePrice: newProductPrice, // Ensure mapping matches api.js expectation
            costPrice: newProductCost || 0,
            lowStockThreshold: newProductLowStock ? parseFloat(newProductLowStock) : 0,
            expireDate: newProductExpireDate, // Pass Date object
            imageUrl: newProductImage, // Base64 string
            isWeightable: true
        };

        const result = await addProduct(productData);
        if (result.success) {
            Alert.alert('สำเร็จ', 'เพิ่มสินค้าเรียบร้อย');
            setShowAddProductModal(false);
            setNewProductName('');
            setNewProductPrice('');
            setNewProductCost('');
            setNewProductStock('');
            setNewProductLowStock('5'); // Reset to default
            setNewProductImage(null);
            setNewProductExpireDate(null);
        } else {
            Alert.alert('ผิดพลาด', result.error);
        }
    };

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
        const total = (parseFloat(weightInput) || 0) * selectedUnit.multiplier * (selectedItem?.price || 0);

        return (
            <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
                <View style={{ flex: 1, padding: 20 }}>
                    {/* Header with Add Product Button */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                        <Text style={{ fontSize: 18, fontWeight: 'bold' }}>รายการชั่งน้ำหนัก</Text>
                        <TouchableOpacity
                            style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F37021', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 }}
                            onPress={() => setShowAddProductModal(true)}
                        >
                            <Ionicons name="add" size={16} color="#fff" style={{ marginRight: 4 }} />
                            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12 }}>เพิ่มสินค้า</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Categories */}
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 15 }}>
                        {weightCategories?.map(cat => (
                            <TouchableOpacity
                                key={cat.id}
                                style={[styles.categoryPill, selectedWeightCategory?.id === cat.id && styles.activeCategoryPill]}
                                onPress={() => { setSelectedWeightCategory(cat); }}
                            >
                                <Text style={[styles.categoryText, selectedWeightCategory?.id === cat.id && styles.activeCategoryText]}>{cat.name}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    {/* Items */}
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 20 }}>
                        {selectedWeightCategory?.items?.map(item => (
                            <TouchableOpacity
                                key={item.id}
                                style={[styles.itemPill, selectedItem?.id === item.id && styles.activeItemPill]}
                                onPress={() => setSelectedItem(item)}
                            >
                                <Text style={[styles.itemText, selectedItem?.id === item.id && styles.activeItemText]}>{item.name}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Card */}
                    {selectedItem && (
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
                    )}
                    {
                        !selectedItem && (
                            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                                <Text style={{ color: '#aaa' }}>กรุณาเลือกสินค้า หรือเพิ่มสินค้าใหม่</Text>
                            </View>
                        )
                    }

                    {/* Add Button */}
                    {
                        selectedItem && (
                            <TouchableOpacity
                                style={styles.addButtonData}
                                onPress={() => {
                                    const product = { ...selectedItem, unit: selectedUnit.label, isWeight: true };
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
                        )
                    }
                </View >
            </TouchableWithoutFeedback>
        );
    };

    // 7. RENDER ADD PRODUCT MODAL
    const renderAddProductModal = () => (
        <React.Fragment>
            {showAddProductModal && (
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                        {/* Header */}
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>เพิ่มสินค้าใหม่</Text>
                            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowAddProductModal(false)}>
                                <Ionicons name="close" size={20} color="#666" />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.handleIndicator} />

                        <ScrollView showsVerticalScrollIndicator={false}>
                            {/* Category Input */}
                            <Text style={styles.inputLabel}>
                                <Ionicons name="pricetag-outline" size={14} /> หมวดหมู่
                            </Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
                                {FIXED_WEIGHT_CATEGORIES.map(cat => (
                                    <TouchableOpacity
                                        key={cat.id}
                                        style={[styles.categoryPill, newProductCategory?.id === cat.id && styles.activeCategoryPill, { paddingVertical: 5, paddingHorizontal: 10 }]}
                                        onPress={() => setNewProductCategory(cat)}
                                    >
                                        <Text style={[styles.categoryText, newProductCategory?.id === cat.id && { color: '#fff' }]}>{cat.name}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* Name Input */}
                            <Text style={styles.inputLabel}>
                                <Ionicons name="cube-outline" size={14} /> ชื่อสินค้า
                            </Text>
                            <TextInput
                                style={styles.textInput}
                                placeholder="เช่น สามชั้นสไลด์"
                                value={newProductName}
                                onChangeText={setNewProductName}
                            />

                            {/* Price Input */}
                            <Text style={styles.inputLabel}>
                                <Ionicons name="cash-outline" size={14} /> ราคา (บาท)
                            </Text>
                            <View style={[styles.textInput, { flexDirection: 'row', alignItems: 'center' }]}>
                                <Text style={{ fontSize: 16, color: '#999', marginRight: 10 }}>฿</Text>
                                <TextInput
                                    style={{ flex: 1, fontSize: 16 }}
                                    keyboardType="numeric"
                                    value={newProductPrice}
                                    onChangeText={setNewProductPrice}
                                />
                            </View>

                            {/* Cost Price */}
                            <Text style={styles.inputLabel}>
                                <Ionicons name="pricetags-outline" size={14} /> ต้นทุน (บาท)
                            </Text>
                            <View style={[styles.textInput, { flexDirection: 'row', alignItems: 'center' }]}>
                                <Text style={{ fontSize: 16, color: '#999', marginRight: 10 }}>฿</Text>
                                <TextInput
                                    style={{ flex: 1, fontSize: 16 }}
                                    keyboardType="numeric"
                                    value={newProductCost}
                                    onChangeText={setNewProductCost}
                                />
                            </View>



                            {/* Image Picker */}
                            <Text style={styles.inputLabel}>
                                <Ionicons name="camera-outline" size={14} /> รูปสินค้า
                            </Text>
                            <TouchableOpacity style={styles.imagePickerButton} onPress={pickImage}>
                                {newProductImage ? (
                                    <Image source={{ uri: newProductImage }} style={{ width: '100%', height: '100%', borderRadius: 10 }} />
                                ) : (
                                    <View style={{ alignItems: 'center' }}>
                                        <Ionicons name="camera" size={30} color="#ccc" />
                                        <Text style={{ color: '#999', marginTop: 5 }}>ถ่ายรูปสินค้า</Text>
                                    </View>
                                )}
                            </TouchableOpacity>

                            {/* Row: Stock & Low Stock */}
                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.inputLabel}>
                                        <Ionicons name="layers-outline" size={14} /> สต็อก (กก.)
                                    </Text>
                                    <TextInput
                                        style={styles.textInput}
                                        placeholder="0"
                                        keyboardType="numeric"
                                        value={newProductStock}
                                        onChangeText={setNewProductStock}
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.inputLabel}>
                                        <Ionicons name="alert-circle-outline" size={14} /> แจ้งเตือนเมื่อต่ำกว่า
                                    </Text>
                                    <TextInput
                                        style={styles.textInput}
                                        placeholder="0"
                                        keyboardType="numeric"
                                        value={newProductLowStock}
                                        onChangeText={setNewProductLowStock}
                                    />
                                </View>
                            </View>

                            {/* Expiry Date */}
                            <Text style={styles.inputLabel}>
                                <Ionicons name="calendar-outline" size={14} /> วันหมดอายุ
                            </Text>
                            <TouchableOpacity style={styles.textInput} onPress={() => setShowDatePicker(true)}>
                                <Text style={{ color: newProductExpireDate ? '#333' : '#aaa' }}>
                                    {newProductExpireDate ? newProductExpireDate.toLocaleDateString('th-TH') : 'เลือกวันที่ (ถ้ามี)'}
                                </Text>
                            </TouchableOpacity>
                            {/* Date Picker Modal (iOS Style) */}
                            {showDatePicker && (
                                <Modal
                                    transparent={true}
                                    animationType="fade"
                                    visible={showDatePicker}
                                    onRequestClose={() => setShowDatePicker(false)}
                                >
                                    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
                                        <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 20, width: '90%', alignItems: 'center' }}>
                                            <DateTimePicker
                                                value={newProductExpireDate || new Date()}
                                                mode="date"
                                                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                                locale="th-TH" // Force Thai locale
                                                onChange={(event, selectedDate) => {
                                                    if (Platform.OS === 'android') {
                                                        setShowDatePicker(false);
                                                        if (selectedDate) setNewProductExpireDate(selectedDate);
                                                    } else {
                                                        // iOS: Just update internal state, confirm later
                                                        if (selectedDate) setNewProductExpireDate(selectedDate);
                                                    }
                                                }}
                                                style={{ height: 120, width: '100%' }}
                                                textColor="#000"
                                            />
                                            {Platform.OS === 'ios' && (
                                                <TouchableOpacity
                                                    style={{ marginTop: 20, backgroundColor: '#F37021', paddingVertical: 10, paddingHorizontal: 30, borderRadius: 20 }}
                                                    onPress={() => setShowDatePicker(false)}
                                                >
                                                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>ตกลง (OK)</Text>
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    </View>
                                </Modal>
                            )}

                            {/* Unit Selector */}
                            <Text style={styles.inputLabel}>
                                <Ionicons name="scale-outline" size={14} /> หน่วย
                            </Text>
                            <View style={styles.unitSelectorContainer}>
                                {WEIGHT_UNITS.map((unit) => (
                                    <TouchableOpacity
                                        key={unit.value}
                                        style={[
                                            styles.unitOption,
                                            newProductUnit.value === unit.value && styles.activeUnitOption
                                        ]}
                                        onPress={() => setNewProductUnit(unit)}
                                    >
                                        <Text style={[
                                            styles.unitOptionText,
                                            newProductUnit.value === unit.value && styles.activeUnitOptionText
                                        ]}>{unit.label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </ScrollView>

                        {/* Footer Action */}
                        <TouchableOpacity style={styles.modalMainButton} onPress={handleAddProduct}>
                            <Text style={styles.modalMainButtonText}>บันทึกสินค้า</Text>
                        </TouchableOpacity>
                    </View>
                </View >
            )
            }
        </React.Fragment >
    );


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

            {/* Add Product Modal */}
            {renderAddProductModal()}
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
    categoryPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, backgroundColor: '#fff', marginRight: 6, marginBottom: 8, borderWidth: 1, borderColor: '#eee' },
    activeCategoryPill: { backgroundColor: '#F37021', borderColor: '#F37021' },
    categoryText: { color: '#666', fontSize: 13 },
    activeCategoryText: { color: '#fff', fontWeight: 'bold' },
    itemPill: { width: '31%', paddingVertical: 12, borderRadius: 8, backgroundColor: '#fff', marginRight: '2%', marginBottom: 8, alignItems: 'center', borderWidth: 1, borderColor: '#f0f0f0' },
    activeItemPill: { backgroundColor: '#FFF3E0', borderColor: '#F37021', borderWidth: 1 },
    itemText: { fontSize: 13, color: '#444' },
    activeItemText: { color: '#F37021', fontWeight: 'bold' },
    unifiedCard: { backgroundColor: '#fff', borderRadius: 20, padding: 20, alignItems: 'center', marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
    unifiedProductName: { fontSize: 22, fontWeight: 'bold', marginBottom: 5, color: '#333' },
    unifiedInput: { fontSize: 48, fontWeight: 'bold', color: '#F37021', width: '100%', marginVertical: 10 },
    unitQuickButton: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 12, backgroundColor: '#F5F5F5', borderWidth: 1, borderColor: '#eee' },
    activeUnitQuickButton: { backgroundColor: '#F37021', borderColor: '#F37021' },
    unitQuickText: { color: '#666' },
    activeUnitQuickText: { color: '#fff' },
    unitQuickText: { color: '#666' },
    activeUnitQuickText: { color: '#fff' },
    addButtonData: { backgroundColor: '#F37021', padding: 15, borderRadius: 15, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
    addButtonDataText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    imagePickerButton: { width: '100%', height: 150, backgroundColor: '#f0f0f0', borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 15, borderStyle: 'dashed', borderWidth: 1, borderColor: '#ccc' },

    // Modal Styles
    modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end', zIndex: 100 },
    modalContainer: { backgroundColor: '#fff', borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 25, paddingBottom: 40 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    modalTitle: { fontSize: 20, fontWeight: 'bold' },
    modalCloseButton: { padding: 5, backgroundColor: '#F3F4F6', borderRadius: 20 },
    handleIndicator: { width: 40, height: 4, backgroundColor: '#E0E0E0', borderRadius: 2, alignSelf: 'center', marginBottom: 20, position: 'absolute', top: 10 },
    inputLabel: { marginTop: 15, marginBottom: 8, color: '#666', fontSize: 14, fontWeight: '600' },
    inputField: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 12, padding: 15, borderWidth: 1, borderColor: '#eee' },
    textInput: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 15, borderWidth: 1, borderColor: '#eee', fontSize: 16 },
    unitSelectorContainer: { flexDirection: 'row', gap: 10 },
    unitOption: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 12, backgroundColor: '#F3F4F6' },
    activeUnitOption: { backgroundColor: '#F37021' },
    unitOptionText: { fontSize: 14, color: '#666', fontWeight: 'bold' },
    activeUnitOptionText: { color: '#fff' },
    modalMainButton: { backgroundColor: '#F37021', padding: 16, borderRadius: 16, alignItems: 'center', marginTop: 30 },
    modalMainButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});
