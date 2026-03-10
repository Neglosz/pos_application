import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Vibration, ActivityIndicator, Dimensions, Image, TextInput, ScrollView, FlatList, Animated, Platform, Modal, TouchableWithoutFeedback, Keyboard, KeyboardAvoidingView, PanResponder, RefreshControl } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Audio } from 'expo-av';
import { Ionicons, FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { useBluetooth } from '../contexts/BluetoothContext';

// Stores
import { useProductStore } from '../stores/useProductStore';
import { useCartStore } from '../stores/useCartStore';

// Hooks
import { useRealtimeSync } from '../hooks/useRealtimeSync';

// API
import { createCreditSale, createSale } from '../services/api';

// Components
import { PaymentMethodModal, QRPaymentModal, DebtPaymentModal, ReceiptModal, CashPaymentModal } from '../components/payment';
import ProductQuantityModal from '../components/ProductQuantityModal';
import AddStockModal from '../components/AddStockModal';

const { width, height } = Dimensions.get('window');

const SEARCH_CONTENT_STYLE = { padding: 10, paddingBottom: 180 };
const COLUMN_WRAPPER_STYLE = { justifyContent: 'space-between' };

// Weight Data (Mock from SaleScreen)
// Weight Data (Fixed Categories per user request)
const FIXED_WEIGHT_CATEGORIES = [
    { id: 'meats', name: 'เนื้อสัตว์', emoji: '🥩', keywords: ['เนื้อ', 'หมู', 'ไก่', 'เป็ด', 'เครื่องใน', 'ลูกชิ้น', 'ไส้กรอก'] },
    { id: 'seafood', name: 'ทะเล', emoji: '🦐', keywords: ['ทะเล', 'กุ้ง', 'หมึก', 'ปลา', 'หอย', 'ปู'] },
    { id: 'veg', name: 'ผัก', emoji: '🥬', keywords: ['ผัก'] },
    { id: 'fruit', name: 'ผลไม้', emoji: '🍎', keywords: ['ผลไม้'] },
    { id: 'dried', name: 'อื่นๆ', emoji: '🌾', keywords: ['แห้ง', 'ข้าว', 'ธัญพืช', 'กระเทียม', 'หอม', 'พริก', 'กะปิ', 'อาหารสัตว์'] },
];

const WEIGHT_UNITS = [
    { label: 'กิโลกรัม', value: 'kg', multiplier: 1 },
    { label: 'กรัม', value: 'g', multiplier: 0.001 },
    { label: 'ขีด', value: 'h', multiplier: 0.1 },
];

const getUnitMultiplier = (unitTypeOrCode) => {
    const u = (unitTypeOrCode || '').toLowerCase();
    if (u === 'g' || u === 'กรัม') return 0.001;
    if (u === 'h' || u === 'ขีด') return 0.1;
    if (u === 'kg' || u === 'กิโลกรัม') return 1;
    return 1;
};

export default function ScanScreen({ navigation, route }) {
    const { connectedScanner, connectedPrinter, connectedScale, printReceipt, scaleWeight } = useBluetooth();
    // --- Permissions & Stores ---
    const [permission, requestPermission] = useCameraPermissions();
    const insets = useSafeAreaInsets();
    const isFocused = useIsFocused(); // Track if screen is focused
    const { getProductByBarcode, products: storeProducts, weightProducts, categories, fetchProducts, fetchWeightProducts, fetchCategories, addProduct, refreshProducts, setSearchQuery, selectedCategoryId, setSelectedCategory, isLoading, hasMore } = useProductStore();
    const { cart: products, addToCart, removeFromCart, updateQuantity, reset: clearCart } = useCartStore();

    const [searchRefreshing, setSearchRefreshing] = useState(false);
    const onSearchRefresh = useCallback(() => {
        setSearchRefreshing(true);
        refreshProducts();
        setTimeout(() => setSearchRefreshing(false), 1200);
    }, []);

    useEffect(() => {
        if (connectedScale && scaleWeight) {
            setWeightInput(scaleWeight);
            setSelectedUnit(WEIGHT_UNITS.find(u => u.value === 'kg'));
        }
    }, [connectedScale, scaleWeight]);

    useEffect(() => {
        if (route?.params?.tab) {
            setActiveTab(route.params.tab);
        }
        if (route?.params?.autoShowRestock && route?.params?.barcode) {
            setRestockBarcode(route.params.barcode);
            setShowRestockModal(true);
            
            // clear params to prevent infinite loop on re-render if needed
            navigation.setParams({ autoShowRestock: false, barcode: null, tab: null });
        }
    }, [route?.params]);

    // Enable real-time sync for products across devices
    useRealtimeSync();

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
    const soundRef = useRef(null);

    const [editingQty, setEditingQty] = useState({});

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
    const [selectedWeightCategoryId, setSelectedWeightCategoryId] = useState(FIXED_WEIGHT_CATEGORIES[0].id);
    const [selectedItem, setSelectedItem] = useState(null);
    const [weightInput, setWeightInput] = useState('1');
    const [selectedUnit, setSelectedUnit] = useState(WEIGHT_UNITS[0]);
    const [showWeightInputModal, setShowWeightInputModal] = useState(false);
    const [isAddingProduct, setIsAddingProduct] = useState(false);
    const [isSelling, setIsSelling] = useState(false);

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

    // Derive currentWeightCategory from weightCategories using ID
    const currentWeightCategory = useMemo(() => {
        return weightCategories.find(cat => cat.id === selectedWeightCategoryId) || weightCategories[0];
    }, [weightCategories, selectedWeightCategoryId]);

    // Helper to change category
    const setSelectedWeightCategory = (cat) => {
        setSelectedWeightCategoryId(cat.id);
    };

    // Fetch weight products when entering tab
    useEffect(() => {
        if (activeTab === 'weight') {
            fetchWeightProducts();
        }
    }, [activeTab]);

    // Clear selected item only if it's not in the current category
    useEffect(() => {
        if (currentWeightCategory && currentWeightCategory.items && currentWeightCategory.items.length > 0) {
            // If current selected item is NOT in this category, clear it
            if (selectedItem && !currentWeightCategory.items.find(i => i.id === selectedItem.id)) {
                setSelectedItem(null);
            }
        } else {
            setSelectedItem(null);
        }
    }, [currentWeightCategory]);

    // --- State: Modals ---
    const [quantityModalVisible, setQuantityModalVisible] = useState(false);
    const [selectedProductToAdd, setSelectedProductToAdd] = useState(null);
    const [showCartModal, setShowCartModal] = useState(false); // New: Cart Modal Visibility

    // --- Draggable FAB ---
    const fabPan = useRef(new Animated.ValueXY({ x: width - 80, y: height - 300 })).current;
    const fabPanOffset = useRef({ x: width - 80, y: height - 300 });
    const isDraggingFab = useRef(false);

    const fabPanResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (_, gestureState) => {
                return Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5;
            },
            onPanResponderGrant: () => {
                isDraggingFab.current = false;
                fabPan.setOffset({
                    x: fabPanOffset.current.x,
                    y: fabPanOffset.current.y,
                });
                fabPan.setValue({ x: 0, y: 0 });
            },
            onPanResponderMove: (_, gestureState) => {
                if (Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5) {
                    isDraggingFab.current = true;
                }
                const newX = fabPanOffset.current.x + gestureState.dx;
                const newY = fabPanOffset.current.y + gestureState.dy;
                const clampedX = Math.max(10, Math.min(newX, width - 70));
                const clampedY = Math.max(60, Math.min(newY, height - 200));
                fabPan.setValue({
                    x: clampedX - fabPanOffset.current.x,
                    y: clampedY - fabPanOffset.current.y,
                });
            },
            onPanResponderRelease: (_, gestureState) => {
                fabPan.flattenOffset();
                const currentX = fabPanOffset.current.x + gestureState.dx;
                const currentY = fabPanOffset.current.y + gestureState.dy;
                const clampedY = Math.max(60, Math.min(currentY, height - 200));
                // Snap to nearest edge
                const snapX = currentX < width / 2 ? 10 : width - 70;
                fabPanOffset.current = { x: snapX, y: clampedY };
                Animated.spring(fabPan, {
                    toValue: { x: snapX, y: clampedY },
                    useNativeDriver: false,
                    friction: 7,
                    tension: 40,
                }).start();
                // If not dragged, treat as tap
                if (!isDraggingFab.current) {
                    setShowCartModal(true);
                }
            },
        })
    ).current;

    // --- State: Add Product Modal ---
    const [showAddProductModal, setShowAddProductModal] = useState(false);
    const [newProductCategory, setNewProductCategory] = useState(null);
    const [showRestockModal, setShowRestockModal] = useState(false);
    const [restockBarcode, setRestockBarcode] = useState('');
    const [restockProduct, setRestockProduct] = useState(null);
    const [newProductName, setNewProductName] = useState('');
    const [newProductPrice, setNewProductPrice] = useState('');
    const [newProductCost, setNewProductCost] = useState('');
    const [newProductStock, setNewProductStock] = useState(''); // New state for stock
    const [newProductLowStock, setNewProductLowStock] = useState('5'); // Default Low Stock = 5kg
    const [newProductImage, setNewProductImage] = useState(null); // New: Image
    const [newProductExpireDate, setNewProductExpireDate] = useState(null); // New: Expire Date
    const [showDatePicker, setShowDatePicker] = useState(false); // New: Date Picker Visibility
    const [newProductUnit, setNewProductUnit] = useState(WEIGHT_UNITS[0]);
    const [fieldErrors, setFieldErrors] = useState({});

    const searchTimerRef = useRef(null);
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
                            // quality: 1, // Don't use this with base64
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
                            // quality: 1,
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

    // Pre-fill category when opening modal, reset when closing
    useEffect(() => {
        if (showAddProductModal && currentWeightCategory) {
            setNewProductCategory(currentWeightCategory);
        } else if (!showAddProductModal) {
            setNewProductName('');
            setNewProductPrice('');
            setNewProductCost('');
            setNewProductStock('');
            setNewProductLowStock('5');
            setNewProductImage(null);
            setNewProductExpireDate(null);
            setFieldErrors({});
        }
    }, [showAddProductModal, currentWeightCategory]);

    const handleAddProduct = async () => {
        if (isAddingProduct) return;
        // Validation
        const errors = {};
        if (!newProductName.trim()) errors.name = true;
        if (!newProductPrice || parseFloat(newProductPrice) <= 0) errors.price = true;
        if (!newProductStock || parseFloat(newProductStock) <= 0) errors.stock = true;
        if (newProductCost === '' || newProductCost === null || newProductCost === undefined) errors.cost = true;
        // วันหมดอายุ: ต้องเลือก + ห้ามย้อนหลัง
        if (!newProductExpireDate) {
            errors.expireDate = true;
        } else {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const expDate = new Date(newProductExpireDate);
            expDate.setHours(0, 0, 0, 0);
            if (expDate < today) {
                errors.expireDate = true;
                Alert.alert('วันหมดอายุไม่ถูกต้อง', 'ไม่สามารถเลือกวันที่ย้อนหลังได้');
                return;
            }
        }
        // ราคาทุน 0 ได้ ไม่ต้องเช็ค
        if (Object.keys(errors).length > 0) {
            setFieldErrors(errors);
            Alert.alert('ข้อมูลไม่ครบ', 'กรุณากรอกข้อมูลที่จำเป็นให้ครบ');
            return;
        }

        // ราคาขายต้องไม่ต่ำกว่าราคาทุน
        const sale = parseFloat(newProductPrice);
        const cost = parseFloat(newProductCost);
        if (newProductCost && !isNaN(cost) && cost > 0 && sale < cost) {
            Alert.alert(
                'ราคาขายต่ำกว่าทุน',
                `ราคาขาย ฿${sale} ต่ำกว่าราคาทุน ฿${cost}\nขายสินค้านี้จะขาดทุนทุกชิ้น กรุณาตรวจสอบอีกครั้ง`
            );
            setFieldErrors(prev => ({ ...prev, price: true }));
            return;
        }

        setFieldErrors({});
        setIsAddingProduct(true);

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
            unitType: newProductUnit.label,
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
        setIsAddingProduct(false);
    };

    // --- Effects: Sound & Permissions ---
    useEffect(() => {
        if (!permission) requestPermission();
        async function loadSound() {
            try {
                const { sound: newSound } = await Audio.Sound.createAsync(
                    require('../../assets/beep.mp3')
                );
                soundRef.current = newSound;
            } catch (error) { console.log('Error loading sound', error); }
        }
        loadSound();
        return () => { if (soundRef.current) soundRef.current.unloadAsync(); };
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
        try { if (soundRef.current) await soundRef.current.replayAsync(); } catch (e) { }
    };

    // --- Logic: Scan ---
    const isProcessingRef = useRef(false);
    const handleBarCodeScanned = async ({ data }) => {
        // Use ref instead of state for immediate synchronous blocking
        if (isProcessingRef.current) return;
        isProcessingRef.current = true;
        const hasLetters = /[a-zA-Zก-ฮ]/.test(data);

        if (hasLetters) {
            Alert.alert(
                "ข้อมูลไม่ถูกต้อง",
                "บาร์โค้ดที่สแกนมีตัวอักษรผสมอยู่ กรุณาสแกนใหม่อีกครั้ง",
                [{ text: "ตกลง" }]
            );
            setTimeout(() => { isProcessingRef.current = false; }, 2000);
            return; // หยุดการทำงาน
        }
        if (data.length !== 13) {
            const confirmed = await new Promise((resolve) => {
                Alert.alert(
                    "รูปแบบบาร์โค้ดไม่คุ้นเคย",
                    `ปกติบาร์โค้ดมี 13 หลัก รหัสนี้มี ${data.length} หลัก (${data})\nต้องการใช้งานต่อหรือไม่?`,
                    [
                        { text: "สแกนใหม่", style: "cancel", onPress: () => resolve(false) },
                        { text: "ใช้งานต่อ", onPress: () => resolve(true) }
                    ]
                );
            });
            if (!confirmed) {
                setTimeout(() => { isProcessingRef.current = false; }, 2000);
                return; // หยุดการทำงาน
            }
        }

        resetInactivityTimer();
        playSound();
        Vibration.vibrate(50);

        try {
            const product = await getProductByBarcode(data);

            // 1. ถ้าไม่เจอสินค้าในระบบ
            if (!product) {
                Alert.alert("ไม่พบสินค้า", `บาร์โค้ด: ${data} ไม่มีระบบ`);
                return; // หยุดการทำงานเลย สำคัญมาก!
            }

            // 2. ดึงจำนวนสต็อกมาเช็ค (รองรับทั้งชื่อตัวแปร stock_qty หรือ quantity)
            const stockQty = parseFloat(product.stock_qty || product.quantity || 0);
            // ==========================================
            // [เงื่อนไขสต็อก 0] -> ห้ามขายเด็ดขาด
            // ==========================================
            if (stockQty <= 0 && scanMode === 'sale') {
                Alert.alert(
                    "❌ สินค้าหมดสต็อก",
                    `"${product.name}" หมดสต็อกแล้ว ไม่สามารถสแกนขายได้`,
                    [{ text: "ตกลง" }]
                );
                return; // คืนค่ากลับไปเลย ไม่ต้องเอาลงตะกร้า (ตัวสกัดกั้น)
            }
            // ==========================================
            // [ตรวจสอบวันหมดอายุ]
            // ==========================================
            let isExpired = false;
            // ดึงค่าวันหมดอายุมาจากฐานข้อมูล (อาจจะมาในชื่อ expire_date หรือ expireDate)
            let expireDateStr = product.expire_date || product.expireDate;
            if (!expireDateStr && product.batches && product.batches.length > 0) {
                const batchesWithExpiry = product.batches
                    .filter(b => b.expire_date || b.expireDate)
                    .sort((a, b) => new Date(a.expire_date || a.expireDate) - new Date(b.expire_date || b.expireDate));

                if (batchesWithExpiry.length > 0) {
                    expireDateStr = batchesWithExpiry[0].expire_date || batchesWithExpiry[0].expireDate;
                }
            }

            if (expireDateStr) {
                let expireDate;
                if (expireDateStr.includes('/')) {
                    const parts = expireDateStr.split('/');
                    if (parts[0].length === 4) { // YYYY/MM/DD
                        expireDate = new Date(parts[0], parts[1] - 1, parts[2]);
                    } else { // DD/MM/YYYY
                        expireDate = new Date(parts[2], parts[1] - 1, parts[0]);
                    }
                } else if (expireDateStr.includes('-')) {
                    const parts = expireDateStr.split('T')[0].split('-');
                    if (parts[0].length === 4) { // YYYY-MM-DD
                        expireDate = new Date(parts[0], parts[1] - 1, parts[2]);
                    } else { // DD-MM-YYYY
                        expireDate = new Date(parts[2], parts[1] - 1, parts[0]);
                    }
                } else {
                    expireDate = new Date(expireDateStr);
                }

                if (!isNaN(expireDate.getTime())) {
                    expireDate.setHours(0, 0, 0, 0); // ตัดเศษเวลาทิ้ง เอาแค่วันที่

                    const today = new Date();
                    today.setHours(0, 0, 0, 0);

                    if (expireDate < today) {
                        isExpired = true; // แปลว่าหมดอายุแล้ว
                    }
                }
            }
            // ==========================================
            // เช็คว่าถ้าเป็นโหมดขายสินค้า
            // ==========================================
            if (scanMode === 'sale') {

                // ถ้าระบบตรวจเจอว่า "หมดอายุ"
                if (isExpired) {
                    Alert.alert(
                        "❌ สินค้าหมดอายุ",
                        `"${product.name}" หมดอายุแล้ว ไม่สามารถสแกนขายได้`,
                        [{ text: "ตกลง" }]
                    );
                    return;
                }

                // ราคาขาย < ราคาทุน warning
                const salePrice = parseFloat(product.price || 0);
                const costPrice = parseFloat(product.cost_price || 0);
                if (costPrice > 0 && salePrice < costPrice) {
                    const proceed = await new Promise((resolve) => {
                        Alert.alert(
                            'ราคาขายต่ำกว่าทุน',
                            `"${product.name}" ราคาขาย ฿${salePrice} แต่ต้นทุน ฿${costPrice}\nขายสินค้านี้จะขาดทุน ยืนยันขายต่อหรือไม่?`,
                            [
                                { text: 'ยกเลิก', style: 'cancel', onPress: () => resolve(false) },
                                { text: 'ขายต่อ', onPress: () => resolve(true) }
                            ]
                        );
                    });
                    if (!proceed) return;
                }

                // ถ้าฝ่าด่านด้านบนมาได้ทั้งหมด (ไม่หมดอายุ หรือ ดึงดันกดขายต่อ) ให้ดรอปลงตะกร้า
                addToCart(product, 1);

            } else {
                // ==========================================
                // โหมดสแกนเช็คราคา (Price Check Mode) โค้ดหน้าตาเดิมครับ
                // ==========================================
                let priceMsg = `ราคา: ฿${product.price}`;
                const promo = product.promotion;
                if (promo && promo.type === 'buy_x_get_y') {
                    priceMsg = `🔥 โปร: ซื้อ ${promo.min_qty} แถม ${promo.free_qty}\nราคาปกติ: ฿${product.price}`;
                } else if (product.discount_percent > 0) {
                    priceMsg = `🔥 ราคาโปร: ฿${product.price} (ปกติ ฿${product.original_price})\nลด ${product.discount_percent}%`;
                }
                // แอบเพิ่มแจ้งเตือนข้างท้ายให้ด้วยว่าหมดอายุ ตอนพนักงานเช็คราคาจะได้รู้
                let expireWarning = isExpired ? "\n⚠️ (สินค้านี้หมดอายุแล้ว!)" : "";
                Alert.alert(
                    product.name,
                    `${priceMsg}\nสต็อก: ${stockQty} ${product.unit_type || 'ชิ้น'}${expireWarning}`
                );
            }
        } catch (error) {
            console.log(error);
        } finally {
            // Longer debounce for iOS
            setTimeout(() => { isProcessingRef.current = false; }, 2000);
        }
    };

    // --- Logic: Payment ---
    // Calculate Total with Promotion Logic
    const calculateTotal = (items) => {
        return items.reduce((sum, p) => {
            let lineTotal = 0;
            const promo = p.promotion;

            if (promo && promo.type === 'buy_x_get_y') {
                const buy = promo.min_qty || 1;
                const get = promo.free_qty || 1;
                const setSize = buy + get;
                const fullSets = Math.floor(p.quantity / setSize);
                const remainder = p.quantity % setSize;

                // Pay for 'buy' amount in each set + remainder
                const payableQty = (fullSets * buy) + remainder;
                lineTotal = payableQty * p.price;
            } else if (promo && promo.type === 'bundle' && promo.min_spend) {
                const rawTotal = p.price * p.quantity;
                if (rawTotal >= promo.min_spend) {
                    lineTotal = rawTotal - parseFloat(promo.discount_value || 0);
                }
                else {
                    lineTotal = rawTotal;
                }
            } else {
                // Normal or Discount % (price is already discounted from backend)
                lineTotal = p.price * p.quantity;
            }
            return sum + lineTotal;
        }, 0);
    };

    const totalAmount = calculateTotal(products);
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

    const checkCartPromotionsAlert = () => {
        const missedPromos = [];

        products.forEach(p => {
            const promo = p.promotion;
            if (!promo) return;

            const qty = p.quantity;

            if (promo.type === 'buy_x_get_y') {
                const setSize = (promo.min_qty || 1) + (promo.free_qty || 1);
                const remainder = qty % setSize;

                if (remainder > 0) {
                    const need = setSize - remainder;
                    missedPromos.push(`- ${p.name}: ซื้อ ${promo.min_qty} แถม ${promo.free_qty} (ขาดอีก ${need} ชิ้น)`);
                }
            }
            else if (promo.type === 'bundle' && promo.min_spend) {
                const currentTotal = p.price * qty;
                if (currentTotal < promo.min_spend) {
                    const need = promo.min_spend - currentTotal;
                    missedPromos.push(`- ${p.name}: ลด ฿${promo.discount_value} เมื่อซื้อครบ ฿${promo.min_spend} (ขาดอีก ฿${need})`);
                }
            }
        });
        return missedPromos;
    };

    const handleCheckoutClick = () => {
        if (products.length === 0) {
            Alert.alert('ตะกร้าว่าง', 'กรุณาเพิ่มสินค้าลงตะกร้าก่อนทำรายการชำระเงิน');
            return;
        }
        const missedPromos = checkCartPromotionsAlert();

        if (missedPromos.length > 0) {
            Alert.alert(
                'แจ้งเตือนโปรโมชัน',
                'คุณมีโปรโมชันที่ยังใช้ไม่ครบ:\n\n' + missedPromos.join('\n') + '\n\nต้องการไปชำระเงินเลยหรือไม่?',
                [
                    { text: 'กลับไปเลือกของเพิ่ม', style: 'cancel' },
                    { text: 'ชำระเงินเลย', style: 'default', onPress: () => setShowPaymentModal(true) }
                ]
            );
        } else {
            setShowPaymentModal(true);
        }
    };

    const handleLoadMore = () => {
        if (!isLoading && hasMore) fetchProducts();
    };

    // --- Logic: Credit Sale ---
    const handleDebtConfirm = async (debtData) => {
        if (isSelling) return;
        setIsSelling(true);
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
        } finally {
            setIsSelling(false);
        }
    };

    // --- Logic: Normal Sale (Cash/QR) ---
    const handleNormalSale = async (paymentMethod, receivedAmount = 0) => {
        if (isSelling) return;
        setIsSelling(true);
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
                        price: item.price_per_unit,
                        unit: item.unit || 'ชิ้น'
                    })),
                    total: transactionData.total_amount,
                    received: receivedAmount || transactionData.total_amount,
                    change: (receivedAmount || transactionData.total_amount) - transactionData.total_amount,
                    store: transactionData.stores
                });

                clearCart();
                setShowReceiptModal(true);
                setTimeout(() => refreshProducts(), 500);
            } else {
                Alert.alert('ผิดพลาด', response.error || 'ไม่สามารถบันทึกการขายได้');
            }
        } catch (error) {
            Alert.alert('ผิดพลาด', `เกิดข้อผิดพลาดในการเชื่อมต่อ\n${error.message}`);
        } finally {
            setIsSelling(false);
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

        if (connectedScanner) {
            return (
                <View style={[styles.cameraSection, { backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }]}>
                    <Ionicons name="barcode-outline" size={60} color="#0A84FF" />
                    <Text style={{ color: '#fff', fontSize: 18, marginTop: 10, fontWeight: 'bold' }}>เครื่องสแกนไร้สายพร้อมใช้งาน</Text>
                    <Text style={{ color: '#888', fontSize: 14, marginTop: 5 }}>ยิงบาร์โค้ดที่สินค้าได้เลย</Text>
                    <TextInput
                        autoFocus={true}
                        showSoftInputOnFocus={false}
                        style={{ width: 0, height: 0, opacity: 0 }}
                        onSubmitEditing={(e) => handleBarCodeScanned({ data: e.nativeEvent.text })}
                    />
                </View>
            );
        }

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
                removeClippedSubviews={true}
                maxToRenderPerBatch={10}
                windowSize={5}
                style={styles.cartList}
                contentContainerStyle={{ padding: 15, paddingBottom: 20 }}
                ListEmptyComponent={
                    <View style={styles.emptyCart}>
                        <Text style={{ color: '#aaa' }}>ยังไม่มีสินค้าในตะกร้า</Text>
                    </View>
                }
                renderItem={({ item }) => (
                    <View style={styles.cartItem}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                            {(item.image_url || item.image) ? (
                                <Image source={{ uri: item.image_url || item.image }} style={styles.cartItemImage} />
                            ) : (
                                <View style={[styles.cartItemImage, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#F0F0F0' }]}>
                                    <Ionicons name="cube-outline" size={24} color="#ccc" />
                                </View>
                            )}
                            <View style={{ marginLeft: 10, flex: 1 }}>
                                <Text style={styles.cartItemName} numberOfLines={1}>{item.name}</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                                    {item.discount_percent > 0 && (
                                        <Text style={{ textDecorationLine: 'line-through', color: '#999', fontSize: 12, marginRight: 5 }}>
                                            ฿{item.original_price}
                                        </Text>
                                    )}
                                    <Text style={[styles.cartItemPrice, item.discount_percent > 0 && { color: '#F37021', fontWeight: 'bold' }]}>
                                        ฿{item.price}
                                    </Text>

                                    {/* B1G1 Badge in Cart */}
                                    {item.promotion?.type === 'buy_x_get_y' && (
                                        <View style={{ marginLeft: 8, backgroundColor: '#FFD700', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                                            <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#000' }}>
                                                ซื้อ {item.promotion.min_qty} แถม {item.promotion.free_qty}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        </View>
                        {/* Qty Controls */}
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>


                            {/* ปุ่ม +/- กับช่องกรอกจำนวน */}
                            <View style={styles.qtyContainer}>
                                <TouchableOpacity
                                    onPress={() => { if (item.quantity > 1) updateQuantity(item.id, item.quantity - 1); }}
                                    style={[styles.qtyBtn, item.quantity <= 1 && { opacity: 0.3 }]}
                                    disabled={item.quantity <= 1}
                                >
                                    <Ionicons name="remove" size={16} color="#555" />
                                </TouchableOpacity>

                                <TextInput
                                    style={[styles.qtyText, { textAlign: 'center', minWidth: 30, padding: 2 }]}
                                    keyboardType="number-pad"
                                    value={editingQty[item.id] !== undefined ? editingQty[item.id] : String(item.quantity)}
                                    onFocus={() => {
                                        setEditingQty(prev => ({ ...prev, [item.id]: String(item.quantity) }));
                                    }}
                                    onChangeText={(text) => {
                                        setEditingQty(prev => ({ ...prev, [item.id]: text }));
                                    }}
                                    onEndEditing={() => {
                                        const text = editingQty[item.id];
                                        const num = parseInt(text) || 0;
                                        const maxStock = parseFloat(item.stock_qty || item.quantity || 0);

                                        if (num === 0) {
                                            Alert.alert('ลบสินค้า', `ต้องการลบ "${item.name}" ออกจากตะกร้าใช่หรือไม่?`, [
                                                { text: 'ยกเลิก', style: 'cancel', onPress: () => updateQuantity(item.id, 1) },
                                                { text: 'ลบ', style: 'destructive', onPress: () => removeFromCart(item.id) }
                                            ]);
                                        } else if (num > maxStock) {
                                            Alert.alert('สินค้าไม่พอ', `"${item.name}" มีสต็อกเพียง ${maxStock} ชิ้น`);
                                            updateQuantity(item.id, maxStock);
                                        } else {
                                            updateQuantity(item.id, num);
                                        }
                                        setEditingQty(prev => { const copy = { ...prev }; delete copy[item.id]; return copy; });
                                    }}
                                />

                                <TouchableOpacity
                                    onPress={() => {
                                        const maxStock = parseFloat(item.stock_qty || item.quantity || 0);
                                        if (item.quantity + 1 > maxStock) {
                                            Alert.alert('สินค้าไม่พอ', `"${item.name}" มีสต็อกเพียง ${maxStock} ชิ้น`);
                                        } else {
                                            addToCart(item, 1);
                                        }
                                    }}
                                    style={styles.qtyBtn}
                                >
                                    <Ionicons name="add" size={16} color="#555" />
                                </TouchableOpacity>
                            </View>
                            {/* ปุ่มลบแยก */}
                            <TouchableOpacity
                                onPress={() => {
                                    Alert.alert(
                                        'ลบสินค้า',
                                        `ต้องการลบ "${item.name}" ออกจากตะกร้าใช่หรือไม่?`,
                                        [
                                            { text: 'ยกเลิก', style: 'cancel' },
                                            { text: 'ลบ', style: 'destructive', onPress: () => removeFromCart(item.id) }
                                        ]
                                    );
                                }}
                                style={{ padding: 6, marginLeft: 10 }}
                            >
                                <Ionicons name="trash" size={18} color="#FF3B30" />
                            </TouchableOpacity>
                        </View>

                    </View>
                )}
            />
        );
    };

    const renderSearchItem = useCallback(({ item }) => {
        const handleAddFromSearch = async () => {
            const stockQty = parseFloat(item.stock_qty || item.quantity || 0);

            // 1. Check Zero Stock
            if (stockQty <= 0) {
                Alert.alert(
                    "❌ สินค้าหมดสต็อก",
                    `"${item.name}" หมดสต็อกแล้ว ไม่สามารถเพิ่มลงตะกร้าได้`,
                    [{ text: "ตกลง" }]
                );
                return;
            }

            // 2. Check Expiry
            let isExpired = false;
            const expireDateStr = item.expire_date || item.expireDate;

            if (expireDateStr) {
                let expireDate;
                if (expireDateStr.includes('/')) {
                    const parts = expireDateStr.split('/');
                    if (parts[0].length === 4) { // YYYY/MM/DD
                        expireDate = new Date(parts[0], parts[1] - 1, parts[2]);
                    } else { // DD/MM/YYYY
                        expireDate = new Date(parts[2], parts[1] - 1, parts[0]);
                    }
                } else if (expireDateStr.includes('-')) {
                    const parts = expireDateStr.split('T')[0].split('-');
                    if (parts[0].length === 4) { // YYYY-MM-DD
                        expireDate = new Date(parts[0], parts[1] - 1, parts[2]);
                    } else { // DD-MM-YYYY
                        expireDate = new Date(parts[2], parts[1] - 1, parts[0]);
                    }
                } else {
                    expireDate = new Date(expireDateStr);
                }

                if (!isNaN(expireDate.getTime())) {
                    expireDate.setHours(0, 0, 0, 0);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);

                    if (expireDate < today) {
                        isExpired = true;
                    }
                }
            }

            if (isExpired) {
                Alert.alert(
                    "❌ สินค้าหมดอายุ",
                    `"${item.name}" หมดอายุแล้ว ไม่สามารถเพิ่มลงตะกร้าได้`,
                    [{ text: "ตกลง" }]
                );
                return;
            }

            // ราคาขาย < ราคาทุน warning
            const salePrice = parseFloat(item.price || 0);
            const costPrice = parseFloat(item.cost_price || 0);
            if (costPrice > 0 && salePrice < costPrice) {
                const proceed = await new Promise((resolve) => {
                    Alert.alert(
                        'ราคาขายต่ำกว่าทุน',
                        `"${item.name}" ราคาขาย ฿${salePrice} แต่ต้นทุน ฿${costPrice}\nขายสินค้านี้จะขาดทุน ยืนยันขายต่อหรือไม่?`,
                        [
                            { text: 'ยกเลิก', style: 'cancel', onPress: () => resolve(false) },
                            { text: 'ขายต่อ', onPress: () => resolve(true) }
                        ]
                    );
                });
                if (!proceed) return;
            }

            // All checks passed, proceed to show quantity modal
            setSelectedProductToAdd(item);
            setQuantityModalVisible(true);
        };

        return (
            <View style={styles.gridItem}>
                {item.image_url ? (
                    <Image source={{ uri: item.image_url }} style={styles.gridImage} />
                ) : (
                    <View style={[styles.gridImage, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#F0F0F0' }]}>
                        <Ionicons name="cube-outline" size={32} color="#ccc" />
                    </View>
                )}
                <Text numberOfLines={1} style={styles.gridName}>{item.name}</Text>
                <Text style={styles.gridPrice}>฿{item.price}</Text>
                <TouchableOpacity style={styles.addButton} onPress={handleAddFromSearch}>
                    <Ionicons name="add" size={24} color="#fff" />
                </TouchableOpacity>
            </View>
        );
    }, []);

    // 5. SEARCH VIEW
    const renderSearchView = () => {
        if (activeTab !== 'search') return null;
        const displayProducts = (searchQueryLocal.trim()
            ? storeProducts.filter(p =>
                p.name?.toLowerCase().includes(searchQueryLocal.toLowerCase().trim()) ||
                p.barcode?.toLowerCase().includes(searchQueryLocal.toLowerCase().trim())
            )
            : storeProducts
        ).filter(p => parseFloat(p.stock_qty || 0) > 0);
        return (
            <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
                {/* Search Bar */}
                <View style={styles.searchHeader}>
                    <View style={styles.searchBar}>
                        <Ionicons name="search" size={20} color="#999" style={{ marginLeft: 10 }} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="ค้นหาสินค้า..."
                            value={searchQueryLocal}
                            onChangeText={(text) => {
                                setSearchQueryLocal(text);
                            }}
                        />
                    </View>
                </View>

                {/* Grid */}
                <FlatList
                    data={displayProducts}
                    numColumns={2}
                    keyExtractor={item => item.id}
                    removeClippedSubviews={true}
                    maxToRenderPerBatch={6}
                    windowSize={3}
                    initialNumToRender={4}
                    contentContainerStyle={SEARCH_CONTENT_STYLE}
                    columnWrapperStyle={COLUMN_WRAPPER_STYLE}
                    onEndReached={handleLoadMore}
                    renderItem={renderSearchItem}
                    refreshControl={<RefreshControl refreshing={searchRefreshing} onRefresh={onSearchRefresh} colors={['#F37021']} tintColor="#F37021" />}
                    ListEmptyComponent={
                        <View style={{ alignItems: 'center', paddingVertical: 60 }}>
                            <Ionicons name="search-outline" size={60} color="#E0E0E0" />
                            <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#888', marginTop: 15 }}>ไม่พบสินค้า</Text>
                            <Text style={{ fontSize: 14, color: '#aaa', marginTop: 6, textAlign: 'center', paddingHorizontal: 30 }}>
                                {searchQueryLocal.trim() ? `ไม่พบสินค้า "${searchQueryLocal}" ในระบบ` : 'ยังไม่มีสินค้าในระบบ\nกรุณาเพิ่มสินค้าก่อนใช้งาน'}
                            </Text>
                        </View>
                    }
                />
            </View>
        );
    };

    // 6. WEIGHT VIEW — Clean UX Redesign
    const renderWeightView = () => {
        if (activeTab !== 'weight') return null;

        const renderProductCard = (item) => {
            const isSelected = selectedItem?.id === item.id;
            return (
                <TouchableOpacity
                    key={item.id}
                    style={[styles.wProductCard, isSelected && styles.wProductCardSelected]}
                    onPress={() => {
                        setSelectedItem(item);
                        setWeightInput('1');
                        setSelectedUnit(WEIGHT_UNITS.find(u => u.label === item.unit_type) || WEIGHT_UNITS[0]);
                        setShowWeightInputModal(true);
                    }}
                    activeOpacity={0.7}
                >
                    <View style={styles.wCardImageWrap}>
                        {item.image_url ? (
                            <Image source={{ uri: item.image_url }} style={styles.wCardImage} />
                        ) : (
                            <View style={styles.wCardImagePlaceholder}>
                                <Ionicons name="cube-outline" size={28} color="#ccc" />
                            </View>
                        )}
                        <TouchableOpacity
                            style={styles.wCardRestockBtn}
                            onPress={(e) => {
                                e.stopPropagation();
                                if (item.barcode) {
                                    setRestockBarcode(item.barcode);
                                    setRestockProduct(null);
                                } else {
                                    setRestockBarcode('');
                                    setRestockProduct(item);
                                }
                                setShowRestockModal(true);
                            }}
                        >
                            <Ionicons name="add-circle" size={26} color="#F37021" />
                        </TouchableOpacity>
                    </View>
                    <Text style={styles.wCardName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.wCardPrice}>฿{item.price}<Text style={styles.wCardUnit}>/{item.unit_type || 'กก.'}</Text></Text>
                </TouchableOpacity>
            );
        };

        return (
            <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
                {/* Category Bar — Horizontal Scroll */}
                <View style={styles.wCategoryBar}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
                        {weightCategories?.map(cat => (
                            <TouchableOpacity
                                key={cat.id}
                                style={[styles.wCategoryChip, currentWeightCategory?.id === cat.id && styles.wCategoryChipActive]}
                                onPress={() => setSelectedWeightCategory(cat)}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.wCategoryEmoji}>{cat.emoji}</Text>
                                <Text style={[styles.wCategoryLabel, currentWeightCategory?.id === cat.id && styles.wCategoryLabelActive]}>{cat.name}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* Section Header */}
                <View style={styles.wSectionHeader}>
                    <Text style={styles.wSectionTitle}>{currentWeightCategory?.emoji} {currentWeightCategory?.name}</Text>
                    <TouchableOpacity
                        style={styles.wAddBtn}
                        onPress={() => setShowAddProductModal(true)}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="add" size={18} color="#F37021" />
                        <Text style={styles.wAddBtnText}>เพิ่ม</Text>
                    </TouchableOpacity>
                </View>

                {/* Product Grid — 2 columns */}
                {currentWeightCategory?.items?.length > 0 ? (
                    <ScrollView
                        contentContainerStyle={{ paddingBottom: 120 }}
                        showsVerticalScrollIndicator={false}
                    >
                        <View style={styles.wGridContainer}>
                            {currentWeightCategory.items.map(item => renderProductCard(item))}
                        </View>
                    </ScrollView>
                ) : (
                    <View style={styles.wEmptyState}>
                        <Ionicons name="basket-outline" size={48} color="#ddd" />
                        <Text style={styles.wEmptyText}>ยังไม่มีสินค้าในหมวดนี้</Text>
                        <TouchableOpacity
                            style={styles.wEmptyAddBtn}
                            onPress={() => setShowAddProductModal(true)}
                        >
                            <Ionicons name="add" size={16} color="#fff" />
                            <Text style={styles.wEmptyAddText}>เพิ่มสินค้าตัวแรก</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        );
    };

    // 6.5 WEIGHT INPUT MODAL
    const renderWeightInputModal = () => {
        if (!selectedItem) return null;
        const productMultiplier = getUnitMultiplier(selectedItem?.unit_type);
        const qtyInProductUnit = (parseFloat(weightInput) || 0) * selectedUnit.multiplier / productMultiplier;
        const total = qtyInProductUnit * (selectedItem?.price || 0);
        const stockInSelectedUnit = (parseFloat(selectedItem.stock_qty || 0) * getUnitMultiplier(selectedItem.unit_type)) / selectedUnit.multiplier;
        const exceedsStock = (parseFloat(weightInput) || 0) > stockInSelectedUnit;

        return (
            <Modal
                visible={showWeightInputModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowWeightInputModal(false)}
            >
                <TouchableWithoutFeedback onPress={() => setShowWeightInputModal(false)}>
                    <View style={styles.wModalOverlay}>
                        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                            <KeyboardAvoidingView
                                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                            >
                                <SafeAreaView edges={['bottom']} style={styles.wModalContent}>
                                    {/* Handle indicator */}
                                    <View style={styles.wModalHandle} />

                                    {/* Product info header */}
                                    <View style={styles.wModalHeader}>
                                        <View style={styles.wModalImageWrap}>
                                            {selectedItem.image_url ? (
                                                <Image source={{ uri: selectedItem.image_url }} style={styles.wModalImage} />
                                            ) : (
                                                <View style={[styles.wModalImage, { backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' }]}>
                                                    <Ionicons name="cube-outline" size={24} color="#ccc" />
                                                </View>
                                            )}
                                        </View>
                                        <View style={{ flex: 1, marginLeft: 14 }}>
                                            <Text style={styles.wModalName}>{selectedItem.name}</Text>
                                            {selectedItem.is_promotion && selectedItem.original_price > selectedItem.price ? (
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                    <Text style={{ color: '#999', textDecorationLine: 'line-through', fontSize: 13 }}>฿{selectedItem.original_price}</Text>
                                                    <Text style={styles.wModalPrice}>฿{selectedItem.price}<Text style={{ color: '#999', fontWeight: 'normal', fontSize: 13 }}> /{selectedUnit.label}</Text></Text>
                                                </View>
                                            ) : (
                                                <Text style={styles.wModalPrice}>฿{selectedItem.price}<Text style={{ color: '#999', fontWeight: 'normal', fontSize: 13 }}> /{selectedUnit.label}</Text></Text>
                                            )}
                                        </View>
                                        <TouchableOpacity onPress={() => setShowWeightInputModal(false)} style={styles.wModalCloseBtn}>
                                            <Ionicons name="close" size={20} color="#999" />
                                        </TouchableOpacity>
                                    </View>

                                    {/* Weight Input */}
                                    {connectedScale ? (
                                        <View style={[styles.wInputFieldWrap, { backgroundColor: '#000', paddingVertical: 20 }]}>
                                            <Ionicons name="bluetooth" size={20} color="#30D158" style={{ position: 'absolute', top: 10, left: 10 }} />
                                            <Text style={[styles.wInputField, { color: '#30D158' }]}>{weightInput}</Text>
                                            <Text style={[styles.wInputUnitLabel, { color: '#888' }]}>{selectedUnit.label}</Text>
                                        </View>
                                    ) : (
                                        <View style={styles.wInputFieldWrap}>
                                            <Ionicons name="scale-outline" size={20} color="#bbb" style={{ marginRight: 8 }} />
                                            <TextInput
                                                style={styles.wInputField}
                                                value={weightInput}
                                                onChangeText={setWeightInput}
                                                keyboardType="decimal-pad"
                                                placeholder="0"
                                                placeholderTextColor="#ccc"
                                            />
                                            <Text style={styles.wInputUnitLabel}>{selectedUnit.label}</Text>
                                        </View>
                                    )}
                                    {connectedScale && (
                                        <Text style={{ textAlign: 'center', color: '#888', marginTop: 10, fontSize: 13 }}>⚫ รับค่าน้ำหนักจากตาชั่งอัตโนมัติ</Text>
                                    )}

                                    {/* Unit Selector */}
                                    <View style={styles.wUnitRow}>
                                        {WEIGHT_UNITS.map(unit => (
                                            <TouchableOpacity
                                                key={unit.value}
                                                style={[
                                                    styles.wUnitBtn,
                                                    selectedUnit.value === unit.value && styles.wUnitBtnActive,
                                                    connectedScale && styles.wUnitBtnDisabled
                                                ]}
                                                onPress={() => {
                                                    if (!connectedScale) setSelectedUnit(unit);  // กดได้เฉพาะตอนไม่ได้ต่อตาชั่ง
                                                }}
                                                activeOpacity={connectedScale ? 1 : 0.7}
                                            >
                                                <Text style={[styles.wUnitBtnText, selectedUnit.value === unit.value && styles.wUnitBtnTextActive]}>{unit.label}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                    {/* Stock remaining */}
                                    <Text style={{ textAlign: 'center', color: exceedsStock ? '#FF3B30' : '#888', marginTop: 4, fontSize: 13 }}>
                                        คงเหลือ: {stockInSelectedUnit.toFixed(2)} {selectedUnit.label}
                                    </Text>

                                    {/* Total + Add to Cart */}
                                    <View style={styles.wModalTotal}>
                                        <Text style={styles.wModalTotalLabel}>รวม</Text>
                                        <Text style={styles.wModalTotalAmount}>฿{total.toFixed(0)}</Text>
                                    </View>

                                    <TouchableOpacity
                                        style={[styles.wCartBtn, exceedsStock && { opacity: 0.5 }]}
                                        disabled={exceedsStock || (parseFloat(weightInput) || 0) <= 0}
                                        onPress={async () => {
                                            // Check Expiry
                                            let isExpired = false;
                                            const expireDateStr = selectedItem.expire_date || selectedItem.expireDate;

                                            if (expireDateStr) {
                                                let expireDate;
                                                if (expireDateStr.includes('/')) {
                                                    const parts = expireDateStr.split('/');
                                                    if (parts[0].length === 4) { // YYYY/MM/DD
                                                        expireDate = new Date(parts[0], parts[1] - 1, parts[2]);
                                                    } else { // DD/MM/YYYY
                                                        expireDate = new Date(parts[2], parts[1] - 1, parts[0]);
                                                    }
                                                } else if (expireDateStr.includes('-')) {
                                                    const parts = expireDateStr.split('T')[0].split('-');
                                                    if (parts[0].length === 4) { // YYYY-MM-DD
                                                        expireDate = new Date(parts[0], parts[1] - 1, parts[2]);
                                                    } else { // DD-MM-YYYY
                                                        expireDate = new Date(parts[2], parts[1] - 1, parts[0]);
                                                    }
                                                } else {
                                                    expireDate = new Date(expireDateStr);
                                                }

                                                if (!isNaN(expireDate.getTime())) {
                                                    expireDate.setHours(0, 0, 0, 0);
                                                    const today = new Date();
                                                    today.setHours(0, 0, 0, 0);

                                                    if (expireDate < today) {
                                                        isExpired = true;
                                                    }
                                                }
                                            }

                                            if (isExpired) {
                                                Alert.alert(
                                                    "❌ สินค้าหมดอายุ",
                                                    `"${selectedItem.name}" หมดอายุแล้ว ไม่สามารถเพิ่มลงตะกร้าได้`,
                                                    [{ text: "ตกลง" }]
                                                );
                                                return;
                                            }

                                            // ราคาขาย < ราคาทุน warning
                                            const itemSalePrice = parseFloat(selectedItem.price || 0);
                                            const itemCostPrice = parseFloat(selectedItem.cost_price || 0);
                                            if (itemCostPrice > 0 && itemSalePrice < itemCostPrice) {
                                                const proceed = await new Promise((resolve) => {
                                                    Alert.alert(
                                                        'ราคาขายต่ำกว่าทุน',
                                                        `"${selectedItem.name}" ราคาขาย ฿${itemSalePrice} แต่ต้นทุน ฿${itemCostPrice}\nขายสินค้านี้จะขาดทุน ยืนยันขายต่อหรือไม่?`,
                                                        [
                                                            { text: 'ยกเลิก', style: 'cancel', onPress: () => resolve(false) },
                                                            { text: 'ขายต่อ', onPress: () => resolve(true) }
                                                        ]
                                                    );
                                                });
                                                if (!proceed) return;
                                            }

                                            const product = { ...selectedItem, unit: selectedUnit.label, isWeight: true };
                                            const productMultiplier = getUnitMultiplier(selectedItem.unit_type);
                                            const pricePerUnit = selectedItem.price * (selectedUnit.multiplier / productMultiplier);
                                            addToCart({
                                                ...product,
                                                id: `weight-${product.id}-${Date.now()}`,
                                                product_id: product.id,
                                                image: selectedItem.image_url || null,
                                                image_url: selectedItem.image_url || null,
                                                price: pricePerUnit,
                                                unit: selectedUnit.label,
                                                unit_code: selectedUnit.value,
                                                unit_type: selectedUnit.label,
                                            }, parseFloat(weightInput));
                                            setShowWeightInputModal(false);
                                            setSelectedItem(null);
                                            Alert.alert('สำเร็จ', `เพิ่ม ${selectedItem.name} ${weightInput} ${selectedUnit.label} แล้ว`);
                                        }}
                                        activeOpacity={0.8}
                                    >
                                        <Ionicons name="cart-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                                        <Text style={styles.wCartBtnText}>เพิ่มใส่ตะกร้า</Text>
                                    </TouchableOpacity>
                                </SafeAreaView>
                            </KeyboardAvoidingView>
                        </TouchableWithoutFeedback>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>
        );
    };

    // 7. RENDER ADD PRODUCT MODAL
    const renderAddProductModal = () => (
        <React.Fragment>
            <Modal
                visible={showAddProductModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowAddProductModal(false)}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.modalOverlay}
                >
                    <View style={[styles.modalContainer, { paddingBottom: Math.max(insets.bottom, 20) + 20, maxHeight: height * 0.9 }]}>
                        {/* Header */}
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>เพิ่มสินค้าใหม่</Text>
                            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowAddProductModal(false)}>
                                <Ionicons name="close" size={24} color="#666" />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.handleIndicator} />

                        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
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
                            <Text style={[styles.inputLabel, fieldErrors.name && { color: '#E53935' }]}>
                                <Ionicons name="cube-outline" size={14} /> ชื่อสินค้า *
                            </Text>
                            <TextInput
                                style={[styles.textInput, fieldErrors.name && { borderColor: '#E53935', borderWidth: 1.5 }]}
                                placeholder="เช่น สามชั้นสไลด์"
                                value={newProductName}
                                onChangeText={(text) => {
                                    setNewProductName(text);
                                    if (text.trim()) setFieldErrors(prev => { const c = { ...prev }; delete c.name; return c; });
                                }}
                            />

                            {/* Cost Price */}
                            <Text style={[styles.inputLabel, fieldErrors.cost && { color: '#E53935' }]}>
                                <Ionicons name="pricetags-outline" size={14} /> ต้นทุน (บาท) *
                            </Text>
                            <View style={[styles.textInput, { flexDirection: 'row', alignItems: 'center' }, fieldErrors.cost && { borderColor: '#E53935', borderWidth: 1.5 }]}>
                                <Text style={{ fontSize: 16, color: '#999', marginRight: 10 }}>฿</Text>
                                <TextInput
                                    style={{ flex: 1, fontSize: 16 }}
                                    keyboardType="numeric"
                                    value={newProductCost}
                                    onChangeText={(text) => {
                                        setNewProductCost(text);
                                        if (text !== '') setFieldErrors(prev => { const c = { ...prev }; delete c.cost; return c; });
                                    }}
                                />
                            </View>

                            {/* Price Input */}
                            <Text style={[styles.inputLabel, fieldErrors.price && { color: '#E53935' }]}>
                                <Ionicons name="cash-outline" size={14} /> ราคาขาย (บาท) *
                            </Text>
                            <View style={[styles.textInput, { flexDirection: 'row', alignItems: 'center' }, fieldErrors.price && { borderColor: '#E53935', borderWidth: 1.5 }]}>
                                <Text style={{ fontSize: 16, color: '#999', marginRight: 10 }}>฿</Text>
                                <TextInput
                                    style={{ flex: 1, fontSize: 16 }}
                                    keyboardType="numeric"
                                    value={newProductPrice}
                                    onChangeText={(text) => {
                                        setNewProductPrice(text);
                                        if (parseFloat(text) > 0) setFieldErrors(prev => { const c = { ...prev }; delete c.price; return c; });
                                    }}
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
                                    <Text style={[styles.inputLabel, fieldErrors.stock && { color: '#E53935' }]}>
                                        <Ionicons name="layers-outline" size={14} /> สต็อก ({newProductUnit.label}) *
                                    </Text>
                                    <TextInput
                                        style={[styles.textInput, fieldErrors.stock && { borderColor: '#E53935', borderWidth: 1.5 }]}
                                        placeholder="0"
                                        keyboardType="numeric"
                                        value={newProductStock}
                                        onChangeText={(text) => {
                                            setNewProductStock(text);
                                            if (parseFloat(text) > 0) setFieldErrors(prev => { const c = { ...prev }; delete c.stock; return c; });
                                        }}
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

                            <Text style={[styles.inputLabel, fieldErrors.expireDate && { color: '#E53935' }]}>
                                <Ionicons name="calendar-outline" size={14} /> วันหมดอายุ *
                            </Text>
                            <TouchableOpacity style={[styles.textInput, fieldErrors.expireDate && { borderColor: '#E53935', borderWidth: 1.5 }]} onPress={() => { Keyboard.dismiss(); setShowDatePicker(true); }}>
                                <Text style={{ color: newProductExpireDate ? '#333' : '#aaa' }}>
                                    {newProductExpireDate ? newProductExpireDate.toLocaleDateString('th-TH') : 'เลือกวันหมดอายุ'}
                                </Text>
                            </TouchableOpacity>
                            {/* Android Date Picker (inline) */}
                            {showDatePicker && Platform.OS === 'android' && (
                                <DateTimePicker
                                    value={newProductExpireDate || new Date()}
                                    mode="date"
                                    display="default"
                                    minimumDate={new Date()}
                                    onChange={(event, selectedDate) => {
                                        setShowDatePicker(false);
                                        if (event.type === 'set' && selectedDate) {
                                            setNewProductExpireDate(selectedDate);
                                            setFieldErrors(prev => { const c = { ...prev }; delete c.expireDate; return c; });
                                        }
                                    }}
                                />
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
                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 30 }}>
                            <TouchableOpacity
                                style={[styles.modalMainButton, { backgroundColor: '#F5F5F5', flex: 1, marginTop: 0 }]}
                                onPress={() => setShowAddProductModal(false)}
                            >
                                <Text style={[styles.modalMainButtonText, { color: '#666' }]}>ยกเลิก</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalMainButton, { flex: 2, marginTop: 0 }, isAddingProduct && { opacity: 0.6 }]}
                                onPress={handleAddProduct}
                                disabled={isAddingProduct}
                            >
                                {isAddingProduct ? (
                                    <ActivityIndicator color="#fff" size="small" />
                                ) : (
                                    <Text style={styles.modalMainButtonText}>บันทึกสินค้า</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>

                {/* iOS Date Picker Overlay */}
                {Platform.OS === 'ios' && showDatePicker && (
                    <TouchableWithoutFeedback onPress={() => setShowDatePicker(false)}>
                        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 999 }}>
                            <TouchableWithoutFeedback>
                                <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 30 }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#eee' }}>
                                        <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                                            <Text style={{ fontSize: 16, color: '#888' }}>ยกเลิก</Text>
                                        </TouchableOpacity>
                                        <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#333' }}>เลือกวันหมดอายุ</Text>
                                        <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                                            <Text style={{ fontSize: 16, color: '#007AFF', fontWeight: '600' }}>ตกลง</Text>
                                        </TouchableOpacity>
                                    </View>
                                    <DateTimePicker
                                        value={newProductExpireDate || new Date()}
                                        mode="date"
                                        display="spinner"
                                        minimumDate={new Date()}
                                        onChange={(_, selectedDate) => {
                                            if (selectedDate) {
                                                setNewProductExpireDate(selectedDate);
                                                setFieldErrors(prev => { const c = { ...prev }; delete c.expireDate; return c; });
                                            }
                                        }}
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
        </React.Fragment >
    );


    // 7. CART MODAL & FAB
    const renderCartModal = () => (
        <Modal
            visible={showCartModal}
            animationType="slide"
            transparent={true}
            onRequestClose={() => setShowCartModal(false)}
        >
            <View style={styles.modalOverlay}>
                <View style={[styles.modalContainer, { maxHeight: height * 0.8 }]}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>ตะกร้าสินค้า ({products.length})</Text>
                        <TouchableOpacity onPress={() => setShowCartModal(false)} style={styles.modalCloseButton}>
                            <Ionicons name="close" size={24} color="#666" />
                        </TouchableOpacity>
                    </View>
                    <FlatList
                        data={products}
                        keyExtractor={item => item.id}
                        removeClippedSubviews={true}
                        maxToRenderPerBatch={10}
                        windowSize={5}
                        style={{ marginTop: 10 }}
                        contentContainerStyle={{ paddingBottom: 20 }}
                        ListEmptyComponent={<Text style={{ textAlign: 'center', color: '#999', marginTop: 20 }}>ไม่มีสินค้าในตะกร้า</Text>}
                        renderItem={({ item }) => (
                            <View style={styles.cartItem}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                    {(item.image_url || item.image) ? (
                                        <Image source={{ uri: item.image_url || item.image }} style={styles.cartItemImage} />
                                    ) : (
                                        <View style={[styles.cartItemImage, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#F0F0F0' }]}>
                                            <Ionicons name="cube-outline" size={24} color="#ccc" />
                                        </View>
                                    )}
                                    <View style={{ marginLeft: 10, flex: 1 }}>
                                        <Text style={styles.cartItemName} numberOfLines={1}>{item.name}</Text>
                                        <Text style={styles.cartItemPrice}>฿{item.price}</Text>
                                    </View>
                                </View>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    {/* ปุ่ม +/- กับช่องกรอกจำนวน */}
                                    <View style={styles.qtyContainer}>
                                        <TouchableOpacity
                                            onPress={() => { if (item.quantity > 1) updateQuantity(item.id, item.quantity - 1); }}
                                            style={[styles.qtyBtn, item.quantity <= 1 && { opacity: 0.3 }]}
                                            disabled={item.quantity <= 1}
                                        >
                                            <Ionicons name="remove" size={16} color="#555" />
                                        </TouchableOpacity>
                                        <TextInput
                                            style={[styles.qtyText, { textAlign: 'center', minWidth: 30, padding: 2 }]}
                                            keyboardType="number-pad"
                                            value={editingQty[item.id] !== undefined ? editingQty[item.id] : String(item.quantity)}
                                            onFocus={() => {
                                                setEditingQty(prev => ({ ...prev, [item.id]: String(item.quantity) }));
                                            }}
                                            onChangeText={(text) => {
                                                setEditingQty(prev => ({ ...prev, [item.id]: text }));
                                            }}
                                            onEndEditing={() => {
                                                const text = editingQty[item.id];
                                                const num = parseInt(text) || 0;
                                                const maxStock = parseFloat(item.stock_qty || 0);
                                                if (num === 0) {
                                                    Alert.alert('ลบสินค้า', `ต้องการลบ "${item.name}" ออกจากตะกร้าใช่หรือไม่?`, [
                                                        { text: 'ยกเลิก', style: 'cancel', onPress: () => updateQuantity(item.id, 1) },
                                                        { text: 'ลบ', style: 'destructive', onPress: () => removeFromCart(item.id) }
                                                    ]);
                                                } else if (num > maxStock) {
                                                    Alert.alert('เกินจำนวนสต็อก', `"${item.name}" มีสต็อกเพียง ${maxStock} ชิ้น`);
                                                    updateQuantity(item.id, maxStock);
                                                } else {
                                                    updateQuantity(item.id, num);
                                                }
                                                setEditingQty(prev => { const copy = { ...prev }; delete copy[item.id]; return copy; });
                                            }}
                                        />
                                        <TouchableOpacity
                                            onPress={() => {
                                                const maxStock = parseFloat(item.stock_qty || 0);
                                                if (item.quantity + 1 > maxStock) {
                                                    Alert.alert('เกินจำนวนสต็อก', `"${item.name}" มีสต็อกเพียง ${maxStock} ชิ้น`);
                                                } else {
                                                    addToCart(item, 1);
                                                }
                                            }}
                                            style={styles.qtyBtn}
                                        >
                                            <Ionicons name="add" size={16} color="#555" />
                                        </TouchableOpacity>
                                    </View>
                                    {/* ปุ่มลบแยก */}
                                    <TouchableOpacity
                                        onPress={() => {
                                            Alert.alert(
                                                'ลบสินค้า',
                                                `ต้องการลบ "${item.name}" ออกจากตะกร้าใช่หรือไม่?`,
                                                [
                                                    { text: 'ยกเลิก', style: 'cancel' },
                                                    { text: 'ลบ', style: 'destructive', onPress: () => removeFromCart(item.id) }
                                                ]
                                            );
                                        }}
                                        style={{ padding: 6, marginLeft: 10 }}
                                    >
                                        <Ionicons name="trash" size={18} color="#FF3B30" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}
                    />
                    <View style={{ marginTop: 20, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 15 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 }}>
                            <Text style={{ fontSize: 18, fontWeight: 'bold' }}>รวมทั้งสิ้น</Text>
                            <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#F37021' }}>฿{totalAmount.toLocaleString()}</Text>
                        </View>
                        <TouchableOpacity
                            style={[styles.payButton, { borderRadius: 12 }]}
                            onPress={() => {
                                setShowCartModal(false);
                                handleCheckoutClick();
                            }}
                        >
                            <Text style={[styles.payButtonText, { flex: 1, textAlign: 'center' }]}>ชำระเงิน</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );

    const renderFloatingCartButton = () => {
        if (activeTab === 'scan') return null;
        return (
            <Animated.View
                style={[
                    styles.fab,
                    {
                        transform: fabPan.getTranslateTransform(),
                        position: 'absolute',
                        zIndex: 999,
                    },
                ]}
                {...fabPanResponder.panHandlers}
            >
                {products.length > 0 && (
                    <View style={styles.fabBadge}>
                        <Text style={styles.fabBadgeText}>{products.length}</Text>
                    </View>
                )}
                <Ionicons name="cart" size={24} color="#fff" />
                {products.length > 0 && (
                    <Text style={styles.fabAmountText}>฿{totalAmount.toLocaleString()}</Text>
                )}
            </Animated.View>
        );
    };

    // 8. FOOTER (PAYMENT)
    const renderFooter = () => (
        <View style={styles.footer}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
                {/* ปุ่มพิมพ์โผล่มาเฉพาะตอนเชื่อมเครื่องปริ้น */}
                {connectedPrinter && (
                    <TouchableOpacity
                        style={[styles.payButton, { flex: 0.3, backgroundColor: lastTransaction ? '#000' : '#E5E5EA', justifyContent: 'center' }]}
                        onPress={() => {
                            if (lastTransaction) {
                                setShowReceiptModal(true);
                            } else {
                                Alert.alert('ไม่มีข้อมูล', 'ยังไม่มีรายการขายล่าสุดให้พิมพ์ครับ');
                            }
                        }}
                        activeOpacity={lastTransaction ? 0.8 : 1}
                    >
                        <Ionicons name="print" size={24} color={lastTransaction ? "#fff" : "#999"} />
                    </TouchableOpacity>
                )}
                <TouchableOpacity
                    style={[styles.payButton, connectedPrinter ? { flex: 0.7 } : { flex: 1 }]}
                    onPress={handleCheckoutClick}
                >
                    <View style={styles.itemCountBadge}>
                        <Text style={styles.itemCountText}>{totalItems}</Text>
                    </View>
                    <Text style={styles.payButtonText}>ชำระเงิน</Text>
                    <Text style={styles.payTotalText}>฿{totalAmount.toLocaleString()}</Text>
                </TouchableOpacity>
            </View>
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
                    {renderFooter()}
                </View>
            ) : (
                /* Full View for Search/Weight */
                activeTab === 'search' ? renderSearchView() : renderWeightView()
            )}

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
                isSubmitting={isSelling}
            />
            <QRPaymentModal
                visible={showQRModal}
                amount={totalAmount}
                onConfirm={() => handleNormalSale('qr')}
                onClose={() => setShowQRModal(false)}
                isSubmitting={isSelling}
            />
            <DebtPaymentModal visible={showDebtPaymentModal} amount={totalAmount} onConfirm={handleDebtConfirm} onCancel={() => setShowDebtPaymentModal(false)} />
            <ProductQuantityModal visible={quantityModalVisible} product={selectedProductToAdd} onClose={() => setQuantityModalVisible(false)} onConfirm={handleConfirmAddToCart} />
            <ReceiptModal
                visible={showReceiptModal}
                transaction={lastTransaction}
                onClose={() => setShowReceiptModal(false)}
                onNewTransaction={() => setShowReceiptModal(false)}
                onPrint={async () => {
                    try {
                        await printReceipt(lastTransaction);
                        Alert.alert('สำเร็จ', 'พิมพ์ใบเสร็จเรียบร้อยแล้ว');
                    } catch (error) {
                        Alert.alert('ผิดพลาด', error.message);
                    }
                }}
            />

            {/* Add Product Modal */}
            {renderAddProductModal()}

            {/* Weight Input Modal */}
            {renderWeightInputModal()}

            {/* Restock Existing Product Modal */}
            <AddStockModal
                visible={showRestockModal}
                scannedCode={restockBarcode}
                product={restockProduct}
                onClose={() => {
                    setShowRestockModal(false);
                    setRestockBarcode('');
                    setRestockProduct(null);
                }}
                onConfirm={(data) => {
                    Alert.alert("สำเร็จ", `เพิ่มสต็อก ${data.name} สำเร็จ`);
                    setShowRestockModal(false);
                    setRestockBarcode('');
                    setRestockProduct(null);
                    useProductStore.getState().refreshProducts();
                }}
            />

            {/* Cart Modal (New) */}
            {renderCartModal()}

            {/* Floating Cart Button (New) */}
            {renderFloatingCartButton()}
            {/* Loading Overlay ขณะกำลังขาย */}
            {isSelling && (
                <View style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.4)',
                    justifyContent: 'center', alignItems: 'center',
                    zIndex: 9999
                }}>
                    <View style={{
                        backgroundColor: '#fff', borderRadius: 16,
                        padding: 30, alignItems: 'center',
                        shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.2, shadowRadius: 10, elevation: 10
                    }}>
                        <ActivityIndicator size="large" color="#F37021" />
                        <Text style={{ marginTop: 12, fontSize: 16, fontWeight: '600', color: '#333' }}>กำลังบันทึกการขาย...</Text>
                    </View>
                </View>
            )}
        </View >
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },

    // Tabs
    tabContainer: { paddingHorizontal: 20, paddingBottom: 10, zIndex: 10 },
    tabWrapper: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 25, padding: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
    tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 22 },
    activeTab: { backgroundColor: '#F37021' },
    tabText: { fontSize: 18, color: '#888', fontWeight: '500' },
    activeTabText: { color: '#fff', fontWeight: 'bold' },

    // Camera (Middle 1)
    cameraSection: { height: height * 0.20, backgroundColor: '#000', position: 'relative' },
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
    modeText: { color: '#666', fontWeight: '500', fontSize: 18 },
    activeModeText: { color: '#F37021', fontWeight: 'bold' },

    // Cart List
    cartList: { flex: 1, backgroundColor: '#F9FAFB' },
    emptyCart: { padding: 40, alignItems: 'center' },
    cartItem: { flexDirection: 'row', backgroundColor: '#fff', padding: 15, marginBottom: 8, borderRadius: 12, alignItems: 'center', borderWidth: 1.2, borderColor: '#eee' },
    cartItemImage: { width: 50, height: 50, borderRadius: 8, backgroundColor: '#eee' },
    cartItemName: { fontSize: 18, fontWeight: '600', color: '#333' },
    cartItemPrice: { fontSize: 18, color: '#F37021', fontWeight: 'bold' },
    qtyContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F0F0', borderRadius: 20, padding: 5 },
    qtyBtn: { padding: 5 },
    qtyText: { paddingHorizontal: 8, fontSize: 18, fontWeight: '600' },

    // Footer
    footer: { padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#eee', paddingBottom: Platform.OS === 'ios' ? 34 : '10%' },
    payButton: {
        backgroundColor: '#F37021',
        borderRadius: 50,
        paddingVertical: 11,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        shadowColor: '#F37021', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5
    },
    itemCountBadge: { backgroundColor: '#fff', width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    itemCountText: { color: '#F37021', fontWeight: 'bold', fontSize: 18 },
    payButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    payTotalText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },

    // Search & Grid Styles (Simplified)
    searchHeader: { paddingHorizontal: 15 },
    searchBar: { flexDirection: 'row', backgroundColor: '#F3F4F6', borderRadius: 12, padding: 5, alignItems: 'center' },
    searchInput: { flex: 1, marginLeft: 10, fontSize: 18 },
    gridItem: { width: '48%', backgroundColor: '#fff', padding: 10, marginBottom: 15, borderRadius: 12, alignItems: 'center' },
    gridImage: { width: 80, height: 80, borderRadius: 8, marginBottom: 8 },
    gridName: { fontWeight: '600', marginBottom: 5, fontSize: 18 },
    gridPrice: { color: '#F37021', fontWeight: 'bold', fontSize: 18 },
    addButton: { marginTop: 5, backgroundColor: '#F37021', borderRadius: 20, padding: 5 },

    // Weight Styles — Clean UX
    // Category bar
    wCategoryBar: { backgroundColor: '#fff', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F0', borderRadius: 50 },
    wCategoryChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F5F5F5' },
    wCategoryChipActive: { backgroundColor: '#FFF3E0', borderWidth: 1.5, borderColor: '#F37021' },
    wCategoryEmoji: { fontSize: 18, marginRight: 5 },
    wCategoryLabel: { fontSize: 18, color: '#777', fontWeight: '500' },
    wCategoryLabelActive: { color: '#F37021', fontWeight: '700' },

    // Section header
    wSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingTop: 16, paddingBottom: 8 },
    wSectionTitle: { fontSize: 18, fontWeight: '700', color: '#333' },
    wAddBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, backgroundColor: '#FFF3E0' },
    wAddBtnText: { fontSize: 18, color: '#F37021', fontWeight: '600', marginLeft: 2 },

    // Product grid
    wGridContainer: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 14, gap: 10 },
    wProductCard: { width: (width - 38) / 2, backgroundColor: '#fff', borderRadius: 16, padding: 10, alignItems: 'center', borderWidth: 1.5, borderColor: '#F0F0F0' },
    wProductCardSelected: { borderColor: '#F37021', backgroundColor: '#FFFBF7', shadowColor: '#F37021', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 4 },
    wCardCheck: { position: 'absolute', top: 8, right: 8, width: 22, height: 22, borderRadius: 11, backgroundColor: '#F37021', justifyContent: 'center', alignItems: 'center', zIndex: 2 },
    wCardImageWrap: { width: '100%', aspectRatio: 1.3, borderRadius: 12, overflow: 'hidden', backgroundColor: '#F9FAFB', marginBottom: 8 },
    wCardImage: { width: '100%', height: '100%', resizeMode: 'cover' },
    wCardImagePlaceholder: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5F5' },
    wCardName: { fontSize: 18, fontWeight: '600', color: '#333', textAlign: 'center', marginBottom: 3 },
    wCardPrice: { fontSize: 18, fontWeight: '700', color: '#F37021' },
    wCardUnit: { fontSize: 18, fontWeight: '400', color: '#999' },

    // Empty state
    wEmptyState: { alignItems: 'center', paddingVertical: 40 },
    wEmptyText: { color: '#bbb', fontSize: 18, marginTop: 10, marginBottom: 16 },
    wEmptyAddBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F37021', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, gap: 4 },
    wEmptyAddText: { color: '#fff', fontWeight: '600', fontSize: 18 },

    // Weight input section
    wInputSection: { margin: 16, backgroundColor: '#fff', borderRadius: 20, padding: 18, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 3 },
    wInputHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    wInputImageWrap: { width: 48, height: 48, borderRadius: 12, overflow: 'hidden' },
    wInputImage: { width: 48, height: 48, borderRadius: 12 },
    wInputName: { fontSize: 18, fontWeight: '700', color: '#222', marginBottom: 2 },
    wInputPrice: { fontSize: 18, fontWeight: '700', color: '#F37021' },
    wInputFieldWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 4, borderWidth: 1.5, borderColor: '#F0F0F0' },
    wInputField: { flex: 1, fontSize: 32, fontWeight: '700', color: '#333', textAlign: 'center', paddingVertical: 8, left: '5%' },
    wInputUnitLabel: { fontSize: 18, color: '#999', fontWeight: '500', width: 70, textAlign: 'right' },
    wUnitRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 12, gap: 8 },
    wUnitBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, backgroundColor: '#F5F5F5' },
    wUnitBtnActive: { backgroundColor: '#F37021' },
    wUnitBtnText: { fontSize: 18, color: '#777', fontWeight: '600' },
    wUnitBtnTextActive: { color: '#fff' },
    wCartBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F37021', borderRadius: 14, paddingVertical: 14, marginTop: 16 },
    wCartBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
    wCartBtnPrice: { backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10, marginLeft: 10 },
    wCartBtnPriceText: { color: '#fff', fontSize: 18, fontWeight: '700' },

    // Weight Input Modal styles
    wModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    wModalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingBottom: '50%', paddingTop: 12 },
    wModalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#DDD', alignSelf: 'center', marginBottom: 16 },
    wModalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    wModalImageWrap: { width: 56, height: 56, borderRadius: 14, overflow: 'hidden', backgroundColor: '#F3F4F6' },
    wModalImage: { width: 56, height: 56, borderRadius: 14 },
    wModalName: { fontSize: 18, fontWeight: '700', color: '#222', marginBottom: 3 },
    wModalPrice: { fontSize: 18, fontWeight: '700', color: '#F37021' },
    wModalCloseBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F5F5F5', justifyContent: 'center', alignItems: 'center' },
    wModalTotal: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 4, borderTopWidth: 1, borderTopColor: '#F0F0F0', marginTop: 12 },
    wModalTotalLabel: { fontSize: 18, color: '#999', fontWeight: '500' },
    wModalTotalAmount: { fontSize: 24, fontWeight: '800', color: '#F37021' },

    // Legacy weight styles (keep for add product modal)
    categoryPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, backgroundColor: '#fff', marginRight: 6, marginBottom: 8, borderWidth: 1, borderColor: '#eee' },
    activeCategoryPill: { backgroundColor: '#F37021', borderColor: '#F37021' },
    categoryText: { color: '#666', fontSize: 18 },
    activeCategoryText: { color: '#fff', fontWeight: 'bold' },
    imagePickerButton: { width: '100%', height: 150, backgroundColor: '#f0f0f0', borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 15, borderStyle: 'dashed', borderWidth: 1, borderColor: '#ccc' },

    wCardRestockBtn: {
        position: 'absolute',
        top: 6,
        right: 6,
        backgroundColor: '#fff',
        borderRadius: 15,
        width: 30,
        height: 30,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
        elevation: 3,
    },

    // Modal Styles
    modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end', zIndex: 100 },
    modalContainer: { backgroundColor: '#fff', borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 25, paddingBottom: 40 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    modalTitle: { fontSize: 20, fontWeight: 'bold' },
    modalCloseButton: { padding: 5, backgroundColor: '#F3F4F6', borderRadius: 20 },
    handleIndicator: { width: 40, height: 4, backgroundColor: '#E0E0E0', borderRadius: 2, alignSelf: 'center', marginBottom: 20, position: 'absolute', top: 10 },
    inputLabel: { marginTop: 18, marginBottom: 8, color: '#666', fontSize: 18, fontWeight: '600' },
    inputField: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 12, padding: 10, borderWidth: 1, borderColor: '#eee' },
    textInput: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 10, borderWidth: 1, borderColor: '#eee', fontSize: 18 },
    unitSelectorContainer: { flexDirection: 'row', gap: 10 },
    unitOption: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 12, backgroundColor: '#F3F4F6' },
    activeUnitOption: { backgroundColor: '#F37021' },
    unitOptionText: { fontSize: 18, color: '#666', fontWeight: 'bold' },
    activeUnitOptionText: { color: '#fff' },
    modalMainButton: { backgroundColor: '#F37021', padding: 16, borderRadius: 16, alignItems: 'center', marginTop: 30 },
    modalMainButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },

    // FAB — Draggable
    fab: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#F37021', justifyContent: 'center', alignItems: 'center', shadowColor: '#F37021', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 8 },
    fabBadge: { position: 'absolute', top: -4, right: -4, backgroundColor: '#FF3B30', borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4, borderWidth: 1.5, borderColor: '#fff', zIndex: 3 },
    fabBadgeText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
    fabAmountText: { color: '#fff', fontSize: 12, fontWeight: '600', marginTop: 1 },

    wUnitBtnDisabled: {
        opacity: 0.4,
    },
});
