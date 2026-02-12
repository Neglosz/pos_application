import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useOfflineStore } from '../stores/useOfflineStore';
import { createSale, createCreditSale } from '../services/api';
import NetInfo from '@react-native-community/netinfo';

export default function BackupScreen() {
    const navigation = useNavigation();

    // Store State
    const pendingSales = useOfflineStore(state => state.pendingSales);
    const isOnline = useOfflineStore(state => state.isOnline);
    const lastSyncTime = useOfflineStore(state => state.lastSyncTime);
    const removePendingSale = useOfflineStore(state => state.removePendingSale);
    const clearQueue = useOfflineStore(state => state.clearQueue);

    // UI State
    const [autoBackup, setAutoBackup] = useState(true);
    const [wifiOnly, setWifiOnly] = useState(true);
    const [notify, setNotify] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);

    // Sync Function
    const handleSync = async () => {
        if (pendingSales.length === 0) {
            Alert.alert("แจ้งเตือน", "ไม่มีข้อมูลที่ต้องส่งครับ");
            return;
        }

        const state = await NetInfo.fetch();
        if (!state.isConnected) {
            Alert.alert("ข้อผิดพลาด", "กรุณาเชื่อมต่ออินเทอร์เน็ตก่อนส่งข้อมูล");
            return;
        }

        setIsSyncing(true);
        let successCount = 0;
        let failCount = 0;

        for (const sale of pendingSales) {
            try {
                // Remove tempId before sending, but keep created_at as client_created_at
                const { tempId, isCredit, ...payload } = sale;

                // Add client_created_at to payload
                const syncPayload = {
                    ...payload,
                    client_created_at: sale.created_at
                };

                let result;
                if (isCredit) {
                    // For credit sales, we might need to adjust the API to handle the specific payload structure
                    // Assuming createCreditSale handles it or we use generic createSale
                    // Note: createCreditSale in api.js now checks for offline. 
                    // We need to BYPASS the offline check in api.js? 
                    // No, api.js checks useOfflineStore.isOnline. 
                    // Ensure we are online before calling this.
                    // IMPORTANT: We should duplicate logic or force 'online' behavior?
                    // Actually, since we check NetInfo above, useOfflineStore.isOnline should be true.
                    result = await createCreditSale(syncPayload);
                } else {
                    result = await createSale(syncPayload);
                }

                if (result.success || result.data?.id) { // Check for success
                    removePendingSale(tempId);
                    successCount++;
                } else {
                    console.error("Sync Failed for", tempId, result);
                    failCount++;
                }

            } catch (error) {
                console.error("Sync Error:", error);
                failCount++;
            }
        }

        setIsSyncing(false);
        useOfflineStore.getState().setLastSyncTime(new Date().toISOString());

        if (failCount === 0) {
            Alert.alert("สำเร็จ ✅", `ส่งข้อมูล ${successCount} รายการเรียบร้อยแล้ว`);
        } else {
            Alert.alert("แจ้งเตือน", `ส่งสำเร็จ ${successCount} รายการ \nล้มเหลว ${failCount} รายการ (จะลองใหม่ภายหลัง)`);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#000" />
                </TouchableOpacity>
                <View>
                    <Text style={styles.headerTitle}>สถานะการเชื่อมต่อ & ข้อมูล</Text>
                    <Text style={styles.headerSubtitle}>จัดการข้อมูลแบบออฟไลน์</Text>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                {/* Status Card */}
                <View style={[styles.statusCard, !isOnline && { backgroundColor: '#333' }]}>
                    <View style={styles.statusHeader}>
                        <View style={[styles.statusIconBg, !isOnline && { backgroundColor: 'rgba(244, 67, 54, 0.15)', borderColor: 'rgba(244, 67, 54, 0.3)' }]}>
                            <Ionicons name={isOnline ? "wifi" : "wifi-outline"} size={24} color={isOnline ? "#4CAF50" : "#F44336"} />
                        </View>
                        <View>
                            <View style={styles.secureTag}>
                                <View style={[styles.secureDot, !isOnline && { backgroundColor: '#F44336' }]} />
                                <Text style={[styles.secureText, !isOnline && { color: '#F44336' }]}>
                                    {isOnline ? "ออนไลน์ (Online)" : "ออฟไลน์ (Offline)"}
                                </Text>
                            </View>
                            <Text style={styles.statusTitle}>
                                {isOnline ? "ระบบพร้อมใช้งาน" : "ทำงานด้วยข้อมูลในเครื่อง"}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.statusStatsRow}>
                        <View style={styles.statItem}>
                            <View style={styles.statIconCircle}>
                                <Ionicons name="cloud-upload-outline" size={16} color="#aaa" />
                            </View>
                            <View>
                                <Text style={styles.statLabel}>รอส่งข้อมูล (Pending)</Text>
                                <Text style={[styles.statValue, pendingSales.length > 0 && { color: '#FFC107' }]}>
                                    {pendingSales.length} รายการ
                                </Text>
                            </View>
                        </View>
                        <View style={styles.verticalDivider} />
                        <View style={styles.statItem}>
                            <View style={styles.statIconCircle}>
                                <Ionicons name="time-outline" size={16} color="#aaa" />
                            </View>
                            <View>
                                <Text style={styles.statLabel}>อัปเดตล่าสุด</Text>
                                <Text style={styles.statValue}>
                                    {lastSyncTime ? new Date(lastSyncTime).toLocaleTimeString('th-TH') : '-'}
                                </Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Pending Items List (Preview) */}
                {pendingSales.length > 0 && (
                    <View style={styles.pendingList}>
                        <Text style={styles.sectionHeader}>รายการรอส่ง ({pendingSales.length})</Text>
                        {pendingSales.slice(0, 3).map((sale, index) => (
                            <View key={sale.tempId || index} style={styles.historyItem}>
                                <View style={styles.historyLeft}>
                                    <View style={[styles.statusDot, { backgroundColor: '#FFAB00' }]}>
                                        <Ionicons name="hourglass-outline" size={14} color="#fff" />
                                    </View>
                                    <View>
                                        <Text style={styles.historyDate}>บิลยอด ฿{sale.totalAmount || 0}</Text>
                                        <Text style={styles.historyDetail}>
                                            {new Date(sale.created_at).toLocaleTimeString('th-TH')} • {sale.isCredit ? 'เครดิต' : 'เงินสด'}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        ))}
                        {pendingSales.length > 3 && (
                            <Text style={{ textAlign: 'center', color: '#666', marginTop: 10 }}>
                                และอีก {pendingSales.length - 3} รายการ...
                            </Text>
                        )}
                    </View>
                )}

                {/* Actions */}
                <View style={styles.actionRow}>
                    <TouchableOpacity
                        style={[styles.backupButton, (pendingSales.length === 0 || isSyncing) && { backgroundColor: '#aaa' }]}
                        activeOpacity={0.8}
                        onPress={handleSync}
                        disabled={pendingSales.length === 0 || isSyncing}
                    >
                        <View style={styles.actionIconBg}>
                            <Ionicons name={isSyncing ? "refresh" : "cloud-upload"} size={24} color="#fff" />
                        </View>
                        <Text style={styles.backupButtonText}>
                            {isSyncing ? "กำลังส่งข้อมูล..." : "กดส่งข้อมูลเดี๋ยวนี้"}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Settings Section */}
                <Text style={styles.sectionHeader}>การตั้งค่า</Text>
                <View style={styles.settingsGroup}>
                    <View style={styles.settingItem}>
                        <View style={styles.settingLeft}>
                            <View style={styles.settingIconBox}>
                                <Ionicons name="sync-outline" size={22} color="#F37021" />
                            </View>
                            <View>
                                <Text style={styles.settingTitle}>ส่งข้อมูลอัตโนมัติ</Text>
                                <Text style={styles.settingSub}>เมื่อเน็ตมา จะส่งทันที</Text>
                            </View>
                        </View>
                        <Switch
                            trackColor={{ false: "#e0e0e0", true: "#F37021" }}
                            thumbColor={"#fff"}
                            ios_backgroundColor="#e0e0e0"
                            onValueChange={setAutoBackup}
                            value={autoBackup}
                        />
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.settingItem}>
                        <TouchableOpacity onPress={() => clearQueue()} style={{ padding: 10 }}>
                            <Text style={{ color: 'red' }}>ล้างข้อมูลที่ค้างอยู่ (Debug)</Text>
                        </TouchableOpacity>
                    </View>
                </View>

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 40,
    },
    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 15,
        backgroundColor: '#F9FAFB',
    },
    backButton: {
        marginRight: 15,
        padding: 5,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#000',
    },
    headerSubtitle: {
        fontSize: 12,
        color: '#666',
        marginTop: 2,
    },

    // Status Card
    statusCard: {
        backgroundColor: '#111',
        borderRadius: 20,
        padding: 24,
        marginTop: 10,
        marginBottom: 20,
        position: 'relative',
        overflow: 'hidden',
    },
    statusHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
    },
    statusIconBg: {
        width: 48,
        height: 48,
        borderRadius: 16,
        backgroundColor: 'rgba(76, 175, 80, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
        borderWidth: 1,
        borderColor: 'rgba(76, 175, 80, 0.3)',
    },
    secureTag: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    secureDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#4CAF50',
        marginRight: 6,
    },
    secureText: {
        color: '#4CAF50',
        fontSize: 12,
        fontWeight: '600',
    },
    statusTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    statusStatsRow: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 16,
        padding: 16,
        justifyContent: 'space-between',
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    statIconCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    verticalDivider: {
        width: 1,
        height: '100%',
        backgroundColor: 'rgba(255,255,255,0.1)',
        marginHorizontal: 15,
    },
    statLabel: {
        color: '#888',
        fontSize: 11,
        marginBottom: 2,
    },
    statValue: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '600',
    },
    cardDecor: {
        position: 'absolute',
        top: -30,
        right: -30,
        width: 120,
        height: 120,
        backgroundColor: '#F37021', // Orange accent
        opacity: 0.1,
        borderRadius: 60,
    },

    // Action Buttons
    actionRow: {
        flexDirection: 'row',
        gap: 15,
        marginBottom: 25,
    },
    backupButton: {
        flex: 1,
        backgroundColor: '#F37021',
        borderRadius: 20,
        paddingVertical: 20,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#F37021', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
    },
    restoreButton: {
        flex: 1,
        backgroundColor: '#fff',
        borderRadius: 20,
        paddingVertical: 20,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#eee',
    },
    actionIconBg: {
        marginBottom: 10,
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.2)', // For backup
    },
    backupButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    restoreButtonText: {
        color: '#333',
        fontSize: 16,
        fontWeight: 'bold',
    },

    // Settings
    sectionHeader: {
        fontSize: 14,
        color: '#666',
        marginBottom: 10,
    },
    settingsGroup: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 5,
        marginBottom: 10,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 2,
    },
    settingItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 15,
    },
    settingLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    settingIconBox: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: '#FAFAFA',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    settingTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#111',
    },
    settingSub: {
        fontSize: 11,
        color: '#888',
        marginTop: 2,
    },
    divider: {
        height: 1,
        backgroundColor: '#f0f0f0',
        marginLeft: 60, // Indent for sleek look
    },

    // History
    historyList: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 5,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 2,
    },
    historyItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 15,
    },
    historyLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statusDot: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    historyDate: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#111',
    },
    historyDetail: {
        fontSize: 12,
        color: '#888',
        marginTop: 2,
    },
    tagSuccess: {
        backgroundColor: 'rgba(76, 175, 80, 0.1)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    tagText: {
        color: '#4CAF50',
        fontSize: 10,
        fontWeight: '600',
    },
    miniRestoreBtn: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 15,
        backgroundColor: '#111',
    },
    miniRestoreText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
});
