import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Dimensions, ActivityIndicator, Alert } from 'react-native';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { LineChart } from 'react-native-chart-kit';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { getSalesSummary, getSalesChartData, getPaymentMethodStats, getOrders, getOrderDetails, getRecommendationStats, getAIRecommendations, cancelOrder } from '../services/api';
import ReceiptModal from '../components/payment/ReceiptModal';
import { useBluetooth } from '../contexts/BluetoothContext';

const { width } = Dimensions.get('window');

const periods = [
    { id: 'today', label: 'วันนี้' },
    { id: 'week', label: 'สัปดาห์' },
    { id: 'month', label: 'เดือน' },
    // { id: 'year', label: 'ปี' },
];

export default function ReportScreen() {
    const insets = useSafeAreaInsets();
    const navigation = useNavigation();
    const { printReceipt } = useBluetooth();
    const [period, setPeriod] = useState('today');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Data States
    const [summary, setSummary] = useState({ totalSales: 0, totalOrders: 0, growth: 0 });
    const [chartData, setChartData] = useState({ labels: [], values: [], peakTime: '-', peakAmount: 0 });
    const [paymentStats, setPaymentStats] = useState({ cash: {}, qr: {}, credit: {} });
    const [recentOrders, setRecentOrders] = useState([]);
    const [aiStats, setAiStats] = useState(null);
    const [aiRecommendations, setAiRecommendations] = useState([]);
    const [loadingReceipt, setLoadingReceipt] = useState(false);

    // Modal State
    const [receiptVisible, setReceiptVisible] = useState(false);
    const [selectedTransaction, setSelectedTransaction] = useState(null);
    const [selectedOrderId, setSelectedOrderId] = useState(null);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [sumRes, chartRes, payRes, recentRes, aiStatsRes, aiRecsRes] = await Promise.all([
                getSalesSummary(period),
                getSalesChartData(period),
                getPaymentMethodStats(period),
                getOrders({ limit: 3 }), // Recent 3 orders
                getRecommendationStats(period),
                getAIRecommendations(0, 0, period)
            ]);

            if (sumRes.success) setSummary(sumRes.data);
            if (chartRes.success) setChartData(chartRes.data);
            if (payRes.success) setPaymentStats(payRes.data);
            if (recentRes.success) setRecentOrders(recentRes.data);
            if (aiStatsRes.success) setAiStats(aiStatsRes.data);
            if (aiRecsRes.success) setAiRecommendations(aiRecsRes.data?.slice(0, 3) || []);
        } catch (error) {
            console.error('Fetch Report Error:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchData();
        }, [period])
    );

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    const handleTransactionPress = async (order) => {
        try {
            setLoadingReceipt(true);
            const res = await getOrderDetails(order.id);
            if (res.success) {
                setSelectedTransaction(res.data);
                setSelectedOrderId(order.id);
                setReceiptVisible(true);
            } else {
                Alert.alert('ข้อผิดพลาด', 'ไม่สามารถโหลดข้อมูลบิลได้');
            }
        } catch (error) {
            Alert.alert('ข้อผิดพลาด', 'เกิดข้อผิดพลาดในการโหลดข้อมูล');
        } finally {
            setLoadingReceipt(false);
        }
    };

    const handleCancelOrder = async () => {
        try {
            await cancelOrder(selectedOrderId);
            setReceiptVisible(false);
            fetchData();
        } catch (error) {
            Alert.alert('ข้อผิดพลาด', 'ไม่สามารถยกเลิกบิลได้ กรุณาลองใหม่');
        }
    };

    const renderHeader = () => (
        <View style={styles.header}>
            <View style={styles.periodSelector}>
                {periods.map((p) => (
                    <TouchableOpacity
                        key={p.id}
                        style={[styles.periodButton, period === p.id && styles.activePeriodButton]}
                        onPress={() => setPeriod(p.id)}
                    >
                        <Text style={[styles.periodText, period === p.id && styles.activePeriodText]}>
                            {p.icon && <Ionicons name={p.icon} size={14} color={period === p.id ? '#000' : '#666'} style={{ marginRight: 4 }} />}
                            {p.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );

    // TC2: label เปรียบเทียบช่วงไหน
    const comparisonLabel = period === 'today' ? 'vs เมื่อวาน' : period === 'week' ? 'vs สัปดาห์ก่อน' : 'vs เดือนก่อน';

    // TC3: handle div-by-zero (growth = Infinity / NaN / null)
    const isGrowthValid = summary.growth !== null && isFinite(summary.growth);
    const growthIsPositive = isGrowthValid && summary.growth >= 0;

    const renderSummaryCard = () => (
        <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
                <Text style={styles.summaryLabel}>ยอดขาย{period === 'today' ? 'วันนี้' : period === 'week' ? 'สัปดาห์นี้' : 'เดือนนี้'}</Text>
                {/* TC2: แสดง label ช่วงที่เปรียบเทียบ + TC3: guard Infinity/NaN */}
                <View style={[styles.growthTag, { backgroundColor: !isGrowthValid ? '#F5F5F5' : growthIsPositive ? '#E8F5E9' : '#FFEBEE' }]}>
                    {isGrowthValid && (
                        <Ionicons name={growthIsPositive ? "trending-up" : "trending-down"} size={14} color={growthIsPositive ? "#10B981" : "#EF4444"} />
                    )}
                    <Text style={[styles.growthText, { color: !isGrowthValid ? '#999' : growthIsPositive ? "#10B981" : "#EF4444" }]}>
                        {!isGrowthValid ? 'N/A' : `${Math.abs(summary.growth)}%`}
                    </Text>
                </View>
            </View>
            {/* TC2: บอกว่าเปรียบเทียบกับช่วงไหน */}
            <Text style={styles.comparisonLabel}>{comparisonLabel}</Text>

            <Text style={styles.totalSalesText}>฿{summary.totalSales?.toLocaleString() ?? 0}</Text>

            <View style={styles.summaryFooter}>
                <View style={[styles.orderCountBadge, { backgroundColor: '#FFF3E0' }]}>
                    <MaterialCommunityIcons name="cube-outline" size={16} color="#F37021" />
                </View>
                <Text style={styles.orderCountText}>{summary.totalOrders} <Text style={styles.orderLabelText}>คำสั่งซื้อ</Text></Text>
            </View>
        </View>
    );

    const renderPaymentBreakdown = () => (
        <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>แยกตามช่องทางชำระเงิน</Text>
            <View style={styles.paymentGrid}>
                {/* Cash */}
                <View style={styles.paymentCardCompact}>
                    <View style={styles.paymentHeader}>
                        <View style={[styles.paymentIconCompact, { backgroundColor: '#E8F5E9' }]}>
                            <MaterialCommunityIcons name="cash" size={16} color="#4CAF50" />
                        </View>
                        <Text style={styles.paymentMethodTitleCompact}>เงินสด</Text>
                    </View>

                    <Text style={styles.paymentAmountCompact}>฿{paymentStats.cash?.amount?.toLocaleString() || 0}</Text>

                    <View style={styles.paymentFooter}>
                        <View style={styles.progressBarBg}>
                            {/* TC4: cap ที่ 100% เพื่อกัน overflow */}
                            <View style={[styles.progressBarFill, { width: `${Math.min(100, paymentStats.cash?.percent || 0)}%`, backgroundColor: '#4CAF50' }]} />
                        </View>
                        <Text style={styles.paymentPercentCompact}>{paymentStats.cash?.percent || 0}%</Text>
                    </View>
                </View>

                {/* Transfer/QR */}
                <View style={styles.paymentCardCompact}>
                    <View style={styles.paymentHeader}>
                        <View style={[styles.paymentIconCompact, { backgroundColor: '#E3F2FD' }]}>
                            <MaterialCommunityIcons name="cellphone" size={16} color="#2196F3" />
                        </View>
                        <Text style={styles.paymentMethodTitleCompact}>โอนเงิน</Text>
                    </View>

                    <Text style={styles.paymentAmountCompact}>฿{paymentStats.qr?.amount?.toLocaleString() || 0}</Text>

                    <View style={styles.paymentFooter}>
                        <View style={styles.progressBarBg}>
                            <View style={[styles.progressBarFill, { width: `${Math.min(100, paymentStats.qr?.percent || 0)}%`, backgroundColor: '#2196F3' }]} />
                        </View>
                        <Text style={styles.paymentPercentCompact}>{paymentStats.qr?.percent || 0}%</Text>
                    </View>
                </View>

                {/* Credit */}
                <View style={styles.paymentCardCompact}>
                    <View style={styles.paymentHeader}>
                        <View style={[styles.paymentIconCompact, { backgroundColor: '#FFF3E0' }]}>
                            <MaterialCommunityIcons name="credit-card-outline" size={16} color="#FF9800" />
                        </View>
                        <Text style={styles.paymentMethodTitleCompact}>เครดิต</Text>
                    </View>

                    <Text style={styles.paymentAmountCompact}>฿{paymentStats.credit?.amount?.toLocaleString() || 0}</Text>

                    <View style={styles.paymentFooter}>
                        <View style={styles.progressBarBg}>
                            <View style={[styles.progressBarFill, { width: `${Math.min(100, paymentStats.credit?.percent || 0)}%`, backgroundColor: '#FF9800' }]} />
                        </View>
                        <Text style={styles.paymentPercentCompact}>{paymentStats.credit?.percent || 0}%</Text>
                    </View>
                </View>
            </View>
        </View>
    );

    const renderChart = () => {
        // ใช้ข้อมูลจาก API โดยตรง — backend จัดการ labels/values ตามข้อมูลจริงแล้ว
        const labels = chartData.labels || [];
        const values = chartData.values || [];
        const hasData = labels.length > 0 && values.some(v => v > 0);

        // Prepare data for ChartKit (ต้องมีอย่างน้อย 1 point ไม่งั้น crash)
        const safeValues = values.length > 0 ? values : [0];
        const safeLabels = labels.length > 0 ? labels : ['-'];
        const data = {
            labels: safeLabels,
            datasets: [
                {
                    data: safeValues,
                    color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
                    strokeWidth: 3,
                }
            ],
        };

        return (
            <View style={styles.sectionContainer}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={styles.sectionTitle}>ช่วงเวลาขายดี</Text>
                </View>

                <View style={styles.chartContainer}>
                    {!hasData && (
                        <View style={{ height: 220, justifyContent: 'center', alignItems: 'center' }}>
                            <Text style={{ color: '#bbb', fontSize: 14 }}>ยังไม่มียอดขาย{period === 'today' ? 'วันนี้' : period === 'week' ? 'สัปดาห์นี้' : 'เดือนนี้'}</Text>
                        </View>
                    )}
                    {hasData && <LineChart
                        data={data}
                        width={width - 80}
                        height={220}
                        yAxisLabel=""
                        yAxisSuffix=""
                        yAxisInterval={1}
                        chartConfig={{
                            backgroundColor: "#ffffff",
                            backgroundGradientFrom: "#ffffff",
                            backgroundGradientTo: "#ffffff",
                            decimalPlaces: 0,
                            color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
                            labelColor: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`,
                            style: {
                                borderRadius: 16
                            },
                            propsForDots: {
                                r: "4",
                                strokeWidth: "2",
                                stroke: "#fff"
                            },
                            propsForBackgroundLines: {
                                strokeDasharray: "",
                                stroke: "#F3F4F6"
                            }
                        }}
                        bezier
                        fromZero={true}
                        style={{
                            marginVertical: 8,
                            borderRadius: 16
                        }}
                        withInnerLines={true}
                        withOuterLines={false}
                        withVerticalLines={false}
                        withShadow={true}
                    />}

                    <View style={styles.chartSummaryFooter}>
                        <View>
                            <Text style={styles.chartFooterLabel}>ช่วงเวลาขายดีที่สุด</Text>
                            <Text style={styles.chartFooterValue}>{chartData.peakTime}</Text>
                        </View>
                        <View style={styles.dividerVertical} />
                        <View>
                            <Text style={styles.chartFooterLabel}>ยอดสูงสุด</Text>
                            <Text style={styles.chartFooterValue}>฿{chartData.peakAmount?.toLocaleString()}</Text>
                        </View>
                    </View>
                </View>
            </View>
        );
    };

    const renderRecentOrders = () => (
        <View style={styles.sectionContainer}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                <Text style={styles.sectionTitle}>รายการล่าสุด</Text>
                <TouchableOpacity onPress={() => navigation.navigate('AllTransactions')}>
                    <Text style={styles.seeAllText}>ดูทั้งหมด <Ionicons name="arrow-forward" size={12} /></Text>
                </TouchableOpacity>
            </View>

            {recentOrders.map((order, index) => (
                <TouchableOpacity key={order.id} style={styles.transactionRow} onPress={() => handleTransactionPress(order)}>
                    <View style={styles.transactionIcon}>
                        <Ionicons
                            name={order.paymentStatus === 'paid' ? 'checkmark-circle' : order.paymentStatus === 'cancelled' ? 'close-circle': 'time'}
                            size={24}
                            color={order.paymentStatus === 'paid' ? '#4CAF50' : order.paymentStatus === 'cancelled' ? '#E53935' : '#FF9800'}
                        />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={styles.transactionName}>{order.customer}</Text>
                        <Text style={styles.transactionTime}>{order.time}</Text>
                    </View>
                    <Text style={styles.transactionAmount}>฿{order.amount.toLocaleString()}</Text>
                </TouchableOpacity>
            ))}

            {recentOrders.length === 0 && (
                <Text style={{ textAlign: 'center', color: '#999', marginVertical: 20 }}>ไม่มีรายการ</Text>
            )}
        </View>
    );

    return (
        <View style={styles.container}>
            {/* Header Title Space */}
            <View style={{ paddingBottom: 10, paddingHorizontal: 20, backgroundColor: '#FAFAFA' }}>

            </View>
            {renderHeader()}
            {loading && !refreshing ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color="#F37021" />
                    <Text style={{ marginTop: 10, color: '#888' }}>กำลังโหลดข้อมูล...</Text>
                </View>
            ) : (

                <ScrollView
                    contentContainerStyle={{ paddingBottom: 100 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                    showsVerticalScrollIndicator={false}
                >

                    {renderSummaryCard()}


                    {/* AI Weekly Summary */}
                    {aiStats && (
                        <>
                            <View style={styles.newAiCardContainer}>
                                {/* Top Orange */}
                                <View style={styles.newAiCardTop}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <MaterialCommunityIcons name="star-four-points-outline" size={18} color="#fff" />
                                        <Text style={styles.aiSummaryLabelWhite}> สรุปยอดจาก AI {period === 'today' ? 'วันนี้' : period === 'week' ? 'สัปดาห์นี้' : 'เดือนนี้'}</Text>
                                    </View>
                                </View>

                                {/* Bottom White */}
                                <View style={styles.newAiCardBottom}>
                                    <Text style={styles.aiSummarySubtitleGray}>เงินที่ได้เพิ่มจากการทำตาม AI</Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
                                        <Text style={styles.aiSummaryAmountOrange}>
                                            {(aiStats.moneyEarned || 0).toLocaleString()} <Text style={styles.aiSummaryUnitOrange}>บาท</Text>
                                        </Text>
                                    </View>

                                    {/* Three Sub-cards */}
                                    <View style={styles.aiStatsGrid}>
                                        <View style={[styles.aiStatBox, { backgroundColor: '#FFFDF9', borderColor: '#FDF1DF', borderWidth: 1 }]}>
                                            <View style={[styles.aiStatIconWrap, { backgroundColor: 'transparent' }]}>
                                                <MaterialCommunityIcons name="shield-outline" size={20} color="#F37021" />
                                            </View>
                                            <Text style={styles.aiStatBoxValue}>{aiStats.byType?.expiry || 0}</Text>
                                            <Text style={styles.aiStatBoxLabel}>ลดของเสีย</Text>
                                        </View>
                                        <View style={[styles.aiStatBox, { backgroundColor: '#F9FFF9', borderColor: '#E8F5E9', borderWidth: 1 }]}>
                                            <View style={[styles.aiStatIconWrap, { backgroundColor: 'transparent' }]}>
                                                <MaterialCommunityIcons name="wallet-outline" size={20} color="#4CAF50" />
                                            </View>
                                            <Text style={styles.aiStatBoxValue}>{aiStats.byType?.debt || 0}</Text>
                                            <Text style={styles.aiStatBoxLabel}>เก็บหนี้ได้</Text>
                                        </View>
                                        <View style={[styles.aiStatBox, { backgroundColor: '#F9FCFF', borderColor: '#E3F2FD', borderWidth: 1 }]}>
                                            <View style={[styles.aiStatIconWrap, { backgroundColor: 'transparent' }]}>
                                                <MaterialCommunityIcons name="cube-outline" size={20} color="#2196F3" />
                                            </View>
                                            <Text style={styles.aiStatBoxValue}>{aiStats.byType?.stock || 0}</Text>
                                            <Text style={styles.aiStatBoxLabel}>สต็อกไม่ขาด</Text>
                                        </View>
                                    </View>
                                </View>
                            </View>

                            {/* Recommendations Part */}
                            {aiRecommendations.length > 0 && (
                                <View style={styles.aiRecommendationsCard}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15 }}>
                                        <MaterialCommunityIcons name="lightbulb-outline" size={20} color="#F37021" />
                                        <Text style={styles.sectionTitleAiRec}> คำแนะนำจาก AI</Text>
                                    </View>
                                    {aiRecommendations.map((rec, index) => (
                                        <View key={rec.id} style={styles.aiRecItem}>
                                            <View style={styles.aiRecNumberWrap}>
                                                <Text style={styles.aiRecNumberText}>{index + 1}</Text>
                                            </View>
                                            <Text style={styles.aiRecText}>{rec.title || rec.message}</Text>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </>
                    )}

                    {renderPaymentBreakdown()}
                    {renderChart()}
                    {renderRecentOrders()}
                </ScrollView>
            )}


            {loadingReceipt && (
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center', zIndex: 999 }}>
                    <View style={{ backgroundColor: '#fff', padding: 30, borderRadius: 16, alignItems: 'center' }}>
                        <ActivityIndicator size="large" color="#F37021" />
                        <Text style={{ marginTop: 10, color: '#666' }}>กำลังโหลดบิล...</Text>
                    </View>
                </View>
            )}

            <ReceiptModal
                visible={receiptVisible}
                transaction={selectedTransaction}
                onClose={() => setReceiptVisible(false)}
                onPrint={async () => {
                    try {
                        await printReceipt(selectedTransaction);
                        Alert.alert('สำเร็จ', 'พิมพ์ใบเสร็จเรียบร้อยแล้ว');
                    } catch (error) {
                        Alert.alert('ผิดพลาด', error.message);
                    }
                }}
                onNewTransaction={() => setReceiptVisible(false)}
                onCancelOrder={handleCancelOrder}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FAFAFA',
    },
    // Header
    header: {
        paddingHorizontal: 20,
        marginBottom: 20,
    },
    periodSelector: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        borderRadius: 25,
        padding: 4,
        borderWidth: 1,
        borderColor: '#eee',
    },
    periodButton: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 20,
        flexDirection: 'row',
        justifyContent: 'center',
    },
    activePeriodButton: {
        backgroundColor: '#F37021',
    },
    periodText: {
        fontSize: 14,
        color: '#666',
        fontWeight: '500',
    },
    activePeriodText: {
        color: '#fff',
        fontWeight: 'bold',
    },

    // Summary Card
    summaryCard: {
        backgroundColor: '#fff',
        marginHorizontal: 20,
        borderRadius: 20,
        padding: 20,
        marginBottom: 25,
        borderWidth: 1,
        borderColor: '#eee',
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 2,
    },
    summaryHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    summaryLabel: {
        color: '#666',
        fontSize: 14,
        fontWeight: '500',
    },
    comparisonLabel: {
        fontSize: 11,
        color: '#aaa',
        marginBottom: 6,
        marginTop: -6,
    },
    growthTag: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
    },
    growthText: {
        fontSize: 12,
        fontWeight: 'bold',
    },
    totalSalesText: {
        color: '#111',
        fontSize: 38,
        fontWeight: '900',
        marginBottom: 20,
    },
    summaryFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 10,
    },
    orderCountBadge: {
        width: 28,
        height: 28,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
    },
    orderCountText: {
        color: '#111',
        fontSize: 14,
        fontWeight: 'bold',
    },
    orderLabelText: {
        color: '#666',
        fontWeight: 'normal',
    },

    // Section
    sectionContainer: {
        marginBottom: 25,
        paddingHorizontal: 20,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#111',
        marginBottom: 15,
    },

    // Payment Grid Stats
    paymentGrid: {
        flexDirection: 'row',
        gap: 12,
    },
    paymentCardCompact: {
        flex: 1,
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 12,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2,
    },
    paymentHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    paymentIconCompact: {
        width: 28,
        height: 28,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
    },
    paymentMethodTitleCompact: {
        fontSize: 12,
        color: '#666',
        fontWeight: '500',
    },
    paymentAmountCompact: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#111',
        marginBottom: 8,
    },
    paymentFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    progressBarBg: {
        flex: 1,
        height: 6,
        backgroundColor: '#F3F4F6',
        borderRadius: 3,
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 3,
    },
    paymentPercentCompact: {
        fontSize: 11,
        color: '#999',
        fontWeight: '600',
        minWidth: 28,
        textAlign: 'right',
    },

    // Chart
    chartContainer: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 15,
        paddingBottom: 20,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 2,
        borderWidth: 1, borderColor: '#eee',
    },
    chartSummaryFooter: {
        display: 'none', // As per the newest mockup, hiding the footer
    },
    dividerVertical: {
        width: 1,
        height: 30,
        backgroundColor: '#F3F4F6',
    },
    chartFooterLabel: {
        fontSize: 12,
        color: '#999',
        textAlign: 'center',
        marginBottom: 4,
    },
    chartFooterValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#111',
        textAlign: 'center',
    },

    // Recent Transactions
    seeAllText: {
        fontSize: 14,
        color: '#F37021',
        fontWeight: '600',
    },
    transactionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 15,
        marginBottom: 10,
    },
    transactionIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#ECFDF5', // Green light
        justifyContent: 'center',
        alignItems: 'center',
    },
    transactionName: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#111',
    },
    transactionTime: {
        fontSize: 12,
        color: '#888',
    },
    transactionAmount: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#111',
    },

    // AI Summary Card & Layout
    newAiCardContainer: {
        marginHorizontal: 20,
        marginBottom: 15,
        borderRadius: 20,
        shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 3,
        overflow: 'hidden',
    },
    newAiCardTop: {
        backgroundColor: '#F37021',
        paddingHorizontal: 20,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    aiSummaryLabelWhite: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
    aiBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.25)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 16,
        gap: 4,
    },
    aiBadgeText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
    },
    newAiCardBottom: {
        backgroundColor: '#fff',
        padding: 20,
    },
    aiSummarySubtitleGray: {
        fontSize: 13,
        color: '#888',
        marginBottom: 8,
    },
    aiSummaryAmountOrange: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#F37021',
    },
    aiSummaryUnitOrange: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    aiSummaryPercentOrange: {
        color: '#F37021',
        fontSize: 18,
        fontWeight: '900',
    },
    aiProgressBarContainer: {
        height: 8,
        backgroundColor: '#F3F4F6',
        borderRadius: 4,
        marginTop: 10,
        marginBottom: 20,
    },
    aiProgressFill: {
        height: '100%',
        backgroundColor: '#4CAF50',
        borderRadius: 4,
    },
    aiStatsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
    },
    aiStatBox: {
        flex: 1,
        borderRadius: 12,
        padding: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    aiStatIconWrap: {
        marginBottom: 6,
    },
    aiStatBoxValue: {
        fontSize: 16,
        fontWeight: '900',
        color: '#111',
    },
    aiStatBoxLabel: {
        fontSize: 10,
        color: '#666',
        marginTop: 2,
    },

    // Recommendations Section
    aiRecommendationsCard: {
        marginHorizontal: 20,
        marginBottom: 25,
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 20,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 2,
        borderWidth: 1, borderColor: '#eee',
    },
    sectionTitleAiRec: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#111',
    },
    aiRecItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
        borderRadius: 16,
        padding: 12,
        marginBottom: 10,
    },
    aiRecNumberWrap: {
        width: 24, height: 24,
        borderRadius: 12,
        backgroundColor: '#FFE0B2',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    aiRecNumberText: {
        color: '#F37021',
        fontSize: 12,
        fontWeight: 'bold',
    },
    aiRecText: {
        flex: 1,
        fontSize: 13,
        color: '#444',
        lineHeight: 20,
    }
});
