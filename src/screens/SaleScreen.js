import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, Alert, TextInput, FlatList, ActivityIndicator, Modal } from 'react-native';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { PaymentMethodModal, QRPaymentModal, ReceiptModal, DebtPaymentModal } from '../components/payment';
import { createCreditSale } from '../services/api';
import { useProductStore } from '../stores/useProductStore';
import { useCartStore } from '../stores/useCartStore';
import ProductQuantityModal from '../components/ProductQuantityModal';


// Mock data สำหรับรายการสินค้า
// Mock data สำหรับรายการสินค้า - REMOVED
const initialProducts = [];

// Mock data สำหรับหมวดหมู่ของสด
const WEIGHT_CATEGORIES = [
    {
        id: 'pork',
        name: 'หมู',
        items: [
            { id: 'p1', name: 'สามชั้นสไลด์', price: 150 },
            { id: 'p2', name: 'สามชั้น', price: 140 },
            { id: 'p3', name: 'สันคอ', price: 160 },
            { id: 'p4', name: 'สันนอก', price: 150 },
            { id: 'p5', name: 'สันใน', price: 170 },
        ]
    },
    {
        id: 'chicken',
        name: 'ไก่',
        items: [
            { id: 'c1', name: 'อกไก่', price: 80 },
            { id: 'c2', name: 'น่องไก่', price: 75 },
            { id: 'c3', name: 'ปีกไก่', price: 85 },
        ]
    },
    {
        id: 'seafood',
        name: 'ทะเล',
        items: [
            { id: 's1', name: 'กุ้งขาว', price: 280 },
            { id: 's2', name: 'หมึกกล้วย', price: 250 },
        ]
    },
    {
        id: 'veg',
        name: 'ผัก',
        items: [
            { id: 'v1', name: 'คะน้า', price: 40 },
            { id: 'v2', name: 'กวางตุ้ง', price: 35 },
        ]
    },
    {
        id: 'fruit',
        name: 'ผลไม้',
        items: [
            { id: 'f1', name: 'ส้ม', price: 60 },
            { id: 'f2', name: 'แอปเปิ้ล', price: 90 },
        ]
    },
];

const WEIGHT_UNITS = [
    { label: 'กิโลกรัม', value: 'kg', multiplier: 1 },
    { label: 'กรัม', value: 'g', multiplier: 0.001 },
    { label: 'ขีด', value: 'h', multiplier: 0.1 },
];

