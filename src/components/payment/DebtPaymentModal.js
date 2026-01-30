import React, { useRef, useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    Animated,
    Dimensions,
    TextInput,
    Platform,
    KeyboardAvoidingView,
    TouchableWithoutFeedback,
    Keyboard,
    ScrollView,
    Image,
    Alert,
    FlatList,
} from 'react-native';
import AntDesign from '@expo/vector-icons/AntDesign';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { searchCustomers, getCurrentStoreId } from '../../services/api';
import { uploadCustomerImage, isLocalUri } from '../../services/supabaseStorage';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function DebtPaymentModal({
    visible,
    amount = 0,
    onConfirm,
    onCancel,
}) {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
    const scaleAnim = useRef(new Animated.Value(0.9)).current;

    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [customerImage, setCustomerImage] = useState(null);
    const [dueDate, setDueDate] = useState(formatDate(new Date()));
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);

    // Customer autocomplete
    const [customers, setCustomers] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [isSearching, setIsSearching] = useState(false);

    const [errors, setErrors] = useState({
        customerName: false,
        customerPhone: false,
    });

    function formatDate(date) {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    }

    useEffect(() => {
        if (visible) {
            // Reset form when modal opens
            setCustomerName('');
            setCustomerPhone('');
            setCustomerImage(null);
            setDueDate(formatDate(new Date()));
            setSelectedDate(new Date());
            setSelectedCustomer(null);
            setCustomers([]);
            setShowDropdown(false);
            setErrors({ customerName: false, customerPhone: false });

            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.spring(slideAnim, {
                    toValue: 0,
                    tension: 65,
                    friction: 11,
                    useNativeDriver: true,
                }),
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    tension: 65,
                    friction: 11,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                }),
                Animated.timing(slideAnim, {
                    toValue: SCREEN_HEIGHT,
                    duration: 250,
                    useNativeDriver: true,
                }),
                Animated.timing(scaleAnim, {
                    toValue: 0.9,
                    duration: 200,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [visible]);

    // Search customers when name or phone changes
    const handleSearch = async (query) => {
        if (query.length < 2) {
            setCustomers([]);
            setShowDropdown(false);
            return;
        }

        setIsSearching(true);
        try {
            const response = await searchCustomers(query);
            if (response.success && response.data?.length > 0) {
                setCustomers(response.data);
                setShowDropdown(true);
            } else {
                setCustomers([]);
                setShowDropdown(false);
            }
        } catch (error) {
            console.log('Search error:', error);
        } finally {
            setIsSearching(false);
        }
    };

    const handleNameChange = (text) => {
        setCustomerName(text);
        setSelectedCustomer(null); // Reset selected customer
        setErrors(prev => ({ ...prev, customerName: false }));
        handleSearch(text);
    };

    const handlePhoneChange = (text) => {
        setCustomerPhone(text);
        setSelectedCustomer(null); // Reset selected customer
        setErrors(prev => ({ ...prev, customerPhone: false }));
        handleSearch(text);
    };

    const selectCustomer = (customer) => {
        setSelectedCustomer(customer);
        setCustomerName(customer.name || '');
        setCustomerPhone(customer.phone || '');
        setCustomerImage(customer.image_url);
        setShowDropdown(false);
        Keyboard.dismiss();
    };

    // Image picker
    const pickImage = async () => {
        Alert.alert(
            'เลือกรูปภาพ',
            'เลือกวิธีการอัพโหลดรูป',
            [
                {
                    text: 'ถ่ายรูป',
                    onPress: takePhoto,
                },
                {
                    text: 'เลือกจากแกลเลอรี่',
                    onPress: pickFromGallery,
                },
                {
                    text: 'ยกเลิก',
                    style: 'cancel',
                },
            ]
        );
    };

    const takePhoto = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('ต้องการสิทธิ์', 'กรุณาอนุญาตการใช้กล้อง');
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
        });

        if (!result.canceled) {
            setCustomerImage(result.assets[0].uri);
        }
    };

    const pickFromGallery = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('ต้องการสิทธิ์', 'กรุณาอนุญาตการเข้าถึงแกลเลอรี่');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
        });

        if (!result.canceled) {
            setCustomerImage(result.assets[0].uri);
        }
    };

    const validateForm = () => {
        const newErrors = {
            customerName: customerName.trim() === '',
            customerPhone: customerPhone.length !== 10,
        };
        setErrors(newErrors);
        return !Object.values(newErrors).some(error => error);
    };

    const handleClose = (callback) => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: SCREEN_HEIGHT,
                duration: 250,
                useNativeDriver: true,
            }),
        ]).start(() => {
            callback?.();
        });
    };

    const handleCancel = () => {
        handleClose(onCancel);
    };

    const handleConfirm = () => {
        if (!validateForm()) {
            return;
        }

        // If no customer selected from dropdown, confirm creating new
        if (!selectedCustomer) {
            Alert.alert(
                'สร้างลูกค้าใหม่',
                `ต้องการสร้างลูกค้าใหม่ "${customerName}" หรือไม่?`,
                [
                    { text: 'ยกเลิก', style: 'cancel' },
                    { text: 'สร้าง', onPress: () => submitForm(true) },
                ]
            );
        } else {
            submitForm(false);
        }
    };

    const submitForm = async (isNewCustomer) => {
        let finalImageUrl = customerImage;

        // Upload image to Supabase if it's a new local image
        if (customerImage && isLocalUri(customerImage)) {
            const storeId = getCurrentStoreId();
            if (storeId) {
                const uploadResult = await uploadCustomerImage(customerImage, storeId);
                if (uploadResult.success) {
                    finalImageUrl = uploadResult.url;
                } else {
                    console.error('Customer image upload failed:', uploadResult.error);
                    // Continue with existing URL or null
                }
            }
        }

        handleClose(() => {
            onConfirm?.({
                customerId: selectedCustomer?.id || null,
                customerName,
                customerPhone,
                customerImage: finalImageUrl,
                dueDate,
                amount,
                isNewCustomer,
            });
        });
    };

    const handleDateChange = (event, date) => {
        setShowDatePicker(false);
        if (date) {
            setSelectedDate(date);
            setDueDate(formatDate(date));
        }
    };

    const renderCustomerItem = ({ item }) => (
        <TouchableOpacity
            style={styles.customerItem}
            onPress={() => selectCustomer(item)}
        >
            <View style={styles.customerItemAvatar}>
                {item.image_url ? (
                    <Image source={{ uri: item.image_url }} style={styles.customerItemImage} />
                ) : (
                    <AntDesign name="user" size={16} color="#888" />
                )}
            </View>
            <View style={styles.customerItemInfo}>
                <Text style={styles.customerItemName}>{item.name}</Text>
                <Text style={styles.customerItemPhone}>{item.phone}</Text>
            </View>
        </TouchableOpacity>
    );

    return (
        <Modal
            animationType="none"
            transparent={true}
            visible={visible}
            onRequestClose={handleCancel}
            statusBarTranslucent={true}
        >
            <KeyboardAvoidingView
                style={styles.modalWrapper}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <View style={styles.modalInner}>
                        {/* Overlay */}
                        <Animated.View style={[styles.modalOverlay, { opacity: fadeAnim }]}>
                            <TouchableOpacity
                                style={styles.overlayTouchable}
                                activeOpacity={1}
                                onPress={handleCancel}
                            />
                        </Animated.View>

                        {/* Content */}
                        <Animated.View
                            style={[
                                styles.modalContent,
                                {
                                    transform: [
                                        { translateY: slideAnim },
                                        { scale: scaleAnim }
                                    ],
                                    opacity: fadeAnim,
                                }
                            ]}
                        >
                            {/* Header */}
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>ค้างชำระ</Text>
                                <TouchableOpacity
                                    onPress={handleCancel}
                                    style={styles.closeButton}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                >
                                    <AntDesign name="close" size={24} color="#000" />
                                </TouchableOpacity>
                            </View>

                            <ScrollView
                                showsVerticalScrollIndicator={false}
                                keyboardShouldPersistTaps="handled"
                            >
                                {/* Amount Display */}
                                <View style={styles.amountContainer}>
                                    <Text style={styles.amountLabel}>ยอดชำระทั้งหมด</Text>
                                    <Text style={styles.amountValue}>฿ {amount.toFixed(2)}</Text>
                                </View>

                                {/* Avatar */}
                                <TouchableOpacity style={styles.avatarContainer} onPress={pickImage}>
                                    {customerImage ? (
                                        <Image source={{ uri: customerImage }} style={styles.avatarImage} />
                                    ) : (
                                        <View style={styles.avatarPlaceholder}>
                                            <AntDesign name="user" size={32} color="#999" />
                                        </View>
                                    )}
                                    <View style={styles.avatarEditIcon}>
                                        <AntDesign name="camera" size={12} color="#fff" />
                                    </View>
                                </TouchableOpacity>

                                {/* Customer Name Input */}
                                <View style={styles.inputGroup}>
                                    <View style={styles.inputLabel}>
                                        <FontAwesome name="user-o" size={16} color="#4A90D9" />
                                        <Text style={styles.inputLabelText}>ชื่อลูกค้า</Text>
                                    </View>
                                    <TextInput
                                        style={[styles.textInput, errors.customerName && styles.textInputError]}
                                        placeholder="ชื่อลูกค้า..."
                                        placeholderTextColor="#999"
                                        value={customerName}
                                        onChangeText={handleNameChange}
                                        returnKeyType="next"
                                    />
                                    {errors.customerName && (
                                        <Text style={styles.errorText}>กรุณากรอกชื่อลูกค้า</Text>
                                    )}
                                </View>

                                {/* Phone Input */}
                                <View style={styles.inputGroup}>
                                    <View style={styles.inputLabel}>
                                        <FontAwesome name="phone" size={16} color="#4A90D9" />
                                        <Text style={styles.inputLabelText}>เบอร์โทรศัพท์</Text>
                                    </View>
                                    <TextInput
                                        style={[styles.textInput, errors.customerPhone && styles.textInputError]}
                                        placeholder="เบอร์โทร..."
                                        placeholderTextColor="#999"
                                        value={customerPhone}
                                        onChangeText={handlePhoneChange}
                                        keyboardType="phone-pad"
                                        returnKeyType="done"
                                    />
                                    {errors.customerPhone && (
                                        <Text style={styles.errorText}>กรุณากรอกเบอร์โทร 10 หลัก</Text>
                                    )}
                                </View>

                                {/* Customer Dropdown */}
                                {showDropdown && customers.length > 0 && (
                                    <View style={styles.dropdown}>
                                        <Text style={styles.dropdownTitle}>ลูกค้าที่พบ</Text>
                                        <FlatList
                                            data={customers}
                                            keyExtractor={(item) => item.id.toString()}
                                            renderItem={renderCustomerItem}
                                            scrollEnabled={false}
                                        />
                                    </View>
                                )}

                                {/* Due Date Input */}
                                <View style={styles.inputGroup}>
                                    <View style={styles.inputLabel}>
                                        <MaterialCommunityIcons name="calendar" size={16} color="#FFA800" />
                                        <Text style={styles.inputLabelText}>กำหนดชำระเงิน</Text>
                                    </View>
                                    <TouchableOpacity
                                        style={styles.dateInput}
                                        onPress={() => setShowDatePicker(true)}
                                    >
                                        <Text style={styles.dateText}>{dueDate}</Text>
                                        <MaterialCommunityIcons name="calendar" size={20} color="#666" />
                                    </TouchableOpacity>
                                </View>

                                {/* Action Buttons */}
                                <View style={styles.actionButtons}>
                                    <TouchableOpacity
                                        style={styles.cancelButton}
                                        onPress={handleCancel}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={styles.cancelButtonText}>ยกเลิก</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.confirmButton}
                                        onPress={handleConfirm}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={styles.confirmButtonText}>ตกลง</Text>
                                    </TouchableOpacity>
                                </View>
                            </ScrollView>
                        </Animated.View>
                    </View>
                </TouchableWithoutFeedback>
            </KeyboardAvoidingView>

            {/* Date Picker สำหรับ iOS */}
            {showDatePicker && Platform.OS === 'ios' && (
                <Modal
                    transparent={true}
                    animationType="slide"
                    visible={showDatePicker}
                >
                    <View style={styles.datePickerOverlay}>
                        <View style={styles.datePickerContainer}>
                            <View style={styles.datePickerHeader}>
                                <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                                    <Text style={styles.datePickerCancel}>ยกเลิก</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => {
                                    setDueDate(formatDate(selectedDate));
                                    setShowDatePicker(false);
                                }}>
                                    <Text style={styles.datePickerDone}>เลือก</Text>
                                </TouchableOpacity>
                            </View>
                            <DateTimePicker
                                value={selectedDate}
                                mode="date"
                                display="spinner"
                                locale="th-TH"
                                onChange={(event, date) => {
                                    if (date) setSelectedDate(date);
                                }}
                                minimumDate={new Date()}
                                style={{ height: 200 }}
                            />
                        </View>
                    </View>
                </Modal>
            )}

            {/* Date Picker สำหรับ Android */}
            {showDatePicker && Platform.OS === 'android' && (
                <DateTimePicker
                    value={selectedDate}
                    mode="date"
                    display="default"
                    locale="th-TH"
                    onChange={handleDateChange}
                    minimumDate={new Date()}
                />
            )}
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalWrapper: {
        flex: 1,
    },
    modalInner: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    overlayTouchable: {
        flex: 1,
    },
    modalContent: {
        position: 'absolute',
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 20,
        width: '90%',
        maxWidth: 400,
        maxHeight: '85%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    closeButton: {
        padding: 4,
    },
    amountContainer: {
        backgroundColor: '#F0F7FF',
        borderRadius: 12,
        padding: 15,
        marginBottom: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    amountLabel: {
        fontSize: 14,
        color: '#666',
    },
    amountValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#4A90D9',
    },
    avatarContainer: {
        alignSelf: 'center',
        marginBottom: 20,
        position: 'relative',
    },
    avatarImage: {
        width: 80,
        height: 80,
        borderRadius: 40,
    },
    avatarPlaceholder: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#F0F0F0',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#E0E0E0',
        borderStyle: 'dashed',
    },
    avatarEditIcon: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: '#4A90D9',
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#fff',
    },
    inputGroup: {
        marginBottom: 15,
    },
    inputLabel: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        gap: 8,
    },
    inputLabelText: {
        fontSize: 14,
        color: '#333',
    },
    textInput: {
        backgroundColor: '#F8F8F8',
        borderRadius: 10,
        paddingHorizontal: 15,
        paddingVertical: 12,
        fontSize: 14,
        borderWidth: 1,
        borderColor: '#E0E0E0',
    },
    textInputError: {
        borderColor: '#E53935',
        borderWidth: 2,
    },
    errorText: {
        color: '#E53935',
        fontSize: 12,
        marginTop: 4,
    },
    dateInput: {
        backgroundColor: '#F8F8F8',
        borderRadius: 10,
        paddingHorizontal: 15,
        paddingVertical: 12,
        borderWidth: 1,
        borderColor: '#E0E0E0',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    dateText: {
        fontSize: 14,
        color: '#333',
    },
    dropdown: {
        backgroundColor: '#fff',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#E0E0E0',
        marginBottom: 15,
        padding: 10,
    },
    dropdownTitle: {
        fontSize: 12,
        color: '#666',
        marginBottom: 8,
    },
    customerItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    customerItemAvatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F0F0F0',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    customerItemImage: {
        width: 36,
        height: 36,
        borderRadius: 18,
    },
    customerItemInfo: {
        flex: 1,
    },
    customerItemName: {
        fontSize: 14,
        fontWeight: '500',
        color: '#333',
    },
    customerItemPhone: {
        fontSize: 12,
        color: '#666',
    },
    actionButtons: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 10,
    },
    cancelButton: {
        flex: 1,
        backgroundColor: '#F0F0F0',
        borderRadius: 25,
        paddingVertical: 15,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cancelButtonText: {
        color: '#666',
        fontSize: 16,
        fontWeight: '600',
    },
    confirmButton: {
        flex: 1,
        backgroundColor: '#333',
        borderRadius: 25,
        paddingVertical: 15,
        justifyContent: 'center',
        alignItems: 'center',
    },
    confirmButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    datePickerOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.5)',
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
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
    },
    datePickerCancel: {
        fontSize: 16,
        color: '#999',
    },
    datePickerDone: {
        fontSize: 16,
        color: '#4A90D9',
        fontWeight: '600',
    },
});
