import { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Clipboard } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../services/supabase";
import { Buffer } from 'buffer';

const ENCRYPTION_KEY = 'yourpos-secret-key-2026';

export default function BranchDetailScreen({ branch, onBack, onEnterPOS }) {
    const [credentials, setCredentials] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        fetchCredentials();
    }, [branch?.id]);

    const fetchCredentials = async () => {
        if (!branch?.id) return;

        try {
            const { data, error } = await supabase
                .from('store_credentials')
                .select('*')
                .eq('store_id', branch.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
                throw error;
            }

            if (data) {
                // Decrypt password
                const decryptedPassword = decryptPassword(data.password_encrypted);
                setCredentials({
                    email: data.email,
                    password: decryptedPassword,
                });
            }
        } catch (error) {
            console.error('Failed to fetch credentials:', error);
        } finally {
            setLoading(false);
        }
    };

    // XOR decryption matching AddBranchModal encryption
    const decryptPassword = (encryptedPassword) => {
        try {
            const encrypted = Buffer.from(encryptedPassword, 'base64').toString('binary');
            let result = '';
            for (let i = 0; i < encrypted.length; i++) {
                result += String.fromCharCode(encrypted.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length));
            }
            return result;
        } catch {
            return '******';
        }
    };

    const copyToClipboard = (text, label) => {
        Clipboard.setString(text);
        Alert.alert('คัดลอกแล้ว', `${label} ถูกคัดลอกไปยังคลิปบอร์ด`);
    };

    const handleResetCredentials = () => {
        Alert.alert(
            'รีเซ็ตข้อมูลเข้าสู่ระบบ',
            'ต้องการสร้าง Email และรหัสผ่านใหม่หรือไม่? ข้อมูลเดิมจะใช้งานไม่ได้อีกต่อไป',
            [
                { text: 'ยกเลิก', style: 'cancel' },
                { text: 'รีเซ็ต', style: 'destructive', onPress: resetCredentials },
            ]
        );
    };

    const resetCredentials = async () => {
        // TODO: Implement credential reset
        Alert.alert('แจ้งเตือน', 'ฟีเจอร์นี้กำลังพัฒนา');
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#333" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>ข้อมูลสาขา</Text>
                <TouchableOpacity style={styles.menuBtn}>
                </TouchableOpacity>
            </View>

            {/* Branch Info Card */}
            <View style={styles.infoCard}>
                <View style={styles.branchIcon}>
                    <Ionicons name="storefront" size={40} color="#52616B" />
                </View>
                <Text style={styles.branchName}>{branch?.name}</Text>
                {branch?.address && (
                    <Text style={styles.branchAddress}>{branch.address}</Text>
                )}
            </View>

            {/* Store Access Section */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <Ionicons name="desktop-outline" size={20} color="#666" />
                    <Text style={styles.sectionLabel}>STORE ACCESS</Text>
                </View>

                <TouchableOpacity
                    style={styles.accessButton}
                    onPress={() => onEnterPOS && onEnterPOS(branch)}
                >
                    <Text style={styles.accessButtonText}>จัดการระบบภายใน</Text>
                    <Ionicons name="open-outline" size={20} color="#007AFF" />
                </TouchableOpacity>
            </View>

            {/* Credentials Section */}
            <View style={styles.section}>
                <Text style={styles.credentialsTitle}>บัญชีผู้ใช้งาน</Text>

                {loading ? (
                    <ActivityIndicator size="small" color="#666" style={{ marginTop: 20 }} />
                ) : credentials ? (
                    <>
                        <View style={styles.credentialRow}>
                            <Text style={styles.credentialLabel}>Email ผู้จัดการ</Text>
                            <View style={styles.credentialValue}>
                                <Text style={styles.credentialText}>{credentials.email}</Text>
                                <TouchableOpacity
                                    onPress={() => copyToClipboard(credentials.email, 'Email')}
                                    style={styles.copyBtn}
                                >
                                    <Ionicons name="copy-outline" size={20} color="#007AFF" />
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View style={styles.credentialRow}>
                            <Text style={styles.credentialLabel}>รหัสผ่าน</Text>
                            <View style={styles.credentialValue}>
                                <Text style={styles.credentialText}>
                                    {showPassword ? credentials.password : '••••••••••'}
                                </Text>
                                <TouchableOpacity
                                    onPress={() => setShowPassword(!showPassword)}
                                    style={styles.copyBtn}
                                >
                                    <Ionicons
                                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                                        size={20}
                                        color="#666"
                                    />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => copyToClipboard(credentials.password, 'รหัสผ่าน')}
                                    style={styles.copyBtn}
                                >
                                    <Ionicons name="copy-outline" size={20} color="#007AFF" />
                                </TouchableOpacity>
                            </View>
                        </View>

                        <TouchableOpacity
                            style={styles.resetBtn}
                            onPress={handleResetCredentials}
                        >
                            <Ionicons name="refresh-outline" size={18} color="#FF3B30" />
                            <Text style={styles.resetBtnText}>รีเซ็ตข้อมูลเข้าสู่ระบบ</Text>
                        </TouchableOpacity>
                    </>
                ) : (
                    <View style={styles.noCredentials}>
                        <Ionicons name="alert-circle-outline" size={40} color="#999" />
                        <Text style={styles.noCredentialsText}>ยังไม่มีข้อมูลผู้จัดการ</Text>
                    </View>
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    backBtn: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: '#333',
    },
    menuBtn: {
        padding: 8,
    },
    infoCard: {
        backgroundColor: '#fff',
        alignItems: 'center',
        paddingVertical: 30,
        paddingHorizontal: 20,
    },
    branchIcon: {
        width: 80,
        height: 80,
        borderRadius: 20,
        backgroundColor: '#f0f0f0',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    branchName: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#1E2022',
    },
    branchAddress: {
        fontSize: 14,
        color: '#666',
        marginTop: 6,
        textAlign: 'center',
    },
    section: {
        backgroundColor: '#fff',
        marginTop: 12,
        paddingHorizontal: 16,
        paddingVertical: 16,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    sectionLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#666',
        marginLeft: 8,
        letterSpacing: 0.5,
    },
    accessButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#f5f5f5',
        padding: 16,
        borderRadius: 10,
    },
    accessButtonText: {
        fontSize: 16,
        fontWeight: '500',
        color: '#333',
    },
    credentialsTitle: {
        fontSize: 13,
        color: '#999',
        marginBottom: 16,
    },
    credentialRow: {
        marginBottom: 20,
    },
    credentialLabel: {
        fontSize: 13,
        color: '#666',
        marginBottom: 8,
    },
    credentialValue: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f5f5f5',
        padding: 14,
        borderRadius: 10,
    },
    credentialText: {
        flex: 1,
        fontSize: 15,
        color: '#333',
    },
    copyBtn: {
        padding: 6,
        marginLeft: 8,
    },
    resetBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        marginTop: 10,
    },
    resetBtnText: {
        fontSize: 14,
        color: '#FF3B30',
        marginLeft: 8,
    },
    noCredentials: {
        alignItems: 'center',
        paddingVertical: 30,
    },
    noCredentialsText: {
        fontSize: 14,
        color: '#999',
        marginTop: 12,
    },
});
