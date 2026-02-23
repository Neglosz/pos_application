import React, { createContext, useState, useEffect, useContext } from "react";
import { BleManager } from "react-native-ble-plx";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { PermissionsAndroid, Platform } from "react-native";

const BluetoothContext = createContext();
const manager = new BleManager();
const STORAGE_KEY = '@paired_devices';

export const BluetoothProvider = ({ children }) => {
    const [savedDevices, setSavedDevices] = useState([]);
    const [isScanning, setIsScanning] = useState(false);

    const [connectedScanner, setConnectedScanner] = useState(null);
    const [connectedPrinter, setConnectedPrinter] = useState(null);
    const [connectedScale, setConnectedScale] = useState(null);
    const [scaleWeight, setScaleWeight] = useState('0.0');
    const [scaleMonitorSub, setScaleMonitorSub] = useState(null);

    useEffect(() => {
        AsyncStorage.getItem(STORAGE_KEY).then(data => {
            if (data) {
                const devices = JSON.parse(data);
                setSavedDevices(devices.map(d => ({ ...d, connected: false, status: 'history' })));
            }
        });
    }, []);

    useEffect(() => {
        if (savedDevices.length > 0) {
            AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(savedDevices));
        }
    }, [savedDevices]);

    const requestPermissions = async () => {
        if (Platform.OS === 'android') {
            const apiLevel = Platform.Version; // เช็ค Android version
            if (apiLevel >= 31) {
                // Android 12+ ต้องขอ BLUETOOTH_SCAN + BLUETOOTH_CONNECT
                const granted = await PermissionsAndroid.requestMultiple([
                    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
                    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
                ]);
                return Object.values(granted).every(v => v === 'granted');
            } else {
                // Android 11 หรือต่ำกว่า ขอแค่ Location (ใช้แทน BLE scan)
                const granted = await PermissionsAndroid.request(
                    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
                );
                return granted === PermissionsAndroid.RESULTS.GRANTED;
            }
        }
        return true;
    };

    const guessType = (name) => {
        const lower = name.toLowerCase();
        if (lower.includes('print') || lower.includes('xp-')) return 'printer';
        if (lower.includes('scan')) return 'scanner';
        if (lower.includes('scale') || lower.includes('weight')) return 'scale';
        return 'unknown';
    };

    const connectToDevice = async (device) => {
        try {
            const connected = await manager.connectToDevice(device.id);
            await connected.discoverAllServicesAndCharacteristics();
            
            setSavedDevices(prev => prev.map(d =>
                d.id === device.id ? { ...d, connected: true, status: 'ready' } : d
            ));
            if (device.type === 'scanner') setConnectedScanner(connected);
            if (device.type === 'printer') setConnectedPrinter(connected);
            if (device.type === 'scale') {
                setConnectedScale(connected);
                startScaleMonitor(connected);
            }
            return true;
        } catch (error) {
            console.error("Connection error:", error);
            throw error;
        }
    };

    const disconnectDevice = async (device) => {
        try {
            await manager.cancelDeviceConnection(device.id);
            
            setSavedDevices(prev => prev.map(d =>
                d.id === device.id ? { ...d, connected: false, status: 'history' } : d
            ));
            if (device.type === 'scanner') setConnectedScanner(null);
            if (device.type === 'printer') setConnectedPrinter(null);
            if (device.type === 'scale') {
                stopScaleMonitor(); 
                setConnectedScale(null);
            }
            
            return true;
        } catch (error) {
            console.error("Disconnect error:", error);
            throw error;
        }
    };

    const findWritableCharacteristic = async (device) => {
        const services = await device.services();
        for(const service of services){
            const chracteristics = await service.characteristics();
            for(const char of chracteristics){
                if(char.isWritableWithResponse || char.isWritableWithoutResponse){
                    return char;
                }
            }
        }
        return null;
    };

    const textToBase64 = (text) => {
        const bytes = [];
        for(let i = 0; i < text.length; i++){
            bytes.push(text.charCodeAt(i) & 0xFF);
        }
        const binary = String.fromCharCode(...bytes);
        return btoa(binary);
    };

    const writeToCharacteristic = async (characteristic, data) => {
        const CHUNK_SIZE = 20;
        for (let i = 0; i < data.length; i += CHUNK_SIZE) {
            const chunk = data.slice(i, i + CHUNK_SIZE);
            const base64Chunk = textToBase64(chunk);
            if (characteristic.isWritableWithResponse) {
                await characteristic.writeWithResponse(base64Chunk);
            } else {
                await characteristic.writeWithoutResponse(base64Chunk);
            }
        }
    };

    const findNotifyCharacteristic = async (device) => {
        const services = await device.services();
        for (const service of services) {
            const characteristics = await service.characteristics();
            for (const char of characteristics) {
                if (char.isNotifiable) {
                    return char;
                }
            }
        }
        return null;
    };

    const base64ToString = (base64) => {
        try {
            const binary = atob(base64);
            let result = '';
            for (let i = 0; i < binary.length; i++) {
                result += String.fromCharCode(binary.charCodeAt(i));
            }
            return result;
        } catch (e) {
            return '';
        }
    };

    const parseWeight = (rawData) => {
        // ตาชั่งส่วนใหญ่ส่งมาเป็น string เช่น "  0.350 kg" หรือ byte array
        // ลองแปลงเป็น string แล้วดึงตัวเลขออกมา
        const str = typeof rawData === 'string' ? rawData : '';
        const match = str.match(/[\d]+\.[\d]+/);  // หาตัวเลขทศนิยม
        if (match) {
            return match[0]; // เช่น "0.350"
        }
        // ถ้าไม่เจอทศนิยม ลองหาตัวเลขจำนวนเต็ม
        const intMatch = str.match(/[\d]+/);
        if (intMatch) {
            return intMatch[0];
        }
        return '0.0';
    };

    const startScaleMonitor = async (device) => {
        try {
            const char = await findNotifyCharacteristic(device);
            if (!char) {
                console.warn('ไม่พบ Notify Characteristic ของตาชั่ง');
                return;
            }
            // Subscribe รับค่าจากตาชั่งแบบ Realtime
            const subscription = char.monitor((error, characteristic) => {
                if (error) {
                    console.error('Scale monitor error:', error);
                    return;
                }
                if (characteristic?.value) {
                    const rawString = base64ToString(characteristic.value);
                    const weight = parseWeight(rawString);
                    setScaleWeight(weight);
                }
            });
            setScaleMonitorSub(subscription);
            console.log('✅ Scale monitor started');
        } catch (error) {
            console.error('Failed to start scale monitor:', error);
        }
    };

    const stopScaleMonitor = () => {
        if (scaleMonitorSub) {
            scaleMonitorSub.remove();
            setScaleMonitorSub(null);
        }
        setScaleWeight('0.0');
    };

    const printReceipt = async (transaction) => {
        if (!connectedPrinter) {
            throw new Error('ไม่ได้เชื่อมต่อเครื่องพิมพ์');
        }
        try {
            const char = await findWritableCharacteristic(connectedPrinter);
            if (!char) {
                throw new Error('ไม่พบ Characteristic สำหรับเขียนข้อมูล');
            }
            // === สร้างเนื้อหาใบเสร็จ ===
            const ESC = '\x1B';
            const GS = '\x1D';
            // คำสั่ง ESC/POS
            const INIT = ESC + '@';              // Reset เครื่องปริ้น
            const CENTER = ESC + 'a' + '\x01';    // จัดกลาง
            const LEFT = ESC + 'a' + '\x00';      // จัดซ้าย
            const BOLD_ON = ESC + 'E' + '\x01';   // ตัวหนา เปิด
            const BOLD_OFF = ESC + 'E' + '\x00';  // ตัวหนา ปิด
            const DOUBLE_SIZE = GS + '!' + '\x11'; // ตัวใหญ่ 2 เท่า
            const NORMAL_SIZE = GS + '!' + '\x00'; // ตัวปกติ
            const CUT = GS + 'V' + '\x00';        // ตัดกระดาษ
            const LINE = '--------------------------------\n';
            // ข้อมูลร้าน
            const storeName = transaction?.store?.name || 'My Store';
            const storeAddr = transaction?.store?.address || '';
            const storePhone = transaction?.store?.phone || '';
            // สร้างข้อความใบเสร็จ
            let receipt = '';
            receipt += INIT;
            receipt += CENTER;
            receipt += DOUBLE_SIZE + storeName + '\n' + NORMAL_SIZE;
            if (storeAddr) receipt += storeAddr + '\n';
            if (storePhone) receipt += 'Tel: ' + storePhone + '\n';
            receipt += LINE;
            // ข้อมูลบิล
            receipt += LEFT;
            receipt += 'No: ' + (transaction?.receiptNo || transaction?.order_no || '-') + '\n';
            receipt += 'Date: ' + (transaction?.date || new Date().toLocaleString('th-TH')) + '\n';
            receipt += 'Pay: ' + (transaction?.paymentMethod || '-') + '\n';
            receipt += LINE;
            // รายการสินค้า
            const items = transaction?.items || [];
            for (const item of items) {
                const name = (item.name || '').substring(0, 20); // ตัดชื่อยาวเกิน
                const qty = item.quantity || 1;
                const price = (item.price || 0).toFixed(2);
                receipt += name + ' x' + qty + '\n';
                receipt += '                       ' + price + '\n';
            }
            receipt += LINE;
            // ยอดรวม
            receipt += CENTER;
            receipt += BOLD_ON + DOUBLE_SIZE;
            receipt += 'TOTAL: ' + (transaction?.total || 0).toLocaleString() + ' B\n';
            receipt += NORMAL_SIZE + BOLD_OFF;
            receipt += LEFT;
            receipt += 'Received: ' + (transaction?.received || 0).toLocaleString() + '\n';
            receipt += 'Change:   ' + (transaction?.change || 0).toLocaleString() + '\n';
            receipt += LINE;
            receipt += CENTER;
            receipt += '*** Thank You ***\n\n\n';
            receipt += CUT;
            // ส่งไปเครื่องปริ้น
            await writeToCharacteristic(char, receipt);
            return true;
        } catch (error) {
            console.error('Print error:', error);
            throw error;
        }
    };

    return (
        <BluetoothContext.Provider value={{
            manager,
            savedDevices,
            setSavedDevices,
            isScanning,
            setIsScanning,
            connectedScanner,
            connectedPrinter,
            connectedScale,
            requestPermissions,
            guessType,
            connectToDevice,
            disconnectDevice,
            scaleWeight,
            printReceipt,
        }}>
            {children}
        </BluetoothContext.Provider>
    );
};

export const useBluetooth = () => useContext(BluetoothContext);