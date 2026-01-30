import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Vibration, ActivityIndicator, Dimensions, Image } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera'; // CameraView is the ONLY way in v17
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { useProductStore } from '../stores/useProductStore';
import { useCartStore } from '../stores/useCartStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');
const SCAN_FRAME_SIZE = 260;

export default function ScanScreen({ navigation }) {
    const [permission, requestPermission] = useCameraPermissions();
    const [isProcessing, setIsProcessing] = useState(false); // Only one state for processing
    const [lastScannedProduct, setLastScannedProduct] = useState(null);
    const [flash, setFlash] = useState(false);
    const insets = useSafeAreaInsets();
    const [sound, setSound] = useState();

    const { getProductByBarcode } = useProductStore();
    const { addToCart } = useCartStore();

    const lastScanTime = useRef(0);
    const timerRef = useRef(null);

    async function playSound() {
        try {
            if (sound) {
                await sound.replayAsync();
            }
        } catch (error) {
            console.log('Error playing sound', error);
        }
    }

    useEffect(() => {
        if (!permission) requestPermission();

        // Preload sound
        async function loadSound() {
            try {
                const { sound: newSound } = await Audio.Sound.createAsync(
                    require('../../assets/beep.wav')
                );
                setSound(newSound);
            } catch (error) {
                console.log('Error loading sound', error);
            }
        }
        loadSound();

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
            if (sound) {
                sound.unloadAsync();
            }
        };
    }, [permission]);

    // Memoize settings to prevent unnecessary camera re-initialization
    const scannerSettings = React.useMemo(() => ({
        barcodeTypes: ["ean13", "ean8", "qr"],
    }), []);

    const handleBarCodeScanned = async ({ type, data }) => {
        // 1. Guard against overlapping scans
        if (isProcessing) return;

        // 2. Cooldown 1.2 seconds to prevent accidental double-scans
        const now = Date.now();
        if (now - lastScanTime.current < 1000) return;

        lastScanTime.current = now;
        setIsProcessing(true);
        Vibration.vibrate(70); // Brief vibration
        playSound(); // Play the beep sound

        try {
            const product = await getProductByBarcode(data);

            if (product) {
                addToCart(product, 1);
                setLastScannedProduct(product);
            } else {
                Alert.alert("ไม่พบสินค้า", `บาร์โค้ด: ${data}\nไม่มีในระบบ`, [{ text: "ตกลง" }]);
            }
        } catch (error) {
            console.error(error);
        } finally {
            // Delay resetting isProcessing to give user time to see feedback
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => {
                setIsProcessing(false);
            });
        }
    };

    if (!permission) return <View style={styles.container}><ActivityIndicator color="#fff" /></View>;
    if (!permission.granted) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ color: '#fff', marginBottom: 20 }}>ต้องการสิทธิ์เข้าถึงกล้อง</Text>
                <TouchableOpacity onPress={requestPermission} style={styles.permButton}>
                    <Text style={styles.permText}>อนุญาต</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* 
               Wrapping CameraView in a flex: 1 container and using absoluteFillObject 
               to ensure it expands naturally. Stretching usually happens when 
               dimensions are inconsistent. 
            */}
            {/* 
               FIX: Camera Stretching on Android
               Calculates a scale factor to fill the screen while maintaining aspect ratio,
               preventing the horizontal 'stretch' reported by the user.
            */}
            <View style={StyleSheet.absoluteFill}>
                <CameraView
                    style={[
                        StyleSheet.absoluteFill,
                        {
                            transform: [
                                { scale: Math.max(height / (width * (16 / 9)), (width * (16 / 9)) / height) }
                            ]
                        }
                    ]}
                    facing="back"
                    enableTorch={flash}
                    onBarcodeScanned={handleBarCodeScanned}
                    barcodeScannerSettings={scannerSettings}
                />
            </View>

            {/* --- OVERLAY UI (Rendered on top of absolute camera) --- */}
            <View style={styles.overlay}>
                {/* --- TOP HEADER --- */}
                <View style={[styles.headerContainer, { paddingTop: insets.top + 10 }]}>
                    <View style={styles.headerContent}>
                        <View style={styles.titleContainer}>
                            <Ionicons name="scan-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                            <Text style={styles.titleText}>สแกนขายสินค้า</Text>
                        </View>
                        <TouchableOpacity
                            style={[styles.flashButton, flash && styles.flashButtonActive]}
                            onPress={() => setFlash(!flash)}
                        >
                            <Ionicons name={flash ? "flash" : "flash-off"} size={20} color={flash ? "#FFD700" : "#fff"} />
                        </TouchableOpacity>
                    </View>

                    {/* STATUS BADGES */}
                    <View style={styles.statusContainer}>
                        {isProcessing && (
                            <View style={styles.processingBadge}>
                                <ActivityIndicator color="#fff" size="small" />
                                <Text style={styles.badgeText}>กำลังค้นหา...</Text>
                            </View>
                        )}
                        {lastScannedProduct && !isProcessing && (
                            <View style={styles.successBadge}>
                                <Ionicons name="checkmark-circle" size={18} color="#4CAF50" />
                                <Text style={[styles.badgeText, { color: '#333' }]}>เพิ่มแล้ว</Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* --- SCANNER FRAME --- */}
                <View style={styles.centerContainer}>
                    <View style={styles.scanFrame}>
                        <View style={[styles.corner, styles.ul]} />
                        <View style={[styles.corner, styles.ur]} />
                        <View style={[styles.corner, styles.dl]} />
                        <View style={[styles.corner, styles.dr]} />
                    </View>
                    <Text style={styles.hintText}></Text>
                </View>

                {/* --- BOTTOM SHEET CONTROLS --- */}
                <View style={[styles.bottomSheet, { paddingBottom: insets.bottom + 20 }]}>
                    {lastScannedProduct ? (
                        <View style={styles.productCard}>
                            <View style={styles.productIcon}>
                                {(lastScannedProduct.image_url || lastScannedProduct.image) ? (
                                    <Image
                                        source={{ uri: lastScannedProduct.image_url || lastScannedProduct.image }}
                                        style={styles.productImage}
                                    />
                                ) : (
                                    <Ionicons name="cube-outline" size={24} color="#fff" />
                                )}
                            </View>
                            <View style={styles.productInfo}>
                                <Text style={styles.productLabel}>ล่าสุด:</Text>
                                <Text style={styles.productName} numberOfLines={1}>{lastScannedProduct.name}</Text>
                            </View>
                            <Text style={styles.productPrice}>฿{lastScannedProduct.price}</Text>
                        </View>
                    ) : (
                        <View style={[styles.productCard, styles.productCardEmpty]}>
                            <Text style={styles.emptyText}>พร้อมสแกน...</Text>
                        </View>
                    )}

                    <View style={styles.actionRow}>
                        <TouchableOpacity
                            style={styles.circleButton}
                            onPress={() => navigation.navigate("ขาย", { screen: 'Search' })}
                        >
                            <Ionicons name="search" size={24} color="#fff" />
                            <Text style={styles.circleButtonText}>ค้นหา</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.pillButton}
                            onPress={() => navigation.navigate("ขาย", { screen: 'Cart' })}
                        >
                            <Text style={styles.pillButtonText}>เสร็จสิ้น (ไปตะกร้า)</Text>
                            <Ionicons name="arrow-forward" size={20} color="#fff" />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    overlay: { flex: 1, backgroundColor: 'transparent' },

    // Header
    headerContainer: {
        position: 'absolute', top: 0, left: 0, right: 0,
        backgroundColor: 'rgba(0,0,0,0.3)',
        paddingBottom: 15,
        alignItems: 'center',
        zIndex: 20
    },
    headerContent: {
        flexDirection: 'row', width: '100%',
        justifyContent: 'space-between', paddingHorizontal: 20, alignItems: 'center'
    },
    titleContainer: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.4)', paddingVertical: 6,
        paddingHorizontal: 15, borderRadius: 20,
    },
    titleText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    flashButton: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center',
    },
    flashButtonActive: { backgroundColor: 'rgba(255,255,255,0.2)' },

    // Status Badges
    statusContainer: { marginTop: 10, height: 30, justifyContent: 'center' },
    processingBadge: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: 'rgba(50,50,50,0.8)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 15,
    },
    successBadge: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.95)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 15,
        shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5,
    },
    badgeText: { fontSize: 14, fontWeight: '500', marginLeft: 6, color: '#fff' },

    // Center Frame
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    scanFrame: { width: SCAN_FRAME_SIZE, height: SCAN_FRAME_SIZE, justifyContent: 'center', alignItems: 'center', position: 'relative' },
    corner: { position: 'absolute', width: 40, height: 40, borderColor: '#00E676', borderWidth: 4, borderRadius: 4 },
    ul: { top: 0, left: 0, borderBottomWidth: 0, borderRightWidth: 0 },
    ur: { top: 0, right: 0, borderBottomWidth: 0, borderLeftWidth: 0 },
    dl: { bottom: 0, left: 0, borderTopWidth: 0, borderRightWidth: 0 },
    dr: { bottom: 0, right: 0, borderTopWidth: 0, borderLeftWidth: 0 },
    hintText: { color: 'rgba(255,255,255,0.7)', marginTop: 20, fontSize: 14 },

    // Bottom Sheet
    bottomSheet: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: 'rgba(0,0,0,0.6)', paddingTop: 20,
        borderTopLeftRadius: 25, borderTopRightRadius: 25, paddingHorizontal: 20,
    },
    productCard: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 16,
        padding: 12, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    },
    productCardEmpty: { justifyContent: 'center', borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'transparent' },
    productIcon: {
        width: 48,
        height: 48,
        borderRadius: 10,
        backgroundColor: '#FF9800',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
        overflow: 'hidden', // Ensure image respects border radius
    },
    productImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    // productIconText removed as it's replaced by Image or Icon
    productInfo: { flex: 1 },
    productLabel: { color: '#ccc', fontSize: 10, textTransform: 'uppercase', marginBottom: 2 },
    productName: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    productPrice: { color: '#4CAF50', fontSize: 18, fontWeight: 'bold' },
    emptyText: { color: '#888', fontStyle: 'italic' },
    actionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    circleButton: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 15 },
    circleButtonText: { color: '#ccc', fontSize: 12, marginTop: 4 },
    pillButton: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#2962FF',
        paddingVertical: 12, paddingHorizontal: 24, borderRadius: 30,
        shadowColor: "#2962FF", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8,
    },
    pillButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginRight: 8 },
    permButton: { backgroundColor: '#2962FF', padding: 12, borderRadius: 8 },
    permText: { color: "#fff", fontWeight: "bold" }
});
