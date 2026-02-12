import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    Switch,
    Modal,
} from 'react-native';
import { Ionicons, FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

export default function DeviceConnectScreen() {
    const navigation = useNavigation();
    const [savedDevices, setSavedDevices] = useState([
        { id: '1', name: 'XPrinter XP-58', type: 'printer', status: 'ready', connected: true }, // ready = พร้อมใช้งาน
        { id: '2', name: 'Scanner BT-001', type: 'scanner', status: 'history', connected: false }, // history = เคยเชื่อมต่อ
    ]);

    const [isScanning, setIsScanning] = useState(false);
    const [scanModalVisible, setScanModalVisible] = useState(false);
    const [foundDevices, setFoundDevices] = useState([]);

    // Simulate scanning
    useEffect(() => {
        if (scanModalVisible) {
            setIsScanning(true);
            setFoundDevices([]);

            // Mock finding devices
            const timer1 = setTimeout(() => {
                setFoundDevices(prev => [...prev, { id: 'd1', name: 'Digital Scale 200g', type: 'scale' }]);
            }, 1000);

            const timer2 = setTimeout(() => {
                setFoundDevices(prev => [...prev, { id: 'd2', name: 'Unknown Device', type: 'unknown' }]);
                setIsScanning(false);
            }, 2500);

            return () => {
                clearTimeout(timer1);
                clearTimeout(timer2);
            };
        }
    }, [scanModalVisible]);

    const toggleSwitch = (id) => {
        setSavedDevices(prev => prev.map(device =>
            device.id === id ? { ...device, connected: !device.connected, status: !device.connected ? 'ready' : 'history' } : device
        ));
    };

    const getIcon = (type) => {
        switch (type) {
            case 'printer': return <FontAwesome5 name="print" size={24} color="#fff" />;
            case 'scanner': return <MaterialIcons name="qr-code-scanner" size={24} color="#666" />; // Gray for history
            case 'scale': return <FontAwesome5 name="weight" size={20} color="#fff" />;
            default: return <FontAwesome5 name="question" size={20} color="#fff" />;
        }
    };

    // Helper for rendering icons with specific background styles based on connection
    const renderDeviceIcon = (device) => {
        const isConnected = device.connected || device.type === 'scale' || device.type === 'printer'; // Simplification for UI demo
        // Actually, based on screenshot: 
        // Connected (Printer) has Blue BG, White Icon.
        // Disconnected (Scanner) has Gray BG, Gray Icon.

        if (device.connected) {
            return (
                <View style={[styles.iconContainer, { backgroundColor: '#165DFC' }]}>
                    {device.type === 'printer' && <FontAwesome5 name="print" size={24} color="#fff" />}
                    {device.type === 'scanner' && <MaterialIcons name="qr-code-scanner" size={24} color="#fff" />}
                </View>
            )
        } else {
            return (
                <View style={[styles.iconContainer, { backgroundColor: '#9E9E9E' }]}>
                    {/* Screenshot shows gray icon on gray bg? or maybe transparent? 
                        Let's look closer at screenshot 2. 
                        Scanner BT-001: Icon container is Gray. Icon is Dark Gray.
                     */}
                    <MaterialIcons name="qr-code-scanner" size={24} color="#555" />
                </View>
            )
        }
    };

    const renderSavedDevice = ({ item }) => (
        <View style={styles.deviceCard}>
            <View style={styles.deviceInfo}>
                {/* Icon */}
                <View style={[styles.iconContainer, { backgroundColor: item.connected ? '#165DFC' : '#C4C4C4' }]}>
                    {item.type === 'printer' && <FontAwesome5 name="print" size={22} color={item.connected ? "#fff" : "#666"} />}
                    {item.type === 'scanner' && <MaterialIcons name="qr-code-scanner" size={24} color={item.connected ? "#fff" : "#666"} />}
                </View>

                {/* Text */}
                <View style={styles.deviceTextContainer}>
                    <Text style={styles.deviceName}>{item.name}</Text>
                    <View style={styles.statusRow}>
                        {item.connected ? (
                            <Ionicons name="checkmark-circle" size={14} color="#2ECC71" />
                        ) : null}
                        <Text style={[styles.deviceStatus, { color: item.connected ? '#2ECC71' : '#999' }]}>
                            {item.connected ? ' พร้อมใช้งาน' : ' เคยเชื่อมต่อ'}
                        </Text>
                    </View>
                </View>
            </View>

            {/* Action */}
            {item.connected ? (
                <Switch
                    trackColor={{ false: "#767577", true: "#2ECC71" }}
                    thumbColor={"#fff"}
                    ios_backgroundColor="#3e3e3e"
                    onValueChange={() => toggleSwitch(item.id)}
                    value={item.connected}
                />
            ) : (
                <TouchableOpacity style={styles.connectButton} onPress={() => toggleSwitch(item.id)}>
                    <Text style={styles.connectButtonText}>เชื่อมต่อ</Text>
                </TouchableOpacity>
            )}
        </View>
    );

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#333" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}></Text>
                {/* The screenshot doesn't have a standard nav bar title, but let's keep it clean or custom. 
                   Actually Screenshot 1 shows "+ เพิ่มอุปกรณ์" button on top right, and "อุปกรณ์ที่บันทึกแล้ว" text below.
                */}
                <View style={{ flex: 1 }} />
                <TouchableOpacity
                    style={styles.addDeviceButton}
                    onPress={() => setScanModalVisible(true)}
                >
                    <Ionicons name="add" size={20} color="#fff" />
                    <Text style={styles.addDeviceText}>เพิ่มอุปกรณ์</Text>
                </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>อุปกรณ์ที่บันทึกแล้ว</Text>

            <FlatList
                data={savedDevices}
                keyExtractor={item => item.id}
                renderItem={renderSavedDevice}
                contentContainerStyle={styles.listContainer}
            />

            {/* Scan Modal (Bottom Sheet style) */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={scanModalVisible}
                onRequestClose={() => setScanModalVisible(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setScanModalVisible(false)}
                >
                    <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>ค้นหาอุปกรณ์</Text>
                            <TouchableOpacity onPress={() => setScanModalVisible(false)}>
                                <Ionicons name="close" size={24} color="#333" />
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.modalSubtitle}>กำลังสแกน Bluetooth ใกล้เคียง...</Text>

                        {/* Found Devices List */}
                        <View style={styles.foundList}>
                            {foundDevices.map((device) => (
                                <View key={device.id} style={styles.foundItem}>
                                    <View style={styles.foundItemLeft}>
                                        <View style={styles.smallIcon}>
                                            {device.type === 'scale' && <FontAwesome5 name="weight" size={16} color="#fff" />}
                                            {device.type === 'unknown' && <FontAwesome5 name="question" size={16} color="#fff" />}
                                        </View>
                                        <Text style={styles.foundName}>{device.name}</Text>
                                    </View>
                                    <TouchableOpacity style={styles.pairButton}>
                                        <Text style={styles.pairButtonText}>จับคู่</Text>
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </View>

                        {/* Simple loading bar if relevant, or just spacing */}
                        <View style={{ height: 20 }} />
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F5F5', // Light Gray background
        paddingHorizontal: 20,
        paddingTop: 50, // Status bar space
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    backButton: {
        padding: 5,
    },
    addDeviceButton: {
        flexDirection: 'row',
        backgroundColor: '#1E2022', // Dark button
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8,
        alignItems: 'center',
    },
    addDeviceText: {
        color: '#fff',
        marginLeft: 8,
        fontWeight: '600',
    },
    sectionTitle: {
        fontSize: 16,
        color: '#666',
        marginBottom: 10,
        fontWeight: '500',
    },
    listContainer: {
        paddingBottom: 20,
    },
    deviceCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#fff', // White Card
        borderRadius: 16,
        padding: 15,
        marginBottom: 12,
        // Shadow
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
        borderWidth: 1,
        borderColor: '#EFEFEF',
    },
    deviceInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconContainer: {
        width: 50,
        height: 50,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    deviceTextContainer: {
        justifyContent: 'center',
    },
    deviceName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 4,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    deviceStatus: {
        fontSize: 14,
        fontWeight: '500',
        marginLeft: 4,
    },
    connectButton: {
        backgroundColor: '#E0E0E0',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8,
    },
    connectButtonText: {
        color: '#333',
        fontWeight: '600',
        fontSize: 14,
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        minHeight: 350,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
    },
    modalSubtitle: {
        fontSize: 14,
        color: '#999',
        marginBottom: 20,
    },
    foundList: {
        gap: 12,
    },
    foundItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 12,
        backgroundColor: '#fff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#eee',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    foundItemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    smallIcon: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: '#333',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    foundName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },
    pairButton: {
        borderColor: '#ddd',
        borderWidth: 1,
        paddingVertical: 6,
        paddingHorizontal: 16,
        borderRadius: 8,
    },
    pairButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
    },
});
