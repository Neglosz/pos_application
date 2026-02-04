import { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Clipboard, TextInput, ScrollView, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { supabase } from "../services/supabase";
import { Buffer } from 'buffer';
import { getStoreSettings, updateStoreSettings } from "../services/api";
import { useStore } from "../contexts/StoreContext";

const ENCRYPTION_KEY = 'yourpos-secret-key-2026';

export default function BranchDetailScreen({ branch, onBack, onEnterPOS }) {
    // const { isOwner } = useStore(); // Context might not be ready
    const [isOwner, setIsOwner] = useState(false);
    const [credentials, setCredentials] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showPassword, setShowPassword] = useState(false);

    // PromptPay State
    const [ppId, setPpId] = useState('');
    const [ppType, setPpType] = useState('phone'); // 'phone' or 'id_card'
    const [ppName, setPpName] = useState('');
    const [ppLoading, setPpLoading] = useState(false);
    const [ppFetching, setPpFetching] = useState(true);

    useEffect(() => {
        checkOwnerStatus();
        fetchCredentials();
        fetchPromptPaySettings();
    }, [branch?.id]);

    const checkOwnerStatus = async () => {
        if (!branch) {
            console.log('BranchDetail: No branch data');
            return;
        }
        try {
            const { data: { user }, error } = await supabase.auth.getUser();
            if (error || !user) {
                console.log('BranchDetail: User not found', error);
                return;
            }

            if (branch.owner_id === user.id) {
                setIsOwner(true);
            } else {
                // Fetch store owner from DB just in case branch prop is incomplete
                const { data, error: storeError } = await supabase
                    .from('stores')
                    .select('owner_id')
                    .eq('id', branch.id)
                    .single();
                
                if (storeError) {
                    console.error('Fetch store error:', storeError);
                } else if (data) {
                    setIsOwner(data.owner_id === user.id);
                }
            }
        } catch (e) {
            console.error('Check owner error:', e);
        }
    };

    const fetchPromptPaySettings = async () => {
        if (!branch?.id) return;
        setPpFetching(true);
        try {
            const res = await getStoreSettings(branch.id);
            if (res.success) {
                setPpId(res.data.promptpay_id || '');
                setPpType(res.data.promptpay_type || 'phone');
                setPpName(res.data.promptpay_name || '');
            }
        } catch (error) {
            console.error('Failed to fetch promptpay settings:', error);
        } finally {
            setPpFetching(false);
        }
    };

    const handleUpdatePromptPay = async () => {
        if (!ppId || !ppName) {
            Alert.alert('ข้อมูลไม่ครบ', 'กรุณากรอกเลขพร้อมเพย์และชื่อบัญชี');
            return;
        }

        setPpLoading(true);
        try {
            const res = await updateStoreSettings({
                promptpay_id: ppId,
                promptpay_type: ppType,
                promptpay_name: ppName
            }, branch.id);

            if (res.success) {
                Alert.alert('สำเร็จ', 'บันทึกข้อมูลพร้อมเพย์เรียบร้อยแล้ว');
                fetchPromptPaySettings(); // Refresh to see masked data if needed
            } else {
                Alert.alert('ผิดพลาด', res.error || 'ไม่สามารถบันทึกข้อมูลได้');
            }
        } catch (error) {
            console.error('Update PromptPay Error:', error);
            Alert.alert('ผิดพลาด', `เกิดข้อผิดพลาดในการเชื่อมต่อ: ${error.message}`);
        } finally {
            setPpLoading(false);
        }
    };

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
            <ScrollView showsVerticalScrollIndicator={false}>
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

                {/* PromptPay Settings Section */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <MaterialCommunityIcons name="qrcode-scan" size={20} color="#666" />
                        <Text style={styles.sectionLabel}>ตั้งค่าพร้อมเพย์ (รับเงิน QR)</Text>
                    </View>

                    {ppFetching ? (
                        <ActivityIndicator size="small" color="#666" />
                    ) : (
                        <View style={styles.promptpayContainer}>
                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>ชื่อบัญชี</Text>
                                <TextInput
                                    style={[styles.input, !isOwner && styles.inputDisabled]}
                                    value={ppName}
                                    onChangeText={setPpName}
                                    placeholder="ชื่อ-นามสกุล"
                                    editable={isOwner}
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>เลขที่บัญชี (เบอร์โทร/เลขบัตร ปชช.)</Text>
                                <TextInput
                                    style={[styles.input, !isOwner && styles.inputDisabled]}
                                    value={ppId}
                                    onChangeText={setPpId}
                                    placeholder="08x-xxx-xxxx"
                                    keyboardType="numeric"
                                    editable={isOwner}
                                />
                                {!isOwner && <Text style={styles.helperText}>* เฉพาะเจ้าของร้านเท่านั้นที่แก้ไขได้</Text>}
                            </View>

                            <View style={styles.typeSelector}>
                                <TouchableOpacity 
                                    style={[styles.typeBtn, ppType === 'phone' && styles.typeBtnActive]}
                                    onPress={() => isOwner && setPpType('phone')}
                                    disabled={!isOwner}
                                >
                                    <Text style={[styles.typeBtnText, ppType === 'phone' && styles.typeBtnTextActive]}>เบอร์โทรศัพท์</Text>
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    style={[styles.typeBtn, ppType === 'id_card' && styles.typeBtnActive]}
                                    onPress={() => isOwner && setPpType('id_card')}
                                    disabled={!isOwner}
                                >
                                    <Text style={[styles.typeBtnText, ppType === 'id_card' && styles.typeBtnTextActive]}>เลขบัตรประชาชน</Text>
                                </TouchableOpacity>
                            </View>

                            {isOwner && (
                                <TouchableOpacity 
                                    style={[styles.saveBtn, ppLoading && styles.saveBtnDisabled]}
                                    onPress={handleUpdatePromptPay}
                                    disabled={ppLoading}
                                >
                                    {ppLoading ? (
                                        <ActivityIndicator size="small" color="#fff" />
                                    ) : (
                                        <Text style={styles.saveBtnText}>บันทึกข้อมูลพร้อมเพย์</Text>
                                    )}
                                </TouchableOpacity>
                            )}
                        </View>
                    )}
                </View>

                {/* Credentials Section */}
                <View style={styles.section}>
                    <Text style={styles.credentialsTitle}>บัญชีผู้จัดการ (Manager Account)</Text>

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

                            {isOwner && (
                                <TouchableOpacity
                                    style={styles.resetBtn}
                                    onPress={handleResetCredentials}
                                >
                                    <Ionicons name="refresh-outline" size={18} color="#FF3B30" />
                                    <Text style={styles.resetBtnText}>รีเซ็ตข้อมูลเข้าสู่ระบบ</Text>
                                </TouchableOpacity>
                            )}
                        </>
                    ) : (
                        <View style={styles.noCredentials}>
                            <Ionicons name="alert-circle-outline" size={40} color="#999" />
                            <Text style={styles.noCredentialsText}>ยังไม่มีข้อมูลผู้จัดการ</Text>
                        </View>
                    )}
                </View>
                <View style={{ height: 40 }} />
            </ScrollView>
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
    // PromptPay Styles
    promptpayContainer: {
        marginTop: 5,
    },
    inputGroup: {
        marginBottom: 15,
    },
    inputLabel: {
        fontSize: 13,
        color: '#666',
        marginBottom: 6,
    },
    input: {
        backgroundColor: '#f5f5f5',
        padding: 12,
        borderRadius: 10,
        fontSize: 15,
        color: '#333',
        borderWidth: 1,
        borderColor: '#eee',
    },
    inputDisabled: {
        color: '#999',
        backgroundColor: '#fafafa',
    },
    helperText: {
        fontSize: 11,
        color: '#FF9500',
        marginTop: 4,
    },
    typeSelector: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 20,
    },
    typeBtn: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        backgroundColor: '#f5f5f5',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#eee',
    },
    typeBtnActive: {
        backgroundColor: '#E3F2FD',
        borderColor: '#2196F3',
    },
    typeBtnText: {
        fontSize: 13,
        color: '#666',
    },
    typeBtnTextActive: {
        color: '#2196F3',
        fontWeight: 'bold',
    },
    saveBtn: {
        backgroundColor: '#2196F3',
        paddingVertical: 15,
        borderRadius: 12,
        alignItems: 'center',
        shadowColor: '#2196F3',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 3,
    },
    saveBtnDisabled: {
        backgroundColor: '#B0BEC5',
    },
    saveBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