export default function SaleScreen({ route, navigation }) {
    const [activeTab, setActiveTab] = useState('scan'); // 'scan', 'search', 'weight'

    // Global Cart Store
    const { cart: products, addToCart, removeFromCart, clearCart } = useCartStore();

    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showQRModal, setShowQRModal] = useState(false);
    const [showDebtPaymentModal, setShowDebtPaymentModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Add Cart Modal State
    const [quantityModalVisible, setQuantityModalVisible] = useState(false);
    const [selectedProductToAdd, setSelectedProductToAdd] = useState(null);

    // Zustand store for database products
    const {
        products: storeProducts,
        categories,
        isLoading,
        hasMore,
        fetchProducts,
        fetchCategories,
        searchLocal,
        refreshProducts,
        setSearchQuery: setStoreSearchQuery,
        selectedCategoryId,
        setSelectedCategory
    } = useProductStore();

    // const [selectedCategoryId, setSelectedCategoryId] = useState(null); // REMOVED: Now using store state
    const [showCategoryFilter, setShowCategoryFilter] = useState(false);

    // Filtered products based on category (Search is now handled by store)
    // REMOVED: displayProducts logic is now redundant as storeProducts is already filtered by backend
    const displayProducts = storeProducts;

    // Debounce Search Logic
    useEffect(() => {
        const timer = setTimeout(() => {
            // Note: setStoreSearchQuery inside the store now handles clearing selectedCategoryId
            setStoreSearchQuery(searchQuery);
        }, 500); // 500ms delay

        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Handle Navigation Params (Switch Tab)
    useEffect(() => {
        if (route.params?.screen) {
            if (route.params.screen === 'Search') {
                setActiveTab('search');
            } else if (route.params.screen === 'Cart') {
                setActiveTab('scan');
            }
        }
    }, [route.params]);

    // Reset to Scan (Cart) tab when screen is focused (if no specific params)
    useFocusEffect(
        useCallback(() => {
            if (!route.params?.screen) {
                setActiveTab('scan');
            }
            return () => {
                if (route.params?.screen) navigation.setParams({ screen: undefined });
            };
        }, [route.params])
    );

    // Load products and categories on mount
    useEffect(() => {
        if (storeProducts.length === 0) {
            fetchProducts(true);
        }
        if (categories.length === 0) {
            fetchCategories();
        }
    }, []);

    // Auto-refresh when switching to Search tab
    useEffect(() => {
        if (activeTab === 'search') {
            refreshProducts();
        }
    }, [activeTab]);

    // Handle load more for pagination
    const handleLoadMore = useCallback(() => {
        if (!isLoading && hasMore) {
            fetchProducts();
        }
    }, [isLoading, hasMore, fetchProducts]);

    // State for Weighing Tab
    const [selectedWeightCategory, setSelectedWeightCategory] = useState(WEIGHT_CATEGORIES[0]);
    const [selectedItem, setSelectedItem] = useState(WEIGHT_CATEGORIES[0].items[0]);
    const [dropdownVisible, setDropdownVisible] = useState(false);
    const [weightInput, setWeightInput] = useState('1.0');
    const [selectedUnit, setSelectedUnit] = useState(WEIGHT_UNITS[0]);
    const [unitDropdownVisible, setUnitDropdownVisible] = useState(false);

    // Calculate Total for Weighing
    const calculateWeightTotal = () => {
        const weight = parseFloat(weightInput) || 0;
        const total = weight * selectedUnit.multiplier * selectedItem.price;
        return total.toFixed(0); // Show integer for THB commonly
    };

    const handleCategoryPress = (category) => {
        if (selectedWeightCategory.id === category.id) {
            setDropdownVisible(!dropdownVisible);
        } else {
            setSelectedWeightCategory(category);
            setSelectedItem(category.items[0]);
            setDropdownVisible(true);
        }
    };

    const handleItemSelect = (item) => {
        setSelectedItem(item);
        setDropdownVisible(false);
    };

    const handleUnitSelect = (unit) => {
        setSelectedUnit(unit);
        setUnitDropdownVisible(false);
    };

    const totalAmount = products.reduce((sum, product) => sum + (product.price * product.quantity), 0);
    const totalItems = products.length;

    const handleSelectQR = () => {
        setShowPaymentModal(false);
        setShowQRModal(true);

    }

    const handleQRConfirm = async () => {
        setShowQRModal(false);
    }

    const handleSelectDebt = () => {
        setShowPaymentModal(false);
        setShowDebtPaymentModal(true);
    }

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
            if (response.success) {
                Alert.alert('สำเร็จ', 'บันทึกการขายเชื่อเรียบร้อย');
                clearCart();
            } else {
                Alert.alert('ผิดพลาด', response.error || 'ไม่สามารถบันทึกได้');
            }
        } catch (error) {
            console.error('Credit sale error:', error);
            Alert.alert('ผิดพลาด', 'ไม่สามารถเชื่อมต่อ Server ได้');
        }
        setShowDebtPaymentModal(false);
    };

    // ฟังก์ชันลบสินค้า
    const handleDeleteProduct = (productId) => {
        Alert.alert(
            'ยืนยันการลบ',
            'คุณต้องการลบสินค้านี้ออกจากรายการหรือไม่?',
            [
                { text: 'ยกเลิก', style: 'cancel' },
                {
                    text: 'ลบ',
                    style: 'destructive',
                    onPress: () => {
                        removeFromCart(productId);
                    }
                }
            ]
        );
    };

    // Handle Open Quantity Modal
    const handleAddToCartRequest = (product) => {
        setSelectedProductToAdd(product);
        setQuantityModalVisible(true);
    };

    // Handle Confirm Add To Cart
    const handleConfirmAddToCart = (quantity) => {
        if (!selectedProductToAdd) return;

        addToCart(selectedProductToAdd, quantity);

        setQuantityModalVisible(false);
        setActiveTab('scan'); // Switch to Cart Tab
    };

    const renderScanTab = () => (
        <>
            {/* กล่องสรุปรายการ */}
            <View style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>รายการทั้งหมด</Text>
                    <Text style={styles.summaryValue}>{totalItems} รายการ</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>ยอดรวม</Text>
                    <Text style={styles.summaryValueBold}>฿{totalAmount}</Text>
                </View>
            </View>

            {/* รายการสินค้า */}
            <View style={styles.productListContainer}>
                <ScrollView
                    style={styles.productList}
                    showsVerticalScrollIndicator={false}
                >
                    {products.map((product) => (
                        <View key={product.id} style={styles.productCard}>
                            <View style={styles.productInfo}>
                                {/* รูปสินค้า */}
                                <Image
                                    source={{ uri: product.image }}
                                    style={styles.productImage}
                                />
                                {/* ชื่อและจำนวน */}
                                <View style={styles.productDetails}>
                                    <Text style={styles.productName}>{product.name}</Text>
                                    <Text style={styles.productQuantity}>
                                        {product.quantity} {product.unit}
                                    </Text>
                                </View>
                                {/* ราคา */}
                                <View style={styles.priceContainer}>
                                    <Text style={styles.priceLabel}>ราคา</Text>
                                    <Text style={styles.priceValue}>฿{product.price}</Text>
                                </View>
                            </View>
                            {/* ปุ่มลบ */}
                            <TouchableOpacity
                                style={styles.deleteButton}
                                onPress={() => handleDeleteProduct(product.id)}
                            >
                                <Text style={styles.deleteButtonText}>ลบ</Text>
                            </TouchableOpacity>
                        </View>
                    ))}
                </ScrollView>
            </View>

            {/* ปุ่มชำระเงิน */}
            <View style={styles.paymentButtonContainer}>
                <TouchableOpacity
                    style={styles.paymentButton}
                    onPress={() => setShowPaymentModal(true)}
                >
                    <FontAwesome5 name="wallet" size={20} color="#fff" />
                    <Text style={styles.paymentButtonText}>ชำระเงิน ฿{totalAmount}</Text>
                </TouchableOpacity>
            </View>
        </>
    );

    const renderWeighingView = () => (
        <View style={styles.weighingContainer}>
            {/* Categories - Wrapped Grid */}
            <View style={styles.categoryGrid}>
                {WEIGHT_CATEGORIES.map((category) => (
                    <TouchableOpacity
                        key={category.id}
                        style={[styles.categoryPill, selectedWeightCategory.id === category.id && styles.activeCategoryPill]}
                        onPress={() => handleCategoryPress(category)}
                    >
                        <Text style={[styles.categoryText, selectedWeightCategory.id === category.id && styles.activeCategoryText]}>
                            {category.name}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Inline Items Grid (Replacing Dropdown) */}
            <View style={styles.itemGrid}>
                {selectedWeightCategory.items.map((item) => (
                    <TouchableOpacity
                        key={item.id}
                        style={[styles.itemPill, selectedItem.id === item.id && styles.activeItemPill]}
                        onPress={() => handleItemSelect(item)}
                    >
                        <Text style={[styles.itemText, selectedItem.id === item.id && styles.activeItemText]}>
                            {item.name}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Unified Smart Card */}
            <View style={styles.unifiedCard}>

                {/* Header: Product & Price Rate */}
                <View style={styles.unifiedHeader}>
                    <Text style={styles.unifiedProductName}>{selectedItem.name}</Text>
                    <Text style={styles.unifiedPriceRate}>฿{selectedItem.price} / {selectedUnit.label}</Text>
                </View>

                {/* Input Section - Centered */}
                <View style={styles.unifiedInputContainer}>
                    <TextInput
                        style={styles.unifiedInput}
                        value={weightInput}
                        onChangeText={setWeightInput}
                        keyboardType="decimal-pad"
                        textAlign="center"
                        autoFocus={false}
                        placeholder="0.0"
                        placeholderTextColor="#ccc"
                    />
                </View>

                {/* Unit Quick Select Buttons */}
                <View style={styles.unitSelectionRow}>
                    {WEIGHT_UNITS.map((unit) => (
                        <TouchableOpacity
                            key={unit.value}
                            style={[
                                styles.unitQuickButton,
                                selectedUnit.value === unit.value && styles.activeUnitQuickButton
                            ]}
                            onPress={() => setSelectedUnit(unit)}
                        >
                            <Text style={[
                                styles.unitQuickText,
                                selectedUnit.value === unit.value && styles.activeUnitQuickText
                            ]}>
                                {unit.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* Add Button */}
            <TouchableOpacity style={styles.addButtonData}>
                <Ionicons name="add-circle" size={24} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.addButtonDataText}>
                    เพิ่มใส่ตะกร้า • ฿{calculateWeightTotal()}
                </Text>
            </TouchableOpacity>

        </View>
    );

    const renderListView = () => (
        <View style={{ flex: 1 }}>
            <View style={styles.searchHeader}>
                <View style={styles.searchBarRow}>
                    <View style={styles.searchBar}>
                        <Ionicons name="search" size={20} color="#999" />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="ค้นหาสินค้า..."
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                    </View>
                    <TouchableOpacity
                        style={styles.filterButton}
                        onPress={() => setShowCategoryFilter(true)}
                    >
                        <Text style={styles.filterText}>
                            {selectedCategoryId
                                ? categories.find((c) => c.id === selectedCategoryId)?.name || 'ทั้งหมด'
                                : 'ทั้งหมด'}
                        </Text>
                        <Ionicons name="chevron-down" size={16} color="#666" />
                    </TouchableOpacity>
                </View>
                <Text style={styles.resultCount}>พบ {displayProducts.length} รายการ</Text>
            </View>

            {/* Category Filter Dropdown (Absolute) */}
            {showCategoryFilter && (
                <>
                    <TouchableOpacity
                        style={styles.dropdownBackdrop}
                        activeOpacity={1}
                        onPress={() => setShowCategoryFilter(false)}
                    />
                    <View style={[styles.categoryDropdown, { zIndex: 9999 }]}>
                        <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled={true}>
                            <TouchableOpacity
                                style={[
                                    styles.dropdownOption,
                                    !selectedCategoryId && styles.dropdownOptionActive,
                                ]}
                                onPress={() => {
                                    setSelectedCategory(null);
                                    setShowCategoryFilter(false);
                                }}
                            >
                                <Text
                                    style={[
                                        styles.dropdownOptionText,
                                        !selectedCategoryId && styles.dropdownOptionTextActive,
                                    ]}
                                >
                                    ทั้งหมด
                                </Text>
                                {!selectedCategoryId && (
                                    <Ionicons name="checkmark" size={20} color="#1E2022" />
                                )}
                            </TouchableOpacity>
                            {categories.map((category) => (
                                <TouchableOpacity
                                    key={category.id}
                                    style={[
                                        styles.dropdownOption,
                                        selectedCategoryId === category.id &&
                                        styles.dropdownOptionActive,
                                    ]}
                                    onPress={() => {
                                        setSelectedCategory(category.id);
                                        setShowCategoryFilter(false);
                                    }}
                                >
                                    <Text
                                        style={[
                                            styles.dropdownOptionText,
                                            selectedCategoryId === category.id &&
                                            styles.dropdownOptionTextActive,
                                        ]}
                                    >
                                        {category.name}
                                    </Text>
                                    {selectedCategoryId === category.id && (
                                        <Ionicons name="checkmark" size={20} color="#1E2022" />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </>
            )}

            <FlatList
                data={displayProducts}
                numColumns={2}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.gridContainer}
                columnWrapperStyle={styles.gridRow}
                showsVerticalScrollIndicator={false}
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.5}
                ListFooterComponent={() =>
                    isLoading ? (
                        <View style={styles.loadingFooter}>
                            <ActivityIndicator size="small" color="#52616B" />
                        </View>
                    ) : null
                }
                ListEmptyComponent={() =>
                    !isLoading ? (
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>ไม่พบสินค้า</Text>
                        </View>
                    ) : null
                }
                renderItem={({ item }) => (
                    <View style={styles.gridItem}>
                        <Image
                            source={{ uri: item.image_url || 'https://via.placeholder.com/100' }}
                            style={styles.gridImage}
                        />
                        <Text style={styles.gridName} numberOfLines={1}>{item.name}</Text>
                        <View style={styles.gridPriceRow}>
                            <Text style={styles.gridPrice}>
                                ฿{item.price}
                                <Text style={styles.gridUnit}> / {item.unit_type || 'ชิ้น'}</Text>
                            </Text>
                        </View>
                        <TouchableOpacity
                            style={styles.addButton}
                            onPress={() => handleAddToCartRequest(item)}
                        >
                            <Ionicons name="add" size={24} color="#fff" />
                        </TouchableOpacity>
                    </View>
                )}
            />
        </View >
    )


    return (
        <View style={styles.container}>
            {/* Tab สแกนขาย / ค้นหา / ชั่ง */}
            <View style={styles.tabContainer}>
                <View style={styles.tabWrapper}>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'scan' && styles.activeTab]}
                        onPress={() => setActiveTab('scan')}
                    >
                        <Text style={[styles.tabText, activeTab === 'scan' && styles.activeTabText]}>
                            สแกน
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'search' && styles.activeTab]}
                        onPress={() => setActiveTab('search')}
                    >
                        <Text style={[styles.tabText, activeTab === 'search' && styles.activeTabText]}>
                            ค้นหา
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[
                            styles.tab,
                            activeTab === 'weight' && styles.activeTab,
                            { flexDirection: 'row', alignItems: 'center' } // Align icon and text
                        ]}
                        onPress={() => setActiveTab('weight')}
                    >
                        <FontAwesome5
                            name="balance-scale"
                            size={16}
                            color={activeTab === 'weight' ? '#fff' : '#666'}
                            style={{ marginRight: 6 }}
                        />
                        <Text style={[styles.tabText, activeTab === 'weight' && styles.activeTabText]}>
                            ชั่ง
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            {activeTab === 'scan' && renderScanTab()}
            {activeTab === 'search' && renderListView()}
            {activeTab === 'weight' && renderWeighingView()}

            <PaymentMethodModal
                visible={showPaymentModal}
                amount={totalAmount}
                onSelectCash={() => {
                    setShowPaymentModal(false);
                }}
                onSelectQR={handleSelectQR}
                onSelectDebt={handleSelectDebt}
                onClose={() => setShowPaymentModal(false)}
            />

            <QRPaymentModal
                visible={showQRModal}
                amount={totalAmount}
                onConfirm={handleQRConfirm}
                onClose={() => setShowQRModal(false)}
            />

            <DebtPaymentModal
                visible={showDebtPaymentModal}
                amount={totalAmount}
                onConfirm={handleDebtConfirm}
                onCancel={() => setShowDebtPaymentModal(false)}
            />

            <ProductQuantityModal
                visible={quantityModalVisible}
                product={selectedProductToAdd}
                onClose={() => setQuantityModalVisible(false)}
                onConfirm={handleConfirmAddToCart}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 20,
        backgroundColor: '#F9FAFB',
    },
    // Updated Tab styles
    tabContainer: {
        paddingVertical: 15,
        zIndex: 10,
    },
    tabWrapper: {
        flexDirection: 'row',
        backgroundColor: '#fff', // Dark background
        borderRadius: 25,
        padding: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.25,
        shadowRadius: 2,
        elevation: 5,
    },
    tab: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        justifyContent: 'center', // Ensure content is centered
        borderRadius: 22,
    },
    activeTab: {
        backgroundColor: '#F37021', // Orange active pill (matching approximate color)
    },
    tabText: {
        fontSize: 16,
        fontWeight: '500', // Slightly lighter font weight for cleaner look
        color: '#888', // Grey for inactive
    },
    activeTabText: {
        color: '#fff',
        fontWeight: '700',
    },
    // Summary card styles
    summaryCard: {
        backgroundColor: '#fff',
        borderRadius: 15,
        padding: 15,
        marginBottom: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
    },
    summaryLabel: {
        fontSize: 14,
        color: '#666',
    },
    summaryValue: {
        fontSize: 14,
        color: '#333',
        fontWeight: '500',
    },
    summaryValueBold: {
        fontSize: 16,
        color: '#333',
        fontWeight: '700',
    },
    divider: {
        height: 1,
        backgroundColor: '#E8E8E8',
        marginVertical: 5,
    },
    // Product list styles
    productListContainer: {
        flex: 1,
        marginBottom: 10,
        backgroundColor: '#fff',
        borderRadius: 20,
        paddingHorizontal: 10,
        paddingVertical: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    },
    productList: {
        flex: 1,
    },
    productCard: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        borderRadius: 15,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    productInfo: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
    },
    productImage: {
        width: 50,
        height: 50,
        borderRadius: 10,
        backgroundColor: '#E8E8E8',
    },
    productDetails: {
        flex: 1,
        marginLeft: 12,
    },
    productName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 4,
    },
    productQuantity: {
        fontSize: 12,
        fontWeight: '600',
        color: '#999',
    },
    priceContainer: {
        alignItems: 'flex-end',
        marginRight: 10,
    },
    priceLabel: {
        fontSize: 12,
        color: '#666',
        marginBottom: 2,
    },
    priceValue: {
        fontSize: 16,
        fontWeight: '700',
        color: '#E53935',
    },
    deleteButton: {
        backgroundColor: '#E53935',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
        borderTopRightRadius: 15,
        borderBottomRightRadius: 15,
    },
    deleteButtonText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 14,
    },
    // Payment button styles
    paymentButtonContainer: {
        paddingTop: 10,
        paddingBottom: 10,
        marginBottom: 40,
    },
    paymentButton: {
        backgroundColor: '#ed7117',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 20,
        borderRadius: 50,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 3,
    },
    paymentButtonText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 18,
        marginLeft: 10,
    },
    // Search Tab Styles
    searchContainer: {
        flex: 1,
    },
    searchHeader: {
        marginBottom: 10,
    },
    subTabContainer: {
        alignItems: 'center', // Center the toggle
        marginBottom: 15,
    },
    subTabWrapper: {
        flexDirection: 'row',
        backgroundColor: '#f5f5f5',
        borderRadius: 25,
        padding: 4,
        borderWidth: 1,
        borderColor: '#eee',
    },
    subTab: {
        paddingHorizontal: 25, // Widen touch area
        paddingVertical: 8,
        borderRadius: 22,
        minWidth: 100,
        alignItems: 'center',
        justifyContent: 'center',
    },
    activeSubTab: {
        backgroundColor: '#1E2022', // Changed to Dark for hierarchy
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
        elevation: 3,
    },
    subTabText: {
        fontSize: 14,
        color: '#888',
        fontWeight: '500',
    },
    activeSubTabText: {
        color: '#fff',
        fontWeight: '700',
    },
    searchBarRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    searchBar: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 25,
        paddingHorizontal: 15,
        height: 45,
        marginRight: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    searchInput: {
        flex: 1,
        marginLeft: 10,
        fontSize: 14,
        color: '#333',
    },
    filterButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        paddingHorizontal: 15,
        paddingVertical: 10,
        borderRadius: 25,
        height: 45,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    filterText: {
        fontSize: 14,
        color: '#666',
        marginRight: 5,
    },
    resultCount: {
        fontSize: 14,
        color: '#666',
        marginBottom: 10,
    },
    gridContainer: {
        paddingBottom: 20,
    },
    gridRow: {
        justifyContent: 'space-between',
    },
    gridItem: {
        backgroundColor: '#fff',
        width: '48%',
        borderRadius: 15,
        padding: 10,
        paddingBottom: 50,
        marginBottom: 15,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 3,
        position: 'relative',
    },
    gridImage: {
        width: 100,
        height: 100,
        borderRadius: 10,
        marginBottom: 10,
        resizeMode: 'cover',
    },
    gridName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
        marginBottom: 5,
        textAlign: 'center',
    },
    gridPriceRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        marginBottom: 10,
    },
    gridPrice: {
        fontSize: 16,
        fontWeight: '700',
        color: '#4CAF50', // Green color
    },
    gridUnit: {
        fontSize: 12,
        color: '#999',
        fontWeight: '400',
    },
    addButton: {
        backgroundColor: '#1E2022',
        width: 30,
        height: 30,
        borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'absolute',
        bottom: 10,
        alignSelf: 'center',
    },
    // Weighing View Styles
    weighingContainer: {
        flex: 1,
        paddingTop: 10,
    },
    categoryGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center', // Center items
        marginBottom: 10,
    },
    categoryPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 25,
        paddingHorizontal: 16,
        paddingVertical: 10,
        marginRight: 8,
        marginBottom: 8, // Space for wrapping
        height: 44,
        borderWidth: 1,
        borderColor: '#E0E0E0',
    },
    activeCategoryPill: {
        backgroundColor: '#1E2022', // Changed from Orange to Dark Charcoal for less intensity?
        // Wait, user complained about too much orange.
        // Let's keep categories Orange for now as they are primary selection in this view?
        // Or change to Dark?
        // In the screenshot, the "Pork" pill being orange was okay, it was just "too much" overall.
        // Let's keep it Orange (#ed7117) but maybe lighter?
        // Stick to Orange for Category to match brand, but reduce other orange.
        backgroundColor: '#ed7117',
        borderColor: '#ed7117',
        shadowColor: '#ed7117',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
    },
    categoryText: {
        color: '#666',
        fontSize: 14,
        fontWeight: '500',
    },
    activeCategoryText: {
        color: '#fff',
        fontWeight: '700',
    },
    itemGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        marginBottom: 10, // Compact
    },
    itemPill: {
        paddingVertical: 6, // Compact
        paddingHorizontal: 12, // Compact
        borderRadius: 20,
        backgroundColor: '#f5f5f5',
        marginRight: 6,
        marginBottom: 6,
        borderWidth: 1,
        borderColor: '#eee',
    },
    activeItemPill: {
        backgroundColor: '#fff',
        borderColor: '#ed7117',
        borderWidth: 1,
        shadowColor: '#ed7117',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 2,
    },
    itemText: {
        fontSize: 14,
        color: '#666',
        fontWeight: '500',
    },
    activeItemText: {
        color: '#ed7117',
        fontWeight: '700',
    },
    // Unified Smart Card Styles
    unifiedCard: {
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 16, // Compact
        marginBottom: 10, // Compact
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 5,
        borderWidth: 1,
        borderColor: '#f0f0f0',
    },
    unifiedHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        marginBottom: 10, // Compact
        paddingBottom: 10, // Compact
        borderBottomWidth: 1,
        borderBottomColor: '#f5f5f5',
    },
    unifiedProductName: {
        fontSize: 18, // Compact
        fontWeight: '700',
        color: '#1E2022',
        flex: 1,
    },
    unifiedPriceRate: {
        fontSize: 14, // Compact
        color: '#999',
        fontWeight: '500',
    },
    unifiedInputContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10, // Compact
    },
    unifiedInput: {
        fontSize: 48, // Compact (was 64)
        fontWeight: '800',
        color: '#1E2022',
        width: '100%',
        textAlign: 'center',
        paddingVertical: 0,
    },
    unitSelectionRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginBottom: 15, // Compact
        gap: 10, // Compact
    },
    unitQuickButton: {
        paddingVertical: 8, // Compact
        paddingHorizontal: 20, // Compact
        borderRadius: 25,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#E0E0E0',
        minWidth: 70, // Compact
        alignItems: 'center',
    },
    activeUnitQuickButton: {
        backgroundColor: '#ed7117',
        borderColor: '#ed7117',
        shadowColor: '#ed7117',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
    },
    unitQuickText: {
        fontSize: 16,
        color: '#666',
        fontWeight: '600',
    },
    activeUnitQuickText: {
        color: '#fff',
        fontWeight: '700',
    },
    unifiedDivider: {
        height: 1,
        backgroundColor: '#f5f5f5',
        marginBottom: 20,
    },
    unifiedResultRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    unifiedTotalLabel: {
        fontSize: 16,
        color: '#888',
        fontWeight: '500',
    },
    unifiedTotalValue: {
        fontSize: 32,
        fontWeight: '800',
        color: '#ed7117',
    },
    addButtonData: {
        backgroundColor: '#ed7117',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 18,
        borderRadius: 20,
        shadowColor: '#ed7117',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
        marginBottom: 20, // Add bottom margin
        marginTop: 20,
    },
    addButtonDataText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    loadingFooter: {
        paddingVertical: 20,
        alignItems: 'center',
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 50,
    },
    emptyText: {
        fontSize: 16,
        color: '#999',
    },
    // Dropdown Modal Styles
    dropdownBackdrop: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'transparent',
        zIndex: 9998,
    },
    categoryDropdown: {
        position: 'absolute',
        top: 60,
        right: 0,
        backgroundColor: '#fff',
        borderRadius: 10,
        width: 180,
        maxHeight: 250,
        zIndex: 1000,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        borderWidth: 1,
        borderColor: '#EEEEEE',
    },
    dropdownOption: {
        paddingVertical: 12,
        paddingHorizontal: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    dropdownOptionActive: {
        backgroundColor: '#f5f5f5',
    },
    dropdownOptionText: {
        fontSize: 16,
        color: '#333',
    },
    dropdownOptionTextActive: {
        fontWeight: 'bold',
        color: '#1E2022',
    },
});
