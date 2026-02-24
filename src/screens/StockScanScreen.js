import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, StatusBar, Animated, TouchableWithoutFeedback, Vibration } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import AddStockModal from '../components/AddStockModal';
import { useProductStore } from '../stores/useProductStore';

export default function StockScanScreen({ navigation }) {
    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);
    const scannedRef = useRef(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [scannedCode, setScannedCode] = useState('');
    const [torchOn, setTorchOn] = useState(false);
    const [focusMode, setFocusMode] = useState('on');
    const soundRef = useRef(null);

    // Focus Animation
    const focusAnim = useRef(new Animated.Value(0)).current;

    const handleRefocus = () => {
        // Toggle autofocus off and on to trigger re-focus
        setFocusMode('off');

        // Trigger Animation
        focusAnim.setValue(1);
        Animated.sequence([
            Animated.timing(focusAnim, {
                toValue: 0.5,
                duration: 200,
                useNativeDriver: true,
            }),
            Animated.timing(focusAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }),
        ]).start();

        setTimeout(() => {
            setFocusMode('on');
        }, 500); // 0.5s delay to ensure focus reset
    };

    async function playSound() {
        try {
            if (soundRef.current) {
                await soundRef.current.replayAsync();
            }
        } catch (error) {
            console.log('Error playing sound', error);
        }
    }

    React.useEffect(() => {
        async function loadSound() {
            try {
                const { sound: newSound } = await Audio.Sound.createAsync(
                    require('../../assets/beep.wav')
                );
                soundRef.current = newSound;
            } catch (error) {
                console.log('Error loading sound', error);
            }
        }
        loadSound();
        return () => {
            if (soundRef.current) soundRef.current.unloadAsync();
        };
    }, []);

    // Valid barcode types for products
    const VALID_BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'codabar'];

    const handleBarCodeScanned = ({ type, data }) => {
        if(scannedRef.current) return;
        scannedRef.current = true;

        
        // Filter out non-barcode types (e.g. QR codes)
        const barcodeType = type?.toString().toLowerCase().replace(/[-.]/g, '_');
        if (!VALID_BARCODE_TYPES.some(t => barcodeType.includes(t))) {
            setScanned(true);
            Alert.alert(
                'ไม่ใช่บาร์โค้ดสินค้า',
                'สิ่งที่สแกนได้เป็น QR Code ไม่ใช่บาร์โค้ดสินค้า กรุณาสแกนบาร์โค้ดที่อยู่บนตัวสินค้า',
                [{ text: 'ตกลง', onPress: () => setScanned(false) }]
            );
            return;
        }

        Vibration.vibrate();
        playSound();
        setScanned(true);
        setScannedCode(data);
        setModalVisible(true);
    };

    const handleAddStock = (data) => {
        // Trigger generic refresh to update lists
        useProductStore.getState().refreshProducts();

        if (data.isNew) {
            Alert.alert("สำเร็จ", `เพิ่มสินค้าใหม่ "${data.name}" จำนวน ${data.addedQty} ชิ้น เรียบร้อย`);
        } else {
            Alert.alert("สำเร็จ", `เติมสต็อก "${data.name}" จำนวน ${data.addedQty} ชิ้น\n(สต็อกรวม: ${data.newStockQty} ชิ้น)`);
        }
        setModalVisible(false);
        setTimeout(() => { setScanned(false); scannedRef.current = false; }, 1000);
    };

    const handleCloseModal = () => {
        setModalVisible(false);
        setScanned(false);
        scannedRef.current = false;
    };

    if (!permission) {
        return <View style={styles.container} />;
    }

    if (!permission.granted) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.permissionContainer}>
                    <Text style={styles.permissionText}>เราต้องการสิทธิ์เปิดกล้องเพื่อสแกนสินค้า</Text>
                    <TouchableOpacity onPress={requestPermission} style={styles.permissionButton}>
                        <Text style={styles.permissionButtonText}>อนุญาตให้ใช้กล้อง</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Text style={styles.backButtonText}>ย้อนกลับ</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <View style={styles.container}>
            {/* Full screen black background to block previous screen */}
            <View style={styles.opaqueBackground} />
            <StatusBar barStyle="light-content" backgroundColor="black" />
            <CameraView
                style={styles.camera}
                facing="back"
                onBarcodeScanned={modalVisible ? undefined : handleBarCodeScanned}
                barcodeScannerSettings={{
                    barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128", "code39", "codabar"],
                }}
                autofocus={focusMode}
                enableTorch={torchOn}
            >
                {/* Header Overlay */}
                <SafeAreaView style={styles.headerOverlay}>
                    <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
                        <Ionicons name="close" size={28} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>สแกนสินค้าเข้าคลัง</Text>
                    <View style={{ width: 44 }} />
                </SafeAreaView>

                {/* Focus Indicator */}
                <Animated.View style={[styles.focusIndicator, { opacity: focusAnim, transform: [{ scale: focusAnim }] }]} />

                {/* Scan Frame & Tap to Focus */}
                <TouchableWithoutFeedback onPress={handleRefocus}>
                    <View style={styles.scanFrameContainer}>
                        <View style={styles.scanFrame}>
                            <View style={styles.cornerTL} />
                            <View style={styles.cornerTR} />
                            <View style={styles.cornerBL} />
                            <View style={styles.cornerBR} />
                        </View>
                        <Text style={styles.instructionText}>แตะหน้าจอเพื่อโฟกัส</Text>
                    </View>
                </TouchableWithoutFeedback>

                {/* Bottom Controls */}
                <SafeAreaView style={styles.bottomControls} edges={['bottom']}>
                    <TouchableOpacity
                        style={[styles.flashButton, torchOn && styles.activeFlashButton]}
                        onPress={() => setTorchOn(!torchOn)}
                    >
                        <Ionicons name={torchOn ? "flash" : "flash-off"} size={28} color={torchOn ? "#000" : "#fff"} />
                        <Text style={[styles.flashText, torchOn && { color: '#000' }]}>
                            {torchOn ? 'ปิดไฟฉาย' : 'เปิดไฟฉาย'}
                        </Text>
                    </TouchableOpacity>
                </SafeAreaView>
            </CameraView>

            <AddStockModal
                visible={modalVisible}
                scannedCode={scannedCode}
                onClose={handleCloseModal}
                onConfirm={handleAddStock}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'black',
    },
    camera: {
        flex: 1,
    },
    opaqueBackground: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'black',
        zIndex: -1,
    },
    headerOverlay: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 10,
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
    },
    headerTitle: {
        color: 'white',
        fontSize: 18,
        fontWeight: '600',
    },
    iconButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    activeButton: {
        backgroundColor: '#FFD700',
        borderColor: '#FFD700',
    },
    scanFrameContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scanFrame: {
        width: 250,
        height: 250,
        justifyContent: 'space-between',
    },
    instructionText: {
        color: 'white',
        marginTop: 20,
        fontSize: 16,
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        overflow: 'hidden',
    },
    // Corners for scan frame
    cornerTL: { position: 'absolute', top: 0, left: 0, width: 40, height: 40, borderTopWidth: 4, borderLeftWidth: 4, borderColor: '#69F0AE' },
    cornerTR: { position: 'absolute', top: 0, right: 0, width: 40, height: 40, borderTopWidth: 4, borderRightWidth: 4, borderColor: '#69F0AE' },
    cornerBL: { position: 'absolute', bottom: 0, left: 0, width: 40, height: 40, borderBottomWidth: 4, borderLeftWidth: 4, borderColor: '#69F0AE' },
    cornerBR: { position: 'absolute', bottom: 0, right: 0, width: 40, height: 40, borderBottomWidth: 4, borderRightWidth: 4, borderColor: '#69F0AE' },

    permissionContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 20,
    },
    permissionText: {
        fontSize: 16,
        marginBottom: 20,
        textAlign: 'center',
    },
    permissionButton: {
        backgroundColor: '#1E2022',
        padding: 12,
        borderRadius: 8,
        marginBottom: 12,
    },
    permissionButtonText: {
        color: 'white',
        fontWeight: 'bold',
    },
    backButton: {
        padding: 12,
    },
    backButtonText: {
        color: '#666',
    },
    bottomControls: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 30,
        alignItems: 'center',
        justifyContent: 'center',
    },
    flashButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 30,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    activeFlashButton: {
        backgroundColor: '#FFD700',
        borderColor: '#FFD700',
    },
    flashText: {
        color: '#fff',
        marginLeft: 8,
        fontSize: 16,
        fontWeight: '600',
    },
    focusIndicator: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        width: 60,
        height: 60,
        marginLeft: -30,
        marginTop: -30,
        borderWidth: 2,
        borderColor: '#FFD700',
        borderRadius: 30, // Circle
        zIndex: 5,
    },
});
