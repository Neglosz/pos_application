import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Image, SafeAreaView } from 'react-native';
import { Ionicons, MaterialCommunityIcons, FontAwesome5, Octicons } from '@expo/vector-icons';

export default function AIScreen() {
    const [activeTab, setActiveTab] = useState('today'); // today, history, chat
    const [chatMessage, setChatMessage] = useState('');

    // Mock Data
    const suggestions = [
        {
            id: 1,
            type: 'warning',
            title: 'นมสดใกล้หมดอายุ 5 กล่อง',
            detail: 'นม Dutch Mill รสสตรอเบอรี่ จะหมดอายุใน 3 วัน',
            impact: 'คาดว่าได้เงินเพิ่ม 50-75 บาท',
            action: 'ลดราคา 20%',
            actionColor: '#FF6F00',
            icon: 'alert-circle-outline'
        },
        {
            id: 2,
            type: 'debt',
            title: 'ลุงสมชาย ค้างจ่าย 3 สัปดาห์',
            detail: 'ยอดค้างชำระ 450 บาท เกินกำหนด 21 วันแล้ว',
            impact: 'คาดว่าได้เงินเพิ่ม 450 บาท',
            action: 'ส่ง LINE เตือน',
            actionColor: '#E65100',
            icon: 'account-alert-outline'
        },
        {
            id: 3,
            type: 'stock',
            title: 'น้ำดื่มขายดี แต่สต็อกต่ำ',
            detail: 'น้ำดื่ม Singha เหลือ 12 แพ็ค อาจหมดใน 2 วัน',
            impact: 'คาดว่าได้เงินเพิ่ม 300-500 บาท',
            action: 'สั่งเพิ่ม 24 แพ็ค',
            actionColor: '#EF6C00',
            icon: 'cube-send'
        },
        {
            id: 4,
            type: 'info',
            title: 'สินค้าขายดีประจำสัปดาห์',
            detail: 'อย่าลืมเช็คสต็อกก่อนวันหยุดสุดสัปดาห์',
            impact: null,
            action: 'ดูรายงาน',
            actionColor: '#2196F3',
            icon: 'chart-line'
        }
    ];

    const chatSuggestions = [
        { id: 1, icon: 'chart-line', text: 'สินค้าขายดีเดือนนี้' },
        { id: 2, icon: 'cube-outline', text: 'ควรสั่งสินค้าอะไร' },
        { id: 3, icon: 'account-clock-outline', text: 'ลูกหนี้ค้างมากสุด' },
        { id: 4, icon: 'calendar-alert', text: 'สินค้าใกล้หมดอายุ' },
    ];

    const renderTodayTab = () => (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Impact Summary Card */}
            <View style={styles.summaryCard}>
                <View style={styles.summaryHeader}>
                    <View style={styles.summaryIconBg}>
                        <MaterialCommunityIcons name="bullseye-arrow" size={24} color="#E65100" />
                    </View>
                    <View>
                        <Text style={styles.summaryTitle}>สรุปสัปดาห์ที่ 5</Text>
                        <TouchableOpacity style={styles.seeAllBtn}>
                            <Text style={styles.seeAllText}>ดูทั้งหมด</Text>
                            <Ionicons name="chevron-forward" size={14} color="#888" />
                        </TouchableOpacity>
                    </View>
                </View>

                <Text style={styles.summaryAmount}>2,340 บาท <Text style={styles.summaryTrend}>+12%</Text></Text>
                <Text style={styles.summarySubtitle}>เงินที่ได้เพิ่มจากการทำตาม AI</Text>

                <View style={styles.progressBarContainer}>
                    <View style={styles.progressBar}>
                        <View style={[styles.progressFill, { width: '75%' }]} />
                    </View>
                    <View style={styles.progressLabelRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name="checkmark-circle" size={14} color="#4CAF50" />
                            <Text style={styles.progressText}> ทำตามแล้ว 6/8 คำแนะนำ</Text>
                        </View>
                        <Text style={styles.progressPercent}>75%</Text>
                    </View>
                </View>

                <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>3</Text>
                        <Text style={styles.statLabel}>ลดของเสีย</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>2</Text>
                        <Text style={styles.statLabel}>เก็บหนี้ได้</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>1</Text>
                        <Text style={styles.statLabel}>สต็อกไม่ขาด</Text>
                    </View>
                </View>
            </View>

            {/* Daily Card */}
            <View style={styles.dailyCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15 }}>
                    <View style={styles.dailyIconBg}>
                        <Ionicons name="trending-up" size={18} color="#4CAF50" />
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.dailyTitle}>เดือนนี้ทำตามแล้ว</Text>
                        <Text style={styles.dailyAmount}>2,340 บาท</Text>
                    </View>
                    <View>
                        <Text style={styles.dailyCountLabel}>คำแนะนำที่ทำตาม</Text>
                        <Text style={styles.dailyCountValue}>2/8</Text>
                    </View>
                </View>
                <View style={styles.progressBarSmall}>
                    <View style={[styles.progressFillSmall, { width: '25%', backgroundColor: '#E65100' }]} />
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                    <Ionicons name="checkmark-circle-outline" size={14} color="#4CAF50" />
                    <Text style={styles.dailyCheer}> เยี่ยมมาก! ทำต่อไปเรื่อยๆ</Text>
                </View>
            </View>

            {/* Section Header */}
            <View style={styles.sectionHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="bulb-outline" size={18} color="#E65100" style={{ marginRight: 6 }} />
                    <Text style={styles.sectionHeaderTitle}>คำแนะนำวันนี้</Text>
                </View>
                <View style={styles.badgeCount}>
                    <Text style={styles.badgeCountText}>3 รายการ</Text>
                </View>
            </View>

            {/* Suggestions List (Max 3) */}
            {suggestions.slice(0, 3).map((item) => (
                <View key={item.id} style={styles.suggestionCard}>
                    <View style={styles.suggestionContent}>
                        <View style={styles.suggestionHeader}>
                            <View style={[styles.iconBox, { backgroundColor: item.type === 'warning' ? '#FFF3E0' : item.type === 'debt' ? '#E8F5E9' : '#E3F2FD' }]}>
                                <MaterialCommunityIcons
                                    name={item.icon}
                                    size={24}
                                    color={item.type === 'warning' ? '#F57C00' : item.type === 'debt' ? '#4CAF50' : '#2196F3'}
                                />
                            </View>
                            <View style={{ flex: 1, marginLeft: 12 }}>
                                {item.type === 'warning' && <View style={styles.tagUrgent}><Text style={styles.tagUrgentText}>ด่วน</Text></View>}
                                {item.type === 'debt' && <View style={styles.tagRec}><Text style={styles.tagRecText}>แนะนำ</Text></View>}

                                <Text style={styles.cardTitle}>{item.title}</Text>
                                <Text style={styles.cardDetail}>{item.detail}</Text>
                            </View>
                        </View>

                        {item.impact && (
                            <View style={styles.impactBox}>
                                <Octicons name="sparkles-fill" size={16} color="#43A047" style={{ marginRight: 6 }} />
                                <Text style={styles.impactText}>{item.impact}</Text>
                            </View>
                        )}

                        <TouchableOpacity onPress={() => { }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
                                <Ionicons name="chevron-down" size={16} color="#888" />
                                <Text style={{ fontSize: 12, color: '#888', marginLeft: 4 }}>ทำไมถึงแนะนำ?</Text>
                            </View>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.actionFooter}>
                        <TouchableOpacity style={styles.skipBtn}>
                            <Ionicons name="close" size={16} color="#666" />
                            <Text style={styles.skipText}>ข้าม</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: item.actionColor }]}>
                            <Ionicons name="checkmark" size={18} color="#fff" style={{ marginRight: 6 }} />
                            <Text style={styles.actionText}>{item.action}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            ))}
        </ScrollView>
    );

    const renderChatTab = () => (
        <View style={[styles.container, { padding: 20, alignItems: 'center', justifyContent: 'center' }]}>
            <View style={styles.aiAvatarLarge}>
                <Octicons name="sparkles-fill" size={40} color="#fff" />
            </View>
            <Text style={styles.chatTitle}>ถามอะไรก็ได้เกี่ยวกับร้าน</Text>
            <Text style={styles.chatSubtitle}>AI จะตอบจากข้อมูลจริงของร้านคุณ</Text>

            <View style={styles.chipContainer}>
                {chatSuggestions.map((item) => (
                    <TouchableOpacity key={item.id} style={styles.chatChip}>
                        <MaterialCommunityIcons name={item.icon} size={18} color="#E65100" style={{ marginRight: 8 }} />
                        <Text style={styles.chipText}>{item.text}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <View style={{ flex: 1 }} />

            {/* Input Bar */}
            <View style={styles.inputContainer}>
                <TextInput
                    style={styles.chatInput}
                    placeholder="พิมพ์คำถาม..."
                    placeholderTextColor="#999"
                    value={chatMessage}
                    onChangeText={setChatMessage}
                />
                <TouchableOpacity style={styles.sendBtn}>
                    <Ionicons name="send" size={18} color="#fff" />
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            {/* Main Header
            <View style={styles.mainHeader}>
                <View style={styles.headerIcon}>
                    <Octicons name="sparkles-fill" size={20} color="#fff" />
                </View>
                <View>
                    <Text style={styles.headerTitle}>ผู้ช่วยร้านค้า</Text>
                    <Text style={styles.headerSubtitle}>คำแนะนำจากข้อมูลจริงของร้านคุณ</Text>
                </View>
            </View> */}

            {/* Tab Bar */}
            <View style={styles.tabBar}>
                <TouchableOpacity
                    style={[styles.tabItem, activeTab === 'today' && styles.activeTab]}
                    onPress={() => setActiveTab('today')}
                >
                    <Ionicons name="sunny-outline" size={18} color={activeTab === 'today' ? '#E65100' : '#888'} />
                    <Text style={[styles.tabText, activeTab === 'today' && styles.activeTabText]}>วันนี้</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tabItem, activeTab === 'history' && styles.activeTab]}
                    onPress={() => setActiveTab('history')}
                >
                    <MaterialCommunityIcons name="history" size={18} color={activeTab === 'history' ? '#E65100' : '#888'} />
                    <Text style={[styles.tabText, activeTab === 'history' && styles.activeTabText]}>ประวัติ</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tabItem, activeTab === 'chat' && styles.activeTab]}
                    onPress={() => setActiveTab('chat')}
                >
                    <MaterialCommunityIcons name="comment-text-outline" size={18} color={activeTab === 'chat' ? '#E65100' : '#888'} />
                    <Text style={[styles.tabText, activeTab === 'chat' && styles.activeTabText]}>ถาม AI</Text>
                </TouchableOpacity>
            </View>

            {/* Content Body */}
            <View style={styles.contentBody}>
                {activeTab === 'today' && renderTodayTab()}
                {activeTab === 'chat' && renderChatTab()}
                {activeTab === 'history' && (
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                        <MaterialCommunityIcons name="history" size={64} color="#ddd" />
                        <Text style={{ color: '#aaa', marginTop: 10 }}>ยังไม่มีประวัติการทำรายการ</Text>
                    </View>
                )}
            </View>

        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB', // Creamy bg from image
    },
    mainHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 15,
        backgroundColor: '#F9FAFB',
    },
    headerIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#FFCCBC', // Light orange
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#222',
    },
    headerSubtitle: {
        fontSize: 12,
        color: '#888',
    },
    tabBar: {
        flexDirection: 'row',
        marginHorizontal: 20,
        backgroundColor: '#F5F5F5',
        borderRadius: 25,
        padding: 4,
        marginBottom: 10,
    },
    tabItem: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 20,
    },
    activeTab: {
        backgroundColor: '#fff',
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2,
    },
    tabText: {
        fontSize: 14,
        color: '#888',
        fontWeight: '600',
        marginLeft: 6,
    },
    activeTabText: {
        color: '#333',
    },
    contentBody: {
        flex: 1,
    },
    scrollContent: {
        padding: 20,
        paddingTop: 5,
    },

    // Summary Card
    summaryCard: {
        backgroundColor: '#FFF3E0', // Very light orange
        borderRadius: 20,
        padding: 20,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: '#FFE0B2',
    },
    summaryHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 10,
    },
    summaryIconBg: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#FFCCBC',
        justifyContent: 'center',
        alignItems: 'center',
    },
    seeAllBtn: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    seeAllText: {
        fontSize: 12,
        color: '#888',
        marginRight: 4,
    },
    summaryTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
        marginBottom: 4,
    },
    summaryAmount: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#222',
        marginBottom: 4,
    },
    summaryTrend: {
        fontSize: 16,
        color: '#4CAF50',
        fontWeight: '600',
    },
    summarySubtitle: {
        fontSize: 12,
        color: '#666',
        marginBottom: 15,
    },
    progressBarContainer: {
        marginBottom: 20,
    },
    progressBar: {
        height: 8,
        backgroundColor: '#eee',
        borderRadius: 4,
        marginBottom: 8,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#43A047',
        borderRadius: 4,
    },
    progressLabelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    progressText: {
        fontSize: 12,
        color: '#555',
    },
    progressPercent: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#555',
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        backgroundColor: '#fff',
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 20,
    },
    statItem: {
        alignItems: 'center',
    },
    statValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#222',
    },
    statLabel: {
        fontSize: 11,
        color: '#888',
    },
    statDivider: {
        width: 1,
        height: '100%',
        backgroundColor: '#eee',
    },

    // Daily Card (White)
    dailyCard: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 16,
        marginBottom: 25,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 1,
    },
    dailyIconBg: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#E8F5E9',
        justifyContent: 'center',
        alignItems: 'center',
    },
    dailyTitle: {
        fontSize: 12,
        color: '#888',
        marginBottom: 2,
    },
    dailyAmount: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#43A047',
    },
    dailyCountLabel: {
        fontSize: 10,
        color: '#aaa',
        textAlign: 'right',
    },
    dailyCountValue: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#333',
        textAlign: 'right',
    },
    progressBarSmall: {
        height: 4,
        backgroundColor: '#F5F5F5',
        borderRadius: 2,
        overflow: 'hidden',
        marginBottom: 8,
    },
    progressFillSmall: {
        height: '100%',
        borderRadius: 2,
    },
    dailyCheer: {
        fontSize: 12,
        color: '#666',
        marginLeft: 4,
    },

    // Section Header
    sectionHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
    },
    sectionHeaderTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#222',
    },
    badgeCount: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        backgroundColor: '#eee',
        borderRadius: 10,
    },
    badgeCountText: {
        fontSize: 10,
        color: '#666',
        fontWeight: '600',
    },

    // Suggestion Cards
    suggestionCard: {
        backgroundColor: '#fff',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#eee',
        padding: 16,
        marginBottom: 15,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 5, elevation: 2,
    },
    suggestionContent: {
        backgroundColor: '#F4F4F4', // Inner slightly darker
        borderRadius: 16,
        padding: 16,
        marginBottom: 0,
    },
    suggestionHeader: {
        flexDirection: 'row',
        marginBottom: 12,
    },
    iconBox: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    tagUrgent: {
        backgroundColor: '#FFEBEE',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
        alignSelf: 'flex-start',
        marginBottom: 4,
    },
    tagUrgentText: {
        fontSize: 10,
        color: '#D32F2F',
        fontWeight: 'bold',
    },
    tagRec: {
        backgroundColor: '#E8F5E9',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
        alignSelf: 'flex-start',
        marginBottom: 4,
    },
    tagRecText: {
        fontSize: 10,
        color: '#43A047',
        fontWeight: 'bold',
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#222',
        marginBottom: 4,
    },
    cardDetail: {
        fontSize: 12,
        color: '#666',
        lineHeight: 18,
    },
    impactBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E8F5E9',
        borderRadius: 20,
        paddingVertical: 8,
        paddingHorizontal: 16,
        marginTop: 4,
    },
    impactText: {
        fontSize: 13,
        color: '#2E7D32',
        fontWeight: '600',
    },
    actionFooter: {
        flexDirection: 'row',
        marginTop: 15,
        gap: 12,
    },
    skipBtn: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 25,
        paddingVertical: 12,
        borderWidth: 1,
        borderColor: '#ddd',
    },
    skipText: {
        fontSize: 14,
        color: '#666',
        fontWeight: '600',
        marginLeft: 4,
    },
    actionBtn: {
        flex: 2,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 25,
        paddingVertical: 12,
    },
    actionText: {
        fontSize: 14,
        color: '#fff',
        fontWeight: 'bold',
    },

    // Chat Tab
    aiAvatarLarge: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#FFCCBC',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    chatTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#222',
        marginBottom: 8,
    },
    chatSubtitle: {
        fontSize: 14,
        color: '#888',
        marginBottom: 30,
    },
    chipContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 10,
        width: '100%',
    },
    chatChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#eee',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 10,
        minWidth: '45%',
    },
    chipText: {
        fontSize: 13,
        color: '#444',
        fontWeight: '500',
    },
    inputContainer: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F0F0F0',
        borderRadius: 25,
        paddingHorizontal: 20,
        paddingVertical: 5,
    },
    chatInput: {
        flex: 1,
        height: 44,
        fontSize: 16,
        color: '#333',
    },
    sendBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F37021',
        justifyContent: 'center',
        alignItems: 'center',
    },
});
