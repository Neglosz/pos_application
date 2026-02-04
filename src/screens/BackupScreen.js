import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch, SafeAreaView } from 'react-native';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

export default function BackupScreen() {
    const navigation = useNavigation();

    // UI State
    const [autoBackup, setAutoBackup] = useState(true);
    const [wifiOnly, setWifiOnly] = useState(true);
    const [notify, setNotify] = useState(true);

    const historyData = [
        { id: 1, date: 'เมื่อวาน, 1 ก.พ.', time: '18:00 น.', size: '12.4 MB', status: 'success' },
        { id: 2, date: '31 ม.ค. 67', time: '18:00 น.', size: '12.2 MB', status: 'success' },
        { id: 3, date: '30 ม.ค. 67', time: '18:00 น.', size: '11.8 MB', status: 'waiting' },
    ];

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#000" />
                </TouchableOpacity>
                <View>
                    <Text style={styles.headerTitle}>การสำรองข้อมูล</Text>
                    <Text style={styles.headerSubtitle}>จัดการและปกป้องข้อมูลของคุณ</Text>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                {/* Status Card */}
                <View style={styles.statusCard}>
                    <View style={styles.statusHeader}>
                        <View style={styles.statusIconBg}>
                            <Ionicons name="shield-checkmark" size={24} color="#4CAF50" />
                        </View>
                        <View>
                            <View style={styles.secureTag}>
                                <View style={styles.secureDot} />
                                <Text style={styles.secureText}>ปลอดภัย</Text>
                            </View>
                            <Text style={styles.statusTitle}>ข้อมูลได้รับการป้องกัน</Text>
                        </View>
                    </View>

                    <View style={styles.statusStatsRow}>
                        <View style={styles.statItem}>
                            <View style={styles.statIconCircle}>
                                <Ionicons name="calendar-outline" size={16} color="#aaa" />
                            </View>
                            <View>
                                <Text style={styles.statLabel}>สำรองล่าสุด</Text>
                                <Text style={styles.statValue}>วันนี้, 14:30 น.</Text>
                            </View>
                        </View>
                        <View style={styles.verticalDivider} />
                        <View style={styles.statItem}>
                            <View style={styles.statIconCircle}>
                                <Ionicons name="server-outline" size={16} color="#aaa" />
                            </View>
                            <View>
                                <Text style={styles.statLabel}>ขนาดข้อมูล</Text>
                                <Text style={styles.statValue}>12.5 MB</Text>
                            </View>
                        </View>
                    </View>

                    {/* Decor */}
                    <View style={styles.cardDecor} />
                </View>

                {/* Actions */}
                <View style={styles.actionRow}>
                    <TouchableOpacity style={styles.backupButton} activeOpacity={0.8}>
                        <View style={styles.actionIconBg}>
                            <Ionicons name="cloud-upload-outline" size={24} color="#fff" />
                        </View>
                        <Text style={styles.backupButtonText}>สำรองข้อมูล</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.restoreButton} activeOpacity={0.8}>
                        <View style={[styles.actionIconBg, { backgroundColor: '#F5F5F5' }]}>
                            <Ionicons name="cloud-download-outline" size={24} color="#666" />
                        </View>
                        <Text style={styles.restoreButtonText}>กู้คืนข้อมูล</Text>
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
                                <Text style={styles.settingTitle}>สำรองอัตโนมัติ</Text>
                                <Text style={styles.settingSub}>ทุกวัน เวลา 00:00 น.</Text>
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
                        <View style={styles.settingLeft}>
                            <View style={styles.settingIconBox}>
                                <Ionicons name="wifi-outline" size={22} color="#666" />
                            </View>
                            <View>
                                <Text style={styles.settingTitle}>เฉพาะ WiFi</Text>
                                <Text style={styles.settingSub}>สำรองเมื่อเชื่อมต่อ WiFi เท่านั้น</Text>
                            </View>
                        </View>
                        <Switch
                            trackColor={{ false: "#e0e0e0", true: "#4CAF50" }} // Different color for wifi maybe? or stick to theme
                            thumbColor={"#fff"}
                            ios_backgroundColor="#e0e0e0"
                            onValueChange={setWifiOnly}
                            value={wifiOnly}
                        />
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.settingItem}>
                        <View style={styles.settingLeft}>
                            <View style={styles.settingIconBox}>
                                <Ionicons name="notifications-outline" size={22} color="#666" />
                            </View>
                            <View>
                                <Text style={styles.settingTitle}>การแจ้งเตือน</Text>
                                <Text style={styles.settingSub}>แจ้งเตือนเมื่อสำรองเสร็จ</Text>
                            </View>
                        </View>
                        <Switch
                            trackColor={{ false: "#e0e0e0", true: "#4CAF50" }}
                            thumbColor={"#fff"}
                            ios_backgroundColor="#e0e0e0"
                            onValueChange={setNotify}
                            value={notify}
                        />
                    </View>
                </View>

                {/* History Section */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 10 }}>
                    <Text style={styles.sectionHeader}>ประวัติการสำรอง</Text>
                    <TouchableOpacity>
                        <Text style={{ color: '#F37021', fontSize: 13, fontWeight: '600' }}>ดูทั้งหมด</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.historyList}>
                    {historyData.map((item, index) => (
                        <View key={item.id}>
                            <View style={styles.historyItem}>
                                <View style={styles.historyLeft}>
                                    <View style={[styles.statusDot, { backgroundColor: item.status === 'success' ? '#4CAF50' : '#FF9800' }]}>
                                        <Ionicons name={item.status === 'success' ? "checkmark" : "time"} size={12} color="#fff" />
                                    </View>
                                    <View>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            <Text style={styles.historyDate}>{item.date}</Text>
                                            <View style={styles.tagSuccess}>
                                                <Text style={styles.tagText}>เต็มรูปแบบ</Text>
                                            </View>
                                        </View>
                                        <Text style={styles.historyDetail}>{item.time} • {item.size}</Text>
                                    </View>
                                </View>
                                <TouchableOpacity style={styles.miniRestoreBtn}>
                                    <Text style={styles.miniRestoreText}>กู้คืน</Text>
                                </TouchableOpacity>
                            </View>
                            {index < historyData.length - 1 && <View style={styles.divider} />}
                        </View>
                    ))}
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
