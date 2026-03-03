import { useState, useEffect } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    FlatList,
    StyleSheet,
    StatusBar,
    ActivityIndicator,
    Dimensions,
    Image,
    Switch,
    Alert
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../services/supabase";
import AddBranchModal from "../components/AddBranchModal";

const THEME = '#F37021';
const { width } = Dimensions.get('window');

export default function BranchListScreen({ userProfile, onSelectBranch, onLogout }) {
    const [branches, setBranches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);

    useEffect(() => {
        fetchBranches();
    }, []);

    const fetchBranches = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('stores')
                .select('*')
                .eq('owner_id', user.id)
                .order('created_at', { ascending: true });

            if (error) throw error;
            setBranches(data || []);
        } catch (error) {
            console.error('Failed to fetch branches:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleBranchCreated = () => {
        setModalVisible(false);
        fetchBranches();
    };

    const toggleStoreActive = async (storeId, currentValue) => {
        const newValue = !currentValue;
        const action = newValue ? 'เปิด' : 'ปิด';
        Alert.alert(
            `${action}ให้บริการ`,
            `ต้องการ${action}สาขานี้ใช่หรือไม่?`,
            [
                { text: 'ยกเลิก', style: 'cancel' },
                {
                    text: 'ยืนยัน',
                    onPress: async () => {
                        try {
                            const { error } = await supabase
                                .from('stores')
                                .update({ is_active: newValue })
                                .eq('id', storeId);
                            if (error) throw error;
                            setBranches(prev =>
                                prev.map(b => b.id === storeId ? { ...b, is_active: newValue } : b)
                            );
                        } catch (error) {
                            Alert.alert('ผิดพลาด', 'ไม่สามารถเปลี่ยนสถานะได้');
                        }
                    }
                }
            ]
        );
    };

    const getCurrentDate = () => {
        const options = { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' };
        const date = new Date();
        return date.toLocaleDateString('th-TH', options);
    };

    const renderBranchItem = ({ item, index }) => {
        const isOpen = item.is_active;
        return (
            <View style={[styles.branchCard, { borderLeftWidth: 4, borderLeftColor: isOpen ? THEME : '#ccc' }]}>
                <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center' }}
                    onPress={() => onSelectBranch && onSelectBranch(item)}
                    activeOpacity={0.7}
                >
                    <View style={[styles.branchIconWrap, { backgroundColor: `rgba(243,112,33,${0.10 + (index % 3) * 0.05})`, overflow: 'hidden' }]}>
                        {item.image_url ? (
                            <Image source={{ uri: item.image_url }} style={{ width: '100%', height: '100%' }} />
                        ) : (
                            <Ionicons name="storefront" size={22} color={THEME} />
                        )}
                    </View>
                    <View style={styles.branchInfo}>
                        <Text style={styles.branchName} numberOfLines={1}>{item.name}</Text>
                        {item.address ? (
                            <View style={styles.addressRow}>
                                <Ionicons name="location-outline" size={13} color="#999" />
                                <Text style={styles.branchAddress} numberOfLines={1}>{item.address}</Text>
                            </View>
                        ) : null}
                    </View>
                    <View style={styles.chevronWrap}>
                        <Ionicons name="chevron-forward" size={20} color="#ccc" />
                    </View>
                </TouchableOpacity>
                <View style={styles.statusRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: isOpen ? '#4CAF50' : '#999', marginRight: 6 }} />
                        <Text style={{ fontSize: 13, color: isOpen ? '#4CAF50' : '#999', fontWeight: '500' }}>
                            {isOpen ? 'เปิดให้บริการ' : 'ปิดให้บริการ'}
                        </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={{ fontSize: 13, color: '#999', marginRight: 8 }}>{isOpen ? 'เปิด' : 'ปิด'}</Text>
                        <Switch
                            value={isOpen}
                            onValueChange={() => toggleStoreActive(item.id, isOpen)}
                            trackColor={{ false: '#ddd', true: '#4CAF50' }}
                            thumbColor="#fff"
                        />
                    </View>
                </View>
            </View>
        );
    };


    if (loading) {
        return (
            <SafeAreaView style={styles.loadingContainer}>
                <StatusBar barStyle="dark-content" backgroundColor="#fff" />
                <ActivityIndicator size="large" color={THEME} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="light-content" backgroundColor={THEME} />

            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerContent}>
                    <View style={styles.headerLeft}>
                        <View style={styles.avatarWrap}>
                            <Ionicons name="person" size={20} color={THEME} />
                        </View>
                        <View style={styles.headerText}>
                            <Text style={styles.greeting} numberOfLines={1}>
                                {userProfile?.full_name || 'เจ้าของร้าน'}
                            </Text>
                            <Text style={styles.dateText}>{getCurrentDate()}</Text>
                        </View>
                    </View>
                    <TouchableOpacity onPress={onLogout} style={styles.logoutBtn} activeOpacity={0.7}>
                        <Ionicons name="log-out-outline" size={22} color="rgba(255,255,255,0.85)" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Content */}
            <View style={styles.content}>
                {/* Section Header */}
                <View style={styles.sectionHeader}>
                    <View>
                        <Text style={styles.sectionTitle}>สาขาของฉัน</Text>
                        <Text style={styles.sectionSubtitle}>{branches.length} สาขา</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#4CAF50', marginRight: 4 }} />
                            <Text style={{ fontSize: 13, color: '#666' }}>เปิด {branches.filter(b => b.is_active).length}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#999', marginRight: 4 }} />
                            <Text style={{ fontSize: 13, color: '#666' }}>ปิด {branches.filter(b => !b.is_active).length}</Text>
                        </View>
                    </View>
                </View>

                {branches.length === 0 ? (
                    <View style={styles.emptyState}>
                        <View style={styles.emptyIconWrap}>
                            <Ionicons name="storefront-outline" size={48} color={THEME} />
                        </View>
                        <Text style={styles.emptyText}>ยังไม่มีสาขา</Text>
                        <Text style={styles.emptySubtext}>เริ่มต้นเพิ่มสาขาแรกของคุณ</Text>
                        <TouchableOpacity
                            style={styles.emptyAddBtn}
                            onPress={() => setModalVisible(true)}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="add" size={20} color="#fff" />
                            <Text style={styles.emptyAddBtnText}>เพิ่มสาขาใหม่</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <FlatList
                        data={branches}
                        keyExtractor={(item) => item.id}
                        renderItem={renderBranchItem}
                        contentContainerStyle={styles.list}
                        showsVerticalScrollIndicator={false}
                    />
                )}
            </View>

            {/* Floating Add Button */}
            {branches.length > 0 && (
                <TouchableOpacity
                    style={styles.fab}
                    onPress={() => setModalVisible(true)}
                    activeOpacity={0.85}
                >
                    <Ionicons name="add" size={28} color="#fff" />
                </TouchableOpacity>
            )}

            {/* Add Branch Modal */}
            <AddBranchModal
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
                onSuccess={handleBranchCreated}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
    },
    container: {
        flex: 1,
        backgroundColor: THEME,
    },
    // ── Header ──
    header: {
        backgroundColor: THEME,
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 24,
    },
    headerContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    avatarWrap: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: 'rgba(255,255,255,0.95)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    headerText: {
        flex: 1,
    },
    greeting: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
    },
    dateText: {
        color: 'rgba(255,255,255,0.75)',
        fontSize: 18,
        marginTop: 2,
    },
    logoutBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 8,
    },
    // ── Content ──
    content: {
        flex: 1,
        backgroundColor: '#F5F5F7',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        paddingTop: 24,
        paddingHorizontal: 18,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 18,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1E2022',
    },
    sectionSubtitle: {
        fontSize: 18,
        color: '#999',
        marginTop: 2,
    },
    // ── Branch Cards ──
    list: {
        paddingBottom: 90,
    },
    branchCard: {
        backgroundColor: '#fff',
        paddingVertical: 14,
        paddingHorizontal: 14,
        borderRadius: 16,
        marginBottom: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 3,
    },
    cardLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    branchIconWrap: {
        width: 46,
        height: 46,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    branchInfo: {
        flex: 1,
    },
    branchName: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1E2022',
    },
    addressRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 3,
    },
    branchAddress: {
        fontSize: 16,
        color: '#999',
        marginLeft: 3,
        flex: 1,
    },
    chevronWrap: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#F5F5F7',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 8,
    },
    statusRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 10,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
    },
    // ── Empty State ──
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingBottom: 60,
    },
    emptyIconWrap: {
        width: 88,
        height: 88,
        borderRadius: 44,
        backgroundColor: 'rgba(243,112,33,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#333',
    },
    emptySubtext: {
        fontSize: 18,
        color: '#999',
        marginTop: 6,
        marginBottom: 24,
    },
    emptyAddBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: THEME,
        paddingVertical: 14,
        paddingHorizontal: 28,
        borderRadius: 14,
        shadowColor: THEME,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    emptyAddBtnText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
        marginLeft: 6,
    },
    // ── FAB ──
    fab: {
        position: 'absolute',
        bottom: 30,
        right: 22,
        width: 58,
        height: 58,
        borderRadius: 29,
        backgroundColor: THEME,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: THEME,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
        elevation: 6,
    },
});
