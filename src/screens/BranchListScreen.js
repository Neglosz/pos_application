import { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, FlatList, StyleSheet, StatusBar, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../services/supabase";
import AddBranchModal from "../components/AddBranchModal";

export default function BranchListScreen({ userProfile, onSelectBranch, onLogout }) {
    const [branches, setBranches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [systemStatus, setSystemStatus] = useState('normal'); // normal, warning, error

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
                .eq('is_active', true)
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

    const getCurrentDate = () => {
        const options = { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' };
        const date = new Date();
        // Thai locale date
        const thaiDate = date.toLocaleDateString('th-TH', options);
        return thaiDate;
    };

    const renderBranchItem = ({ item }) => (
        <TouchableOpacity
            style={styles.branchItem}
            onPress={() => onSelectBranch && onSelectBranch(item)}
        >
            <View style={styles.branchIcon}>
                <Ionicons name="storefront" size={24} color="#52616B" />
            </View>
            <View style={styles.branchInfo}>
                <Text style={styles.branchName}>{item.name}</Text>
                {item.address && (
                    <Text style={styles.branchAddress}>{item.address}</Text>
                )}
            </View>
            <Ionicons name="chevron-forward" size={24} color="#999" />
        </TouchableOpacity>
    );

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <ActivityIndicator size="large" color="#52616B" style={{ flex: 1 }} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: '#1E2022', paddingTop:30 }]} edges={['top']}>
            <StatusBar barStyle="light-content" backgroundColor="#1E2022" />

            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerTop}>
                    <View>
                        <Text style={styles.greeting}>
                            สวัสดี, {userProfile?.full_name || 'เจ้าของร้าน'}
                        </Text>
                        <Text style={styles.dateText}>{getCurrentDate()}</Text>
                    </View>
                    <TouchableOpacity onPress={onLogout} style={styles.logoutBtn}>
                        <Ionicons name="log-out-outline" size={24} color="#fff" />
                    </TouchableOpacity>
                </View>

            </View>

            {/* Branch List Section */}
            <View style={styles.content}>
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>สาขาที่ดูแล</Text>
                    <TouchableOpacity
                        style={styles.addButton}
                        onPress={() => setModalVisible(true)}
                    >
                        <Text style={styles.addButtonText}>+ เพิ่มสาขาใหม่</Text>
                    </TouchableOpacity>
                </View>

                {branches.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Ionicons name="storefront-outline" size={64} color="#ccc" />
                        <Text style={styles.emptyText}>ยังไม่มีสาขา</Text>
                        <Text style={styles.emptySubtext}>กด "เพิ่มสาขาใหม่" เพื่อเริ่มต้น</Text>
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
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    header: {
        backgroundColor: '#1E2022',
        paddingHorizontal: 20,
        paddingBottom: 10,
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16
    },
    greeting: {
        color: '#fff',
        fontSize: 22,
        fontWeight: 'bold',
    },
    dateText: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 14,
        marginTop: 4,
    },
    logoutBtn: {
        padding: 8,
    },
    statusCard: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 12,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
    },
    statusIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    statusInfo: {
        flex: 1,
        marginLeft: 12,
    },
    statusLabel: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 12,
    },
    statusText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '500',
        marginTop: 2,
    },
    statusDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    content: {
        flex: 1,
        paddingHorizontal: 16,
        paddingTop: 20,
        borderTopRightRadius:30,
        borderTopLeftRadius:30,
        backgroundColor:'#fff'
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },
    addButton: {
        backgroundColor: 'transparent',
    },
    addButtonText: {
        color: '#007AFF',
        fontSize: 14,
        fontWeight: '500',
    },
    list: {
        paddingBottom: 20,
    },
    branchItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    branchIcon: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: '#f0f0f0',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    branchInfo: {
        flex: 1,
    },
    branchName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1E2022',
    },
    branchAddress: {
        fontSize: 13,
        color: '#666',
        marginTop: 3,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#666',
        marginTop: 16,
    },
    emptySubtext: {
        fontSize: 14,
        color: '#999',
        marginTop: 8,
    },
});
