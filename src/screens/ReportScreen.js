import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Dimensions, ActivityIndicator } from 'react-native';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { LineChart } from 'react-native-chart-kit';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getSalesSummary, getSalesChartData, getPaymentMethodStats, getRecentOrders } from '../services/api';

const { width } = Dimensions.get('window');

const periods = [
    { id: 'today', label: 'วันนี้' },
    { id: 'week', label: 'สัปดาห์' },
    { id: 'month', label: 'เดือน' },
    // { id: 'year', label: 'ปี' },
];

export default function ReportScreen() {
    const insets = useSafeAreaInsets();
    const [period, setPeriod] = useState('today');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Data States
    const [summary, setSummary] = useState({ totalSales: 0, totalOrders: 0, growth: 0 });
    const [chartData, setChartData] = useState({ labels: [], values: [], peakTime: '-', peakAmount: 0 });
    const [paymentStats, setPaymentStats] = useState({ cash: {}, qr: {}, credit: {} });
    const [recentOrders, setRecentOrders] = useState([]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [sumRes, chartRes, payRes, recentRes] = await Promise.all([
                getSalesSummary(period),
                getSalesChartData(period),
                getPaymentMethodStats(period),
                getRecentOrders() // Always recent 10
            ]);

            if (sumRes.success) setSummary(sumRes.data);
            if (chartRes.success) setChartData(chartRes.data);
            if (payRes.success) setPaymentStats(payRes.data);
            if (recentRes.success) setRecentOrders(recentRes.data);
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

    const renderSummaryCard = () => (
        <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
                <Text style={styles.summaryLabel}>ยอดขาย{period === 'today' ? 'วันนี้' : period === 'week' ? 'สัปดาห์นี้' : 'เดือนนี้'}</Text>
                <View style={[styles.growthTag, { backgroundColor: summary.growth >= 0 ? 'rgba(76, 175, 80, 0.2)' : 'rgba(244, 67, 54, 0.2)' }]}>
                    <Ionicons name={summary.growth >= 0 ? "trending-up" : "trending-down"} size={14} color={summary.growth >= 0 ? "#4CAF50" : "#F44336"} />
                    <Text style={[styles.growthText, { color: summary.growth >= 0 ? "#4CAF50" : "#F44336" }]}>
                        {Math.abs(summary.growth)}%
                    </Text>
                </View>
            </View>

            <Text style={styles.totalSalesText}>฿{summary.totalSales?.toLocaleString()}</Text>

            <View style={styles.summaryFooter}>
                <View style={styles.orderCountBadge}>
                    <MaterialCommunityIcons name="cube-outline" size={18} color="#000" />
                </View>
                <View style={{ marginLeft: 10 }}>
                    <Text style={styles.orderCountText}>{summary.totalOrders}</Text>
                    <Text style={styles.orderLabelText}>คำสั่งซื้อ</Text>
                </View>
                {/* <TouchableOpacity style={styles.detailButton}>
                    <Text style={styles.detailButtonText}>ดูรายละเอียด</Text>
                    <Ionicons name="arrow-forward" size={14} color="#ccc" />
                </TouchableOpacity> */}
            </View>

            {/* Background Decoration */}
            <View style={styles.cardDecoration1} />
            <View style={styles.cardDecoration2} />
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
                            <View style={[styles.progressBarFill, { width: `${paymentStats.cash?.percent || 0}%`, backgroundColor: '#4CAF50' }]} />
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
                            <View style={[styles.progressBarFill, { width: `${paymentStats.qr?.percent || 0}%`, backgroundColor: '#2196F3' }]} />
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
                            <View style={[styles.progressBarFill, { width: `${paymentStats.credit?.percent || 0}%`, backgroundColor: '#FF9800' }]} />
                        </View>
                        <Text style={styles.paymentPercentCompact}>{paymentStats.credit?.percent || 0}%</Text>
                    </View>
                </View>
            </View>
        </View>
    );

    const renderChart = () => {
        // Prepare data for ChartKit
        const data = {
            labels: chartData.labels || [],
            datasets: [
                {
                    data: chartData.values.length > 0 ? chartData.values : [0],
                    color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`, // Green theme
                    strokeWidth: 3,
                }
            ],
            // legend: ["ยอดขาย"] 
        };

        return (
            <View style={styles.sectionContainer}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={styles.sectionTitle}>ช่วงเวลาขายดี</Text>
                    {/* <View style={styles.chartToggle}>
                        <Text style={styles.chartToggleText}>{period === 'today' ? 'วันนี้' : period === 'week' ? 'สัปดาห์' : 'เดือน'}</Text>
                    </View> */}
                </View>

                <View style={styles.chartContainer}>
                    <LineChart
                        data={data}
                        width={width - 40}
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
                                strokeDasharray: "", // solid lines
                                stroke: "#F3F4F6"
                            }
                        }}
                        bezier
                        style={{
                            marginVertical: 8,
                            borderRadius: 16
                        }}
                        withInnerLines={true}
                        withOuterLines={false}
                        withVerticalLines={false}
                    />

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
                <TouchableOpacity>
                    <Text style={styles.seeAllText}>ดูทั้งหมด <Ionicons name="arrow-forward" size={12} /></Text>
                </TouchableOpacity>
            </View>

            {recentOrders.map((order, index) => (
                <View key={order.id} style={styles.transactionRow}>
                    <View style={styles.transactionIcon}>
                        <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={styles.transactionName}>{order.customer}</Text>
                        <Text style={styles.transactionTime}>{order.time}</Text>
                    </View>
                    <Text style={styles.transactionAmount}>฿{order.amount.toLocaleString()}</Text>
                </View>
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

            <ScrollView
                contentContainerStyle={{ paddingBottom: 100 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                showsVerticalScrollIndicator={false}
            >
                {renderHeader()}
                {renderSummaryCard()}
                {renderPaymentBreakdown()}
                {renderChart()}
                {renderRecentOrders()}
            </ScrollView>
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
        padding: 24,
        marginBottom: 25,
        position: 'relative',
        overflow: 'hidden',
        minHeight: 180,
        borderWidth: 1, borderColor: '#F37021',
    },
    summaryHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    summaryLabel: {
        color: '#000',
        fontSize: 14,
        fontWeight: '500',
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
        color: '#000',
        fontSize: 42,
        fontWeight: 'bold',
        marginBottom: 20,
    },
    summaryFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 'auto',
    },
    orderCountBadge: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(0,0,0,0.15)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    orderCountText: {
        color: '#000',
        fontSize: 16,
        fontWeight: 'bold',
    },
    orderLabelText: {
        color: '#888',
        fontSize: 12,
    },
    detailButton: {
        marginLeft: 'auto',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    detailButtonText: {
        color: '#ccc',
        fontSize: 12,
    },
    cardDecoration1: {
        position: 'absolute',
        top: -20,
        right: -20,
        width: 150,
        height: 150,
        borderRadius: 75,
        backgroundColor: 'rgba(243,112,33,0.03)',
    },
    cardDecoration2: {
        position: 'absolute',
        bottom: -40,
        left: -40,
        width: 200,
        height: 200,
        borderRadius: 100,
        backgroundColor: 'rgba(243,112,33,0.02)',
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
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 2
    },
    chartSummaryFooter: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        marginTop: 15,
        paddingTop: 15,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
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
        fontSize: 12,
        color: '#10B981',
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
});
