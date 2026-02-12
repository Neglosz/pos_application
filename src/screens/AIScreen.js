import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, Modal, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons, Octicons } from '@expo/vector-icons';
import { getAIRecommendations, getRecommendationStats, getRecommendationHistory, takeRecommendationAction, sendAIChat, applyPromotion, disposeProduct } from '../services/api';

export default function AIScreen() {
    const [activeTab, setActiveTab] = useState('today'); // today, history, chat
    const [chatMessage, setChatMessage] = useState('');
    const [recommendations, setRecommendations] = useState([]);
    const [stats, setStats] = useState(null);
    const [history, setHistory] = useState({});
    const [chatHistory, setChatHistory] = useState([]);
    const [loading, setLoading] = useState(false);
    const [chatLoading, setChatLoading] = useState(false);
    const [expandedCard, setExpandedCard] = useState(null);

    // Modal states
    const [productModalVisible, setProductModalVisible] = useState(false);
    const [debtModalVisible, setDebtModalVisible] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [discountPrice, setDiscountPrice] = useState('');
    const [actionType, setActionType] = useState('discount'); // 'discount' or 'dispose'

    const scrollViewRef = useRef();

    // Mock GPS (Bangkok) - In production, use expo-location
    const MOCK_LOCATION = { lat: 13.7563, lon: 100.5018 };

    useEffect(() => {
        if (activeTab === 'today') {
            loadTodayData();
        } else if (activeTab === 'history') {
            loadHistoryData();
        }
    }, [activeTab]);

    const loadTodayData = async () => {
        try {
            setLoading(true);
            const [recResponse, statsResponse] = await Promise.all([
                getAIRecommendations(MOCK_LOCATION.lat, MOCK_LOCATION.lon),
                getRecommendationStats()
            ]);

            if (recResponse.success) {
                setRecommendations(recResponse.data || []);
            }
            if (statsResponse.success) {
                setStats(statsResponse.data);
            }
        } catch (error) {
            console.error("Fetch AI Data Error:", error);
        } finally {
            setLoading(false);
        }
    };

    const loadHistoryData = async () => {
        try {
            setLoading(true);
            const response = await getRecommendationHistory(30);
            if (response.success) {
                setHistory(response.data || {});
            }
        } catch (error) {
            console.error("Fetch History Error:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async (item, action) => {
        try {
            const response = await takeRecommendationAction(item.id, action);
            if (response.success) {
                // Remove from current list
                setRecommendations(prev => prev.filter(r => r.id !== item.id));
                // Reload stats
                const statsResponse = await getRecommendationStats();
                if (statsResponse.success) setStats(statsResponse.data);
            }
        } catch (error) {
            console.error("Action Error:", error);
        }
    };

    // Handle Accept button - open appropriate modal
    const handleAcceptAction = (item) => {
        setSelectedItem(item);

        if (item.type === 'expiry' || item.type === 'stock') {
            // Check if AI recommends dispose (expired product)
            const aiDiscount = item.payload?.recommended_discount;
            if (aiDiscount?.action === 'dispose' || aiDiscount?.percent === 100) {
                setActionType('dispose');
                setDiscountPrice('');
            } else {
                setActionType('discount');
                // Pre-fill with AI recommended price
                setDiscountPrice(aiDiscount?.price_after_discount?.toString() || '');
            }
            setProductModalVisible(true);
        } else if (item.type === 'debt') {
            // Debt action - check if phone exists
            const phone = item.payload?.phone;
            if (phone) {
                // Direct call
                Linking.openURL(`tel:${phone}`);
                handleAction(item, 'accepted');
            } else {
                // Open modal to select customer
                setDebtModalVisible(true);
            }
        } else {
            // Default - just mark as accepted
            handleAction(item, 'accepted');
        }
    };

    // Handle product discount/dispose confirm
    const handleProductConfirm = async () => {
        if (!selectedItem) return;

        try {
            // Extract product names from AI recommendation
            const productNames = selectedItem.payload?.target_products || [selectedItem.title];
            const discountPercent = selectedItem.payload?.recommended_discount?.percent || 20;

            if (actionType === 'dispose') {
                // Call API to dispose expired products
                const result = await disposeProduct(selectedItem.id, productNames);
                if (result.success) {
                    Alert.alert(
                        'สำเร็จ ✅',
                        `ตัดสต็อก ${result.data.totalDisposed} ชิ้น จาก ${result.data.disposedItems.length} batch แล้ว`,
                        [{ text: 'ตกลง' }]
                    );
                } else {
                    throw new Error(result.error || 'Dispose failed');
                }
            } else {
                // Call API to create promotion
                const result = await applyPromotion(
                    selectedItem.id,
                    productNames,
                    discountPercent,
                    3 // 3 days valid
                );
                if (result.success) {
                    const products = result.data.affectedProducts;
                    const expiresAt = new Date(result.data.expiresAt).toLocaleDateString('th-TH');
                    Alert.alert(
                        'สร้างโปรโมชั่นสำเร็จ! 🎉',
                        `ลด ${discountPercent}% สำหรับ ${products.length} สินค้า\n\nหมดเขต: ${expiresAt}\n\nตอนขายสินค้า ระบบจะใช้ราคาโปรอัตโนมัติ`,
                        [{ text: 'เยี่ยม!' }]
                    );
                } else {
                    throw new Error(result.error || 'Promotion failed');
                }
            }

            // Remove from pending list
            setRecommendations(prev => prev.filter(r => r.id !== selectedItem.id));
            // Reload stats
            const statsResponse = await getRecommendationStats();
            if (statsResponse.success) setStats(statsResponse.data);

            setProductModalVisible(false);
            setSelectedItem(null);
        } catch (error) {
            console.error('Product action error:', error);
            Alert.alert('เกิดข้อผิดพลาด', error.message || 'ไม่สามารถดำเนินการได้');
        }
    };

    // Handle debt call
    const handleDebtCall = (phone) => {
        if (phone) {
            Linking.openURL(`tel:${phone}`);
            if (selectedItem) {
                handleAction(selectedItem, 'accepted');
            }
            setDebtModalVisible(false);
            setSelectedItem(null);
        }
    };

    const handleSendMessage = async () => {
        if (!chatMessage.trim() || chatLoading) return;

        const userMsg = { role: 'user', parts: [{ text: chatMessage }] };
        const newHistory = [...chatHistory, userMsg];

        setChatHistory(newHistory);
        const currentMsg = chatMessage;
        setChatMessage('');
        setChatLoading(true);

        try {
            const response = await sendAIChat(currentMsg, MOCK_LOCATION.lat, MOCK_LOCATION.lon, chatHistory);
            if (response.success) {
                const aiMsg = { role: 'model', parts: [{ text: response.answer }] };
                setChatHistory(prev => [...prev, aiMsg]);
            }
        } catch (error) {
            console.error("Chat Error:", error);
        } finally {
            setChatLoading(false);
        }
    };

    const getTypeConfig = (type) => {
        const configs = {
            expiry: { icon: 'alert-outline', color: '#FF9800', bg: '#FFF3E0', label: 'ด่วน' },
            debt: { icon: 'person-outline', color: '#4CAF50', bg: '#E8F5E9', label: 'แนะนำ' },
            stock: { icon: 'cube-outline', color: '#FF9800', bg: '#FFF3E0', label: 'แนะนำ' },
            price: { icon: 'trending-up-outline', color: '#2196F3', bg: '#E3F2FD', label: 'แนะนำ' },
        };
        return configs[type] || configs.stock;
    };

    const renderTodayTab = () => {
        const pendingRecs = recommendations.filter(r => r.status === 'pending');

        return (
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Summary Card */}
                <View style={styles.summaryCard}>
                    <View style={styles.summaryHeader}>
                        <View style={styles.summaryDot} />
                        <Text style={styles.summaryLabel}>สรุปสัปดาห์ที่ {stats?.weekNumber || 1}</Text>
                        <TouchableOpacity style={styles.seeAllBtn}>
                            <Text style={styles.seeAllText}>ดูทั้งหมด</Text>
                            <Ionicons name="chevron-forward" size={12} color="#888" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.summaryMain}>
                        <Text style={styles.summaryAmount}>
                            {(stats?.moneyEarned || 0).toLocaleString()} <Text style={styles.summaryUnit}>บาท</Text>
                        </Text>
                        {stats?.moneyEarned > 0 && (
                            <View style={styles.growthBadge}>
                                <Ionicons name="trending-up" size={12} color="#4CAF50" />
                                <Text style={styles.growthText}>+12%</Text>
                            </View>
                        )}
                    </View>
                    <Text style={styles.summarySubtitle}>เงินที่ได้เพิ่มจากการทำตาม AI</Text>

                    {/* Progress Bar */}
                    <View style={styles.progressSection}>
                        <View style={styles.progressBarContainer}>
                            <View style={[styles.progressFill, { width: `${stats?.followedPercent || 0}%` }]} />
                        </View>
                        <View style={styles.progressLabels}>
                            <View style={styles.progressLabelLeft}>
                                <Ionicons name="checkmark-circle" size={14} color="#4CAF50" />
                                <Text style={styles.progressText}> ทำตามแล้ว {stats?.followedCount || 0}/{stats?.totalRecommendations || 0} คำแนะนำ</Text>
                            </View>
                            <Text style={styles.progressPercent}>{stats?.followedPercent || 0}%</Text>
                        </View>
                    </View>

                    {/* Stats Row */}
                    <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{stats?.byType?.expiry || 0}</Text>
                            <Text style={styles.statLabel}>ลดของเสีย</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{stats?.byType?.debt || 0}</Text>
                            <Text style={styles.statLabel}>เก็บหนี้ได้</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{stats?.byType?.stock || 0}</Text>
                            <Text style={styles.statLabel}>สต็อกไม่ขาด</Text>
                        </View>
                    </View>
                </View>

                {/* Daily Progress Card */}
                <View style={styles.dailyCard}>
                    <View style={styles.dailyRow}>
                        <View style={styles.dailyLeft}>
                            <View style={styles.dailyIconBg}>
                                <Ionicons name="trending-up" size={18} color="#4CAF50" />
                            </View>
                            <View style={styles.dailyInfo}>
                                <Text style={styles.dailyLabel}>เดือนนี้ทำตามแล้ว</Text>
                                <Text style={styles.dailyAmount}>{(stats?.moneyEarned || 0).toLocaleString()} บาท</Text>
                            </View>
                        </View>
                        <View style={styles.dailyRight}>
                            <Text style={styles.dailyRightLabel}>คำแนะนำที่ทำตาม</Text>
                            <Text style={styles.dailyRightValue}>{stats?.followedCount || 0}/{stats?.totalRecommendations || 0}</Text>
                        </View>
                    </View>
                    <View style={styles.cheerRow}>
                        <Ionicons name="checkmark-circle" size={14} color="#4CAF50" />
                        <Text style={styles.cheerText}> เยี่ยมมาก! ทำต่อไปเรื่อยๆ</Text>
                    </View>
                </View>

                {/* Section Header */}
                <View style={styles.sectionHeader}>
                    <View style={styles.sectionTitleRow}>
                        <Ionicons name="bulb-outline" size={18} color="#E65100" />
                        <Text style={styles.sectionTitle}> คำแนะนำวันนี้</Text>
                    </View>
                    <View style={styles.countBadge}>
                        <Text style={styles.countText}>{pendingRecs.length}/3 รายการ</Text>
                    </View>
                </View>

                {loading ? (
                    <ActivityIndicator size="large" color="#F37021" style={{ marginTop: 30 }} />
                ) : pendingRecs.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Ionicons name="checkmark-circle" size={48} color="#4CAF50" />
                        <Text style={styles.emptyTitle}>ทำครบหมดแล้ววันนี้!</Text>
                        <Text style={styles.emptySubtitle}>ไม่มีคำแนะนำเหลือ กลับมาใหม่พรุ่งนี้</Text>
                    </View>
                ) : (
                    pendingRecs.map((item) => {
                        const config = getTypeConfig(item.type);
                        const isExpanded = expandedCard === item.id;

                        return (
                            <View key={item.id} style={styles.recCard}>
                                {/* Card Content */}
                                <View style={styles.recContent}>
                                    <View style={styles.recHeader}>
                                        <View style={[styles.iconBox, { backgroundColor: config.bg }]}>
                                            <Ionicons name={config.icon} size={24} color={config.color} />
                                        </View>
                                        <View style={styles.recInfo}>
                                            <View style={[styles.tag, { backgroundColor: item.type === 'expiry' ? '#FFEBEE' : '#E8F5E9' }]}>
                                                <Text style={[styles.tagText, { color: item.type === 'expiry' ? '#D32F2F' : '#43A047' }]}>
                                                    {item.type === 'expiry' ? 'ด่วน' : 'แนะนำ'}
                                                </Text>
                                            </View>
                                            <Text style={styles.recTitle}>{item.title}</Text>
                                            <Text style={styles.recDetail}>{item.detail}</Text>
                                        </View>
                                    </View>

                                    {/* Impact Box */}
                                    {item.expected_impact && (
                                        <View style={styles.impactBox}>
                                            <Octicons name="sparkle" size={16} color="#43A047" />
                                            <Text style={styles.impactText}> {item.expected_impact}</Text>
                                        </View>
                                    )}

                                    {/* Why Recommend */}
                                    <TouchableOpacity
                                        style={styles.whyBtn}
                                        onPress={() => setExpandedCard(isExpanded ? null : item.id)}
                                    >
                                        <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={16} color="#888" />
                                        <Text style={styles.whyText}>ทำไมถึงแนะนำ?</Text>
                                    </TouchableOpacity>

                                    {isExpanded && (
                                        <View style={styles.whyContent}>
                                            <Text style={styles.whyContentText}>
                                                {item.payload?.reason || item.detail || 'คำแนะนำนี้มาจากการวิเคราะห์ข้อมูลจริงของร้านคุณ'}
                                            </Text>
                                        </View>
                                    )}
                                </View>

                                {/* Action Footer */}
                                <View style={styles.actionFooter}>
                                    <TouchableOpacity
                                        style={styles.skipBtn}
                                        onPress={() => handleAction(item, 'skipped')}
                                    >
                                        <Ionicons name="close" size={16} color="#666" />
                                        <Text style={styles.skipText}> ข้าม</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.actionBtn, { backgroundColor: config.color }]}
                                        onPress={() => handleAcceptAction(item)}
                                    >
                                        <Ionicons name="checkmark" size={18} color="#fff" />
                                        <Text style={styles.actionText}> {item.action_label || 'ตกลง'}</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        );
                    })
                )}

                {/* Footer Note */}
                <Text style={styles.footerNote}>
                    คำแนะนำทั้งหมดมาจากข้อมูลจริงของร้านคุณ{'\n'}ไม่ได้คิดเอง ไม่ได้เดา
                </Text>
            </ScrollView>
        );
    };

    const renderHistoryTab = () => {
        const historyKeys = Object.keys(history);

        // Calculate totals
        let totalMoney = 0;
        let totalFollowed = 0;
        Object.values(history).forEach(items => {
            items.forEach(item => {
                if (item.status === 'accepted') {
                    totalFollowed++;
                    totalMoney += parseFloat(item.actual_amount) || 0;
                }
            });
        });

        return (
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* History Summary */}
                <View style={styles.historySummary}>
                    <View style={styles.historyStat}>
                        <Text style={styles.historyStatLabel}>เงินที่ได้เพิ่มเดือนนี้</Text>
                        <Text style={styles.historyStatValue}>{totalMoney.toLocaleString()} บาท</Text>
                    </View>
                    <View style={styles.historyStat}>
                        <Text style={styles.historyStatLabel}>ทำตามแล้ว</Text>
                        <Text style={styles.historyStatValueSmall}>{totalFollowed} คำแนะนำ</Text>
                    </View>
                </View>

                {loading ? (
                    <ActivityIndicator size="large" color="#F37021" style={{ marginTop: 30 }} />
                ) : historyKeys.length === 0 ? (
                    <View style={styles.emptyState}>
                        <MaterialCommunityIcons name="history" size={64} color="#ddd" />
                        <Text style={styles.emptyTitle}>ยังไม่มีประวัติ</Text>
                        <Text style={styles.emptySubtitle}>รายการที่คุณกด "ตกลง" หรือ "ข้าม" จะมาอยู่ที่นี่</Text>
                    </View>
                ) : (
                    historyKeys.map(dateLabel => (
                        <View key={dateLabel}>
                            <Text style={styles.dateLabel}>{dateLabel}</Text>
                            {history[dateLabel].map(item => {
                                const config = getTypeConfig(item.type);
                                return (
                                    <View key={item.id} style={styles.historyCard}>
                                        <View style={styles.historyLeft}>
                                            <View style={[styles.historyIcon, { backgroundColor: config.bg }]}>
                                                <Ionicons name={config.icon} size={20} color={config.color} />
                                            </View>
                                            <View style={styles.historyInfo}>
                                                <Text style={styles.historyTitle}>{item.title}</Text>
                                                <Text style={styles.historyTime}>{dateLabel}</Text>
                                                {item.expected_impact && (
                                                    <View style={styles.historyOutcome}>
                                                        <Text style={styles.outcomeLabel}>คาดการณ์: </Text>
                                                        <Text style={styles.outcomeValue}>{item.expected_impact}</Text>
                                                        {item.actual_amount > 0 && (
                                                            <>
                                                                <Text style={styles.outcomeArrow}> → </Text>
                                                                <Text style={styles.actualValue}>ได้จริง: {item.actual_amount} บาท</Text>
                                                            </>
                                                        )}
                                                    </View>
                                                )}
                                            </View>
                                        </View>
                                        <View style={[
                                            styles.statusBadge,
                                            { backgroundColor: item.status === 'accepted' ? '#E8F5E9' : '#F5F5F5' }
                                        ]}>
                                            <Text style={[
                                                styles.statusText,
                                                { color: item.status === 'accepted' ? '#43A047' : '#888' }
                                            ]}>
                                                {item.status === 'accepted' ? 'ทำแล้ว' : 'ข้ามไป'}
                                            </Text>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    ))
                )}
            </ScrollView>
        );
    };

    const renderChatTab = () => (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
        >
            <ScrollView
                ref={scrollViewRef}
                onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
                contentContainerStyle={{ flexGrow: 1, padding: 20, paddingBottom: 100 }}
            >
                {chatHistory.length === 0 ? (
                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 40 }}>
                        <View style={styles.aiAvatarLarge}>
                            <Octicons name="sparkle" size={40} color="#fff" />
                        </View>
                        <Text style={styles.chatTitle}>ถามอะไรก็ได้เกี่ยวกับร้าน</Text>
                        <Text style={styles.chatSubtitle}>AI จะตอบจากข้อมูลจริงของร้านคุณ</Text>

                        <View style={styles.chipContainer}>
                            {['สินค้าขายดีเดือนนี้', 'ควรสั่งสินค้าอะไร', 'ลูกหนี้ค้างมากสุด', 'สินค้าใกล้หมดอายุ'].map((text, i) => (
                                <TouchableOpacity key={i} style={styles.chatChip} onPress={() => setChatMessage(text)}>
                                    <MaterialCommunityIcons name={i === 0 ? 'chart-line' : i === 1 ? 'cube-outline' : i === 2 ? 'account-clock-outline' : 'calendar-alert'} size={18} color="#E65100" style={{ marginRight: 8 }} />
                                    <Text style={styles.chipText}>{text}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                ) : (
                    chatHistory.map((chat, index) => (
                        <View key={index} style={[styles.messageBubble, chat.role === 'user' ? styles.userBubble : styles.aiBubble]}>
                            <Text style={[styles.messageText, chat.role === 'user' ? styles.userMessageText : styles.aiMessageText]}>
                                {chat.parts[0].text}
                            </Text>
                        </View>
                    ))
                )}
                {chatLoading && (
                    <View style={[styles.messageBubble, styles.aiBubble]}>
                        <ActivityIndicator size="small" color="#F37021" />
                    </View>
                )}
            </ScrollView>

            <View style={styles.chatInputWrapper}>
                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.chatInput}
                        placeholder="พิมพ์คำถาม..."
                        placeholderTextColor="#999"
                        value={chatMessage}
                        onChangeText={setChatMessage}
                        multiline
                    />
                    <TouchableOpacity
                        style={[styles.sendBtn, !chatMessage.trim() && { backgroundColor: '#ccc' }]}
                        onPress={handleSendMessage}
                        disabled={!chatMessage.trim() || chatLoading}
                    >
                        <Ionicons name="send" size={18} color="#fff" />
                    </TouchableOpacity>
                </View>
            </View>
        </KeyboardAvoidingView>
    );

    return (
        <SafeAreaView style={styles.container}>

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
                {activeTab === 'history' && renderHistoryTab()}
                {activeTab === 'chat' && renderChatTab()}
            </View>

            {/* Product Action Modal */}
            <Modal
                visible={productModalVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setProductModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>จัดการสินค้า</Text>
                            <TouchableOpacity onPress={() => setProductModalVisible(false)}>
                                <Ionicons name="close" size={24} color="#666" />
                            </TouchableOpacity>
                        </View>

                        {selectedItem && (
                            <>
                                <ScrollView
                                    style={styles.modalScrollContent}
                                    showsVerticalScrollIndicator={false}
                                    bounces={false}
                                >
                                    <View style={styles.modalProductInfo}>
                                        <Ionicons name="cube-outline" size={32} color="#F37021" />
                                        <View style={{ marginLeft: 12, flex: 1 }}>
                                            <Text style={styles.modalProductName}>{selectedItem.title}</Text>
                                            <Text style={styles.modalProductDetail}>{selectedItem.detail}</Text>
                                        </View>
                                    </View>

                                    <Text style={styles.modalSectionTitle}>เลือกดำเนินการ:</Text>

                                    <TouchableOpacity
                                        style={[styles.modalOption, actionType === 'discount' && styles.modalOptionActive]}
                                        onPress={() => setActionType('discount')}
                                    >
                                        <View style={styles.radioOuter}>
                                            {actionType === 'discount' && <View style={styles.radioInner} />}
                                        </View>
                                        <Text style={styles.modalOptionText}>ลดราคา</Text>
                                    </TouchableOpacity>

                                    {actionType === 'discount' && (
                                        <View style={styles.discountSection}>
                                            {/* AI Recommendation Box */}
                                            {selectedItem?.payload?.recommended_discount && (
                                                <View style={styles.aiRecommendBox}>
                                                    <View style={styles.aiRecommendHeader}>
                                                        <Ionicons name="sparkles" size={18} color="#F37021" />
                                                        <Text style={styles.aiRecommendTitle}> AI แนะนำ</Text>
                                                    </View>
                                                    <Text style={styles.aiRecommendPercent}>
                                                        ลด {selectedItem.payload.recommended_discount.percent}%
                                                        {selectedItem.payload.recommended_discount.price_after_discount &&
                                                            ` (เหลือ ฿${selectedItem.payload.recommended_discount.price_after_discount})`
                                                        }
                                                    </Text>

                                                    {/* Profit/Loss Breakdown */}
                                                    {selectedItem.payload.recommended_discount.profit_per_unit != null && (
                                                        <View style={styles.profitBreakdown}>
                                                            <Text style={styles.profitBreakdownText}>
                                                                {selectedItem.payload.recommended_discount.profit_per_unit >= 0
                                                                    ? `✅ ได้กำไร ฿${selectedItem.payload.recommended_discount.profit_per_unit}/ชิ้น`
                                                                    : `⚠️ ขาดทุน ฿${Math.abs(selectedItem.payload.recommended_discount.profit_per_unit)}/ชิ้น`
                                                                }
                                                            </Text>
                                                            {selectedItem.payload.recommended_discount.total_recovery && (
                                                                <Text style={styles.profitBreakdownText}>
                                                                    💰 คืนทุนได้ ฿{selectedItem.payload.recommended_discount.total_recovery.toLocaleString()}
                                                                    {selectedItem.payload.recommended_discount.vs_total_loss &&
                                                                        ` (ถ้าไม่ขาย เสีย ฿${selectedItem.payload.recommended_discount.vs_total_loss.toLocaleString()})`
                                                                    }
                                                                </Text>
                                                            )}
                                                        </View>
                                                    )}

                                                    <Text style={styles.aiRecommendReason}>
                                                        {selectedItem.payload.recommended_discount.reason}
                                                    </Text>
                                                    <TouchableOpacity
                                                        style={styles.useAiRecommendBtn}
                                                        onPress={() => setDiscountPrice(
                                                            selectedItem.payload.recommended_discount.price_after_discount?.toString() ||
                                                            `${selectedItem.payload.recommended_discount.percent}%`
                                                        )}
                                                    >
                                                        <Ionicons name="checkmark-circle" size={18} color="#fff" />
                                                        <Text style={styles.useAiRecommendText}> ใช้ราคาที่ AI แนะนำ</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            )}

                                            <View style={styles.discountInputRow}>
                                                <TextInput
                                                    style={styles.discountInput}
                                                    placeholder="ราคาใหม่ (บาท)"
                                                    keyboardType="numeric"
                                                    value={discountPrice}
                                                    onChangeText={setDiscountPrice}
                                                />
                                                <TouchableOpacity style={styles.quickDiscount} onPress={() => setDiscountPrice('20%')}>
                                                    <Text style={styles.quickDiscountText}>-20%</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity style={styles.quickDiscount} onPress={() => setDiscountPrice('30%')}>
                                                    <Text style={styles.quickDiscountText}>-30%</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    )}

                                    <TouchableOpacity
                                        style={[styles.modalOption, actionType === 'dispose' && styles.modalOptionActive]}
                                        onPress={() => setActionType('dispose')}
                                    >
                                        <View style={styles.radioOuter}>
                                            {actionType === 'dispose' && <View style={styles.radioInner} />}
                                        </View>
                                        <Text style={styles.modalOptionText}>ตัดสต็อก/ทิ้ง (หมดอายุ)</Text>
                                    </TouchableOpacity>

                                </ScrollView>

                                <View style={styles.modalActions}>
                                    <TouchableOpacity
                                        style={styles.modalCancelBtn}
                                        onPress={() => setProductModalVisible(false)}
                                    >
                                        <Text style={styles.modalCancelText}>ยกเลิก</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.modalConfirmBtn}
                                        onPress={handleProductConfirm}
                                    >
                                        <Text style={styles.modalConfirmText}>ยืนยัน</Text>
                                    </TouchableOpacity>
                                </View>
                            </>
                        )}
                    </View>
                </View>
            </Modal>

            {/* Debt Call Modal */}
            <Modal
                visible={debtModalVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setDebtModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>เลือกลูกหนี้ที่จะโทร</Text>
                            <TouchableOpacity onPress={() => setDebtModalVisible(false)}>
                                <Ionicons name="close" size={24} color="#666" />
                            </TouchableOpacity>
                        </View>

                        {selectedItem && (
                            <>
                                <Text style={styles.modalSubtitle}>{selectedItem.detail}</Text>

                                {/* If we have customers in payload, show list */}
                                {selectedItem.payload?.customers ? (
                                    selectedItem.payload.customers.map((c, idx) => (
                                        <TouchableOpacity
                                            key={idx}
                                            style={styles.debtCustomerRow}
                                            onPress={() => handleDebtCall(c.phone)}
                                        >
                                            <View style={styles.debtCustomerInfo}>
                                                <Ionicons name="person-circle-outline" size={36} color="#888" />
                                                <View style={{ marginLeft: 12 }}>
                                                    <Text style={styles.debtCustomerName}>{c.name}</Text>
                                                    <Text style={styles.debtCustomerAmount}>฿{c.amount?.toLocaleString()}</Text>
                                                </View>
                                            </View>
                                            <TouchableOpacity
                                                style={styles.callBtn}
                                                onPress={() => handleDebtCall(c.phone)}
                                            >
                                                <Ionicons name="call" size={20} color="#fff" />
                                            </TouchableOpacity>
                                        </TouchableOpacity>
                                    ))
                                ) : (
                                    <View style={styles.noPhoneMessage}>
                                        <Ionicons name="alert-circle-outline" size={40} color="#aaa" />
                                        <Text style={styles.noPhoneText}>ไม่มีเบอร์โทรในระบบ</Text>
                                    </View>
                                )}

                                <TouchableOpacity
                                    style={styles.modalCloseBtn}
                                    onPress={() => setDebtModalVisible(false)}
                                >
                                    <Text style={styles.modalCloseText}>ปิด</Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </View>
            </Modal>
        </SafeAreaView >
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    mainHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 15,
    },
    headerIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#4CAF50',
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
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
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
        backgroundColor: '#FFF3E0',
        borderRadius: 20,
        padding: 20,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: '#FFE0B2',
    },
    summaryHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    summaryDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#4CAF50',
        marginRight: 8,
    },
    summaryLabel: {
        flex: 1,
        fontSize: 14,
        color: '#666',
        fontWeight: '500',
    },
    seeAllBtn: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    seeAllText: {
        fontSize: 12,
        color: '#888',
    },
    summaryMain: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    summaryAmount: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#E65100',
    },
    summaryUnit: {
        fontSize: 18,
        fontWeight: 'normal',
    },
    growthBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E8F5E9',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
        marginLeft: 10,
    },
    growthText: {
        fontSize: 12,
        color: '#4CAF50',
        fontWeight: '600',
        marginLeft: 2,
    },
    summarySubtitle: {
        fontSize: 12,
        color: '#888',
        marginTop: 4,
        marginBottom: 15,
    },
    progressSection: {
        marginBottom: 15,
    },
    progressBarContainer: {
        height: 8,
        backgroundColor: '#fff',
        borderRadius: 4,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#4CAF50',
        borderRadius: 4,
    },
    progressLabels: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 8,
    },
    progressLabelLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    progressText: {
        fontSize: 12,
        color: '#666',
    },
    progressPercent: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#4CAF50',
    },
    statsRow: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 20,
    },
    statItem: {
        flex: 1,
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
        backgroundColor: '#eee',
    },

    // Daily Card
    dailyCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 1,
    },
    dailyRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    dailyLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    dailyIconBg: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#E8F5E9',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    dailyInfo: {},
    dailyLabel: {
        fontSize: 12,
        color: '#888',
    },
    dailyAmount: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#4CAF50',
    },
    dailyRight: {
        alignItems: 'flex-end',
    },
    dailyRightLabel: {
        fontSize: 10,
        color: '#aaa',
    },
    dailyRightValue: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#333',
    },
    cheerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
    },
    cheerText: {
        fontSize: 12,
        color: '#4CAF50',
    },

    // Section Header
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    sectionTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#222',
    },
    countBadge: {
        backgroundColor: '#F5F5F5',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    countText: {
        fontSize: 11,
        color: '#666',
        fontWeight: '500',
    },

    // Recommendation Card
    recCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        marginBottom: 15,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 2,
    },
    recContent: {
        padding: 16,
    },
    recHeader: {
        flexDirection: 'row',
    },
    iconBox: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    recInfo: {
        flex: 1,
        marginLeft: 12,
    },
    tag: {
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
        marginBottom: 4,
    },
    tagText: {
        fontSize: 10,
        fontWeight: 'bold',
    },
    recTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#222',
        marginBottom: 2,
    },
    recDetail: {
        fontSize: 13,
        color: '#666',
        lineHeight: 18,
    },
    impactBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E8F5E9',
        borderRadius: 20,
        paddingVertical: 10,
        paddingHorizontal: 16,
        marginTop: 12,
    },
    impactText: {
        fontSize: 14,
        color: '#2E7D32',
        fontWeight: '600',
    },
    whyBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
    },
    whyText: {
        fontSize: 12,
        color: '#888',
        marginLeft: 4,
    },
    whyContent: {
        backgroundColor: '#F5F5F5',
        borderRadius: 8,
        padding: 12,
        marginTop: 8,
    },
    whyContentText: {
        fontSize: 12,
        color: '#666',
        lineHeight: 18,
    },
    actionFooter: {
        flexDirection: 'row',
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
        padding: 12,
        gap: 10,
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
        borderColor: '#E0E0E0',
    },
    skipText: {
        fontSize: 14,
        color: '#666',
        fontWeight: '600',
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
    footerNote: {
        textAlign: 'center',
        fontSize: 11,
        color: '#aaa',
        marginTop: 10,
        marginBottom: 20,
        lineHeight: 18,
    },

    // Empty State
    emptyState: {
        alignItems: 'center',
        paddingVertical: 40,
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
        marginTop: 15,
    },
    emptySubtitle: {
        fontSize: 13,
        color: '#888',
        marginTop: 5,
        textAlign: 'center',
    },

    // History Tab
    historySummary: {
        flexDirection: 'row',
        backgroundColor: '#E8F5E9',
        borderRadius: 16,
        padding: 16,
        marginBottom: 20,
    },
    historyStat: {
        flex: 1,
    },
    historyStatLabel: {
        fontSize: 12,
        color: '#666',
        marginBottom: 4,
    },
    historyStatValue: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#2E7D32',
    },
    historyStatValueSmall: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#2E7D32',
    },
    dateLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#888',
        marginBottom: 10,
        marginTop: 5,
    },
    historyCard: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 12,
        marginBottom: 10,
        alignItems: 'center',
    },
    historyLeft: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    historyIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    historyInfo: {
        flex: 1,
    },
    historyTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#222',
        marginBottom: 2,
    },
    historyTime: {
        fontSize: 11,
        color: '#aaa',
        marginBottom: 4,
    },
    historyOutcome: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
    },
    outcomeLabel: {
        fontSize: 11,
        color: '#888',
    },
    outcomeValue: {
        fontSize: 11,
        color: '#666',
    },
    outcomeArrow: {
        fontSize: 11,
        color: '#4CAF50',
    },
    actualValue: {
        fontSize: 11,
        color: '#4CAF50',
        fontWeight: '600',
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusText: {
        fontSize: 11,
        fontWeight: '600',
    },

    // Chat Tab
    aiAvatarLarge: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#4CAF50',
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
    messageBubble: {
        padding: 15,
        borderRadius: 20,
        marginBottom: 10,
        maxWidth: '85%',
    },
    userBubble: {
        alignSelf: 'flex-end',
        backgroundColor: '#F37021',
    },
    aiBubble: {
        alignSelf: 'flex-start',
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#eee',
    },
    messageText: {
        fontSize: 15,
        lineHeight: 22,
    },
    userMessageText: {
        color: '#fff',
    },
    aiMessageText: {
        color: '#333',
    },
    chatInputWrapper: {
        backgroundColor: '#fff',
        padding: 15,
        paddingBottom: Platform.OS === 'ios' ? 30 : 15,
        borderTopWidth: 1,
        borderTopColor: '#eee',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F0F0F0',
        borderRadius: 25,
        paddingHorizontal: 15,
    },
    chatInput: {
        flex: 1,
        paddingVertical: 10,
        fontSize: 15,
        color: '#333',
        maxHeight: 100,
    },
    sendBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F37021',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 10,
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingHorizontal: 20,
        paddingBottom: Platform.OS === 'ios' ? 25 : 15,
        paddingTop: 15,
        maxHeight: '85%',
        display: 'flex',
        flexDirection: 'column',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
    },
    modalSubtitle: {
        fontSize: 14,
        color: '#666',
        marginBottom: 20,
    },
    modalScrollContent: {
        maxHeight: '70%',
    },
    modalProductInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF8F0',
        padding: 15,
        borderRadius: 12,
        marginBottom: 20,
    },
    modalProductName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },
    modalProductDetail: {
        fontSize: 13,
        color: '#888',
        marginTop: 4,
    },
    modalSectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#666',
        marginBottom: 12,
    },
    modalOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 10,
        marginBottom: 10,
    },
    modalOptionActive: {
        borderColor: '#F37021',
        backgroundColor: '#FFF8F0',
    },
    modalOptionText: {
        fontSize: 15,
        color: '#333',
        marginLeft: 12,
    },
    radioOuter: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        borderColor: '#F37021',
        justifyContent: 'center',
        alignItems: 'center',
    },
    radioInner: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#F37021',
    },
    discountInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15,
        marginLeft: 34,
    },
    discountInput: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 10,
        fontSize: 15,
        marginRight: 10,
    },
    quickDiscount: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: '#E8F5E9',
        borderRadius: 6,
        marginLeft: 5,
    },
    quickDiscountText: {
        color: '#43A047',
        fontWeight: '600',
    },
    modalActions: {
        flexDirection: 'row',
        marginTop: 10,
        paddingTop: 15,
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
    },
    modalCancelBtn: {
        flex: 1,
        padding: 15,
        borderRadius: 10,
        backgroundColor: '#f0f0f0',
        alignItems: 'center',
        marginRight: 10,
    },
    modalCancelText: {
        fontSize: 16,
        color: '#666',
        fontWeight: '600',
    },
    modalConfirmBtn: {
        flex: 1,
        padding: 15,
        borderRadius: 10,
        backgroundColor: '#F37021',
        alignItems: 'center',
    },
    modalConfirmText: {
        fontSize: 16,
        color: '#fff',
        fontWeight: '600',
    },
    modalCloseBtn: {
        padding: 15,
        borderRadius: 10,
        backgroundColor: '#f0f0f0',
        alignItems: 'center',
        marginTop: 15,
    },
    modalCloseText: {
        fontSize: 16,
        color: '#666',
        fontWeight: '600',
    },
    debtCustomerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 15,
        backgroundColor: '#f9f9f9',
        borderRadius: 12,
        marginBottom: 10,
    },
    debtCustomerInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    debtCustomerName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#333',
    },
    debtCustomerAmount: {
        fontSize: 14,
        color: '#E65100',
        marginTop: 2,
    },
    callBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#4CAF50',
        justifyContent: 'center',
        alignItems: 'center',
    },
    noPhoneMessage: {
        alignItems: 'center',
        padding: 30,
    },
    noPhoneText: {
        fontSize: 14,
        color: '#888',
        marginTop: 10,
    },
    // AI Recommendation Box Styles
    discountSection: {
        marginBottom: 15,
        marginLeft: 34,
    },
    aiRecommendBox: {
        backgroundColor: '#FFF8F0',
        borderWidth: 1,
        borderColor: '#F37021',
        borderRadius: 12,
        padding: 15,
        marginBottom: 15,
    },
    aiRecommendHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    aiRecommendTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#F37021',
    },
    aiRecommendPercent: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 8,
    },
    aiRecommendReason: {
        fontSize: 13,
        color: '#666',
        lineHeight: 18,
        marginBottom: 12,
    },
    useAiRecommendBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F37021',
        borderRadius: 8,
        paddingVertical: 10,
    },
    useAiRecommendText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
    },
    profitBreakdown: {
        backgroundColor: '#E8F5E9',
        borderRadius: 8,
        padding: 10,
        marginBottom: 10,
    },
    profitBreakdownText: {
        fontSize: 13,
        color: '#2E7D32',
        marginBottom: 4,
    },
});