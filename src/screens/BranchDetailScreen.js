import { useState, useEffect } from "react";
import * as ImagePicker from 'expo-image-picker'
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, TextInput, ScrollView, Platform, Image } from "react-native";
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { supabase } from "../services/supabase";
import { Buffer } from 'buffer';
import { getStoreSettings, updateStoreSettings } from "../services/api";


const ENCRYPTION_KEY = 'yourpos-secret-key-2026';
const THEME_COLOR = '#F37021'; // Orange
const BG_COLOR = '#F8F9FA'; // Light Gray Background

export default function BranchDetailScreen({ branch, onBack, onEnterPOS }) {
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
    const [isEditingPromptPay, setIsEditingPromptPay] = useState(false);

    // Edit Branch State
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState('');
    const [editAddress, setEditAddress] = useState('');
    const [editPhone, setEditPhone] = useState('');
    const [savingBranch, setSavingBranch] = useState(false);

    const [deleting, setDeleting] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const handlePickAndUploadImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('ต้องการสิทธิ์', 'ขอสิทธิ์เข้าถึงคลังรูปภาพเพื่อเปลี่ยนรูปร้าน');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });

        if (!result.canceled) {
            uploadStorageImage(result.assets[0].uri);
        }
    };

    const uploadStorageImage = async (imageUri) => {
        if (!branch?.id) return;
        setUploadingImage(true);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('กรุณาเข้าสู่ระบบใหม่');

            const formData = new FormData();
            formData.append('store_id', branch.id);
            formData.append('image', {
                uri: imageUri,
                name: 'store_image.jpg',
                type: 'image/jpeg',
            });

            const { API_BASE_URL } = require('../config');
            const response = await fetch(`${API_BASE_URL}/branches/upload-image`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,

                },
                body: formData,
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'อัปโหลดไม่สำเร็จ');
            branch.image_url = result.imageUrl;
            Alert.alert('สำเร็จ', 'เปลี่ยนรูปเรียบร้อยแล้ว');
        } catch (error) {
            Alert.alert('ผิดพลาด', 'อัปโหลดรูปไม่สำเร็จ: ' + error.message);
        } finally {
            setUploadingImage(false);
        }
    };

    useEffect(() => {
        checkOwnerStatus();
        fetchCredentials();
        fetchPromptPaySettings();
        // Initialize edit values
        setEditName(branch?.name || '');
        setEditAddress(branch?.address || '');
        setEditPhone(branch?.phone || '');
    }, [branch?.id]);

    const checkOwnerStatus = async () => {
        if (!branch) return;
        try {
            const { data: { user }, error } = await supabase.auth.getUser();
            if (error || !user) return;

            if (branch.owner_id === user.id) {
                setIsOwner(true);
            } else {
                const { data, error: storeError } = await supabase
                    .from('stores')
                    .select('owner_id')
                    .eq('id', branch.id)
                    .single();

                if (data) {
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
                fetchPromptPaySettings(); // Refresh
                setIsEditingPromptPay(false);
            } else {
                Alert.alert('ผิดพลาด', res.error || 'ไม่สามารถบันทึกข้อมูลได้');
            }
        } catch (error) {
            Alert.alert('ผิดพลาด', `เกิดข้อผิดพลาด: ${error.message}`);
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

            if (data) {
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

    const copyToClipboard = async (text, label) => {
        await Clipboard.setStringAsync(text);
        Alert.alert('คัดลอกแล้ว', `${label} ถูกคัดลอกไปยังคลิปบอร์ด`);
    };

    const handleResetCredentials = () => {
        Alert.alert('แจ้งเตือน', 'ฟีเจอร์นี้กำลังพัฒนา');
    };

    const handleDeleteBranch = () => {
        Alert.alert(
            'ลบสาขา',
            `คุณต้องการลบสาขา "${branch?.name}" หรือไม่?\n\nการลบจะรวมถึง:\n• ข้อมูลร้านค้าทั้งหมด\n• บัญชีผู้จัดการ\n• การตั้งค่าทั้งหมด\n\nการดำเนินการนี้ไม่สามารถยกเลิกได้!`,
            [
                { text: 'ยกเลิก', style: 'cancel' },
                { text: 'ลบสาขา', style: 'destructive', onPress: deleteBranch },
            ]
        );
    };

    const deleteBranch = async () => {
        if (!branch?.id) return;
        setDeleting(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Session หมดอายุ กรุณา login ใหม่');

            const { API_BASE_URL } = require('../config');
            const response = await fetch(`${API_BASE_URL}/branches/delete`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ store_id: branch.id }),
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'ไม่สามารถลบสาขาได้');

            Alert.alert('สำเร็จ', 'ลบสาขาเรียบร้อยแล้ว', [
                { text: 'ตกลง', onPress: () => onBack && onBack() }
            ]);

        } catch (error) {
            Alert.alert('ผิดพลาด', error.message);
        } finally {
            setDeleting(false);
        }
    };

    const handleSaveBranchInfo = async () => {
        if (!editName.trim()) {
            Alert.alert('ข้อผิดพลาด', 'กรุณากรอกชื่อสาขา');
            return;
        }

        setSavingBranch(true);
        try {
            const { error } = await supabase
                .from('stores')
                .update({
                    name: editName.trim(),
                    address: editAddress.trim() || null,
                    phone: editPhone.trim() || null,
                })
                .eq('id', branch.id);

            if (error) throw error;

            // Optimistic update
            branch.name = editName.trim();
            branch.address = editAddress.trim();
            branch.phone = editPhone.trim();

            setIsEditing(false);
            Alert.alert('สำเร็จ', 'บันทึกข้อมูลสาขาเรียบร้อยแล้ว');

        } catch (error) {
            Alert.alert('ผิดพลาด', error.message || 'ไม่สามารถบันทึกข้อมูลได้');
        } finally {
            setSavingBranch(false);
        }
    };

    // --- Sub-Components for cleaner code ---

    const InfoRow = ({ icon, label, value, onCopy }) => (
        <View style={styles.infoRow}>
            <View style={styles.infoRowIcon}>
                <Ionicons name={icon} size={20} color="#666" />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={styles.infoRowLabel}>{label}</Text>
                <Text style={styles.infoRowValue}>{value || '-'}</Text>
            </View>
            {onCopy && (
                <TouchableOpacity onPress={onCopy} style={styles.iconBtn}>
                    <Ionicons name="copy-outline" size={20} color={THEME_COLOR} />
                </TouchableOpacity>
            )}
        </View>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#333" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>รายละเอียดสาขา</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                {/* 1. Hero / Main Info Section */}
                <View style={styles.heroSection}>
                    <TouchableOpacity
                        style={styles.storeIconContainer}
                        onPress={isOwner ? handlePickAndUploadImage : null}
                        disabled={uploadingImage}
                    >
                        {uploadingImage ? (
                            <ActivityIndicator color={THEME_COLOR} />
                        ) : branch?.image_url ? (
                            <Image source={{ uri: branch.image_url }} style={{ width: '100%', height: '100%', borderRadius: 40 }} />
                        ) : (
                            <Ionicons name="storefront" size={40} color={THEME_COLOR} />
                        )}
                        {isOwner && !uploadingImage && (
                            <View style={{ position: 'absolute', bottom: 0, right: 0, backgroundColor: '#fff', borderRadius: 10, padding: 4, borderWidth: 1, borderColor: '#eee' }}>
                                <Ionicons name="camera" size={12} color="#666" />

                            </View>
                        )}
                    </TouchableOpacity>

                    {isEditing ? (
                        <View style={styles.editForm}>
                            <Text style={styles.inputLabel}>ชื่อสาขา</Text>
                            <TextInput
                                style={styles.input}
                                value={editName}
                                onChangeText={setEditName}
                                placeholder="ชื่อร้านของคุณ"
                            />
                            <Text style={styles.inputLabel}>เบอร์โทร</Text>
                            <TextInput
                                style={styles.input}
                                value={editPhone}
                                onChangeText={setEditPhone}
                                placeholder="เบอร์โทรติดต่อ"
                                keyboardType="phone-pad"
                            />
                            <Text style={styles.inputLabel}>ที่อยู่</Text>
                            <TextInput
                                style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                                value={editAddress}
                                onChangeText={setEditAddress}
                                placeholder="ที่อยู่ร้าน"
                                multiline
                            />
                            <View style={styles.editActions}>
                                <TouchableOpacity
                                    style={styles.cancelBtn}
                                    onPress={() => setIsEditing(false)}
                                >
                                    <Text style={styles.cancelBtnText}>ยกเลิก</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.saveBtn}
                                    onPress={handleSaveBranchInfo}
                                    disabled={savingBranch}
                                >
                                    {savingBranch ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>บันทึก</Text>}
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : (
                        <>
                            <Text style={styles.storeName}>{branch?.name}</Text>
                            <Text style={styles.storeAddress}>{branch?.address || 'ไม่มีที่อยู่'}</Text>
                            {branch?.phone && <Text style={styles.storePhone}>{branch.phone}</Text>}

                            {isOwner && (
                                <TouchableOpacity style={styles.editLinkBtn} onPress={() => setIsEditing(true)}>
                                    <Ionicons name="create-outline" size={16} color={THEME_COLOR} />
                                    <Text style={styles.editLinkText}>แก้ไขข้อมูล</Text>
                                </TouchableOpacity>
                            )}
                        </>
                    )}
                </View>

                {/* 2. Primary Action Button */}
                {!isEditing && (
                    <TouchableOpacity
                        style={styles.primaryActionBtn}
                        onPress={() => onEnterPOS && onEnterPOS(branch)}
                    >
                        <View style={styles.primaryActionIcon}>
                            <Ionicons name="cart" size={32} color="#fff" />
                        </View>
                        <View>
                            <Text style={styles.primaryActionTitle}>เข้าสู่ระบบขายหน้าร้าน</Text>
                            <Text style={styles.primaryActionSubtitle}>กดเพื่อเริ่มขายทันที</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={24} color="#fff" style={{ marginLeft: 'auto' }} />
                    </TouchableOpacity>
                )}

                {/* 3. Settings Cards */}
                <Text style={styles.sectionHeader}>การตั้งค่า</Text>

                {/* PromptPay Card */}
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <View style={[styles.cardIcon, { backgroundColor: '#E3F2FD' }]}>
                            <MaterialCommunityIcons name="qrcode-scan" size={24} color="#2196F3" />
                        </View>
                        <Text style={styles.cardTitle}>PromptPay (รับเงิน QR)</Text>
                    </View>

                    {ppFetching ? (
                        <ActivityIndicator />
                    ) : isEditingPromptPay ? (
                        <View style={styles.cardContent}>
                            <Text style={styles.inputLabel}>ชื่อบัญชี / ชื่อร้าน</Text>
                            <TextInput
                                style={styles.input}
                                value={ppName}
                                onChangeText={setPpName}
                                placeholder="เช่น นายสมชาย ขายดี"
                            />
                            <Text style={styles.inputLabel}>เลขพร้อมเพย์ / เบอร์โทร</Text>
                            <TextInput
                                style={styles.input}
                                value={ppId}
                                onChangeText={setPpId}
                                placeholder="เช่น 0812345678"
                                keyboardType="number-pad"
                            />
                            <View style={styles.typeSelector}>
                                <TouchableOpacity
                                    style={[styles.typeBtn, ppType === 'phone' && styles.typeBtnActive]}
                                    onPress={() => setPpType('phone')}
                                >
                                    <Text style={[styles.typeBtnText, ppType === 'phone' && styles.typeBtnTextActive]}>เบอร์โทร</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.typeBtn, ppType === 'id_card' && styles.typeBtnActive]}
                                    onPress={() => setPpType('id_card')}
                                >
                                    <Text style={[styles.typeBtnText, ppType === 'id_card' && styles.typeBtnTextActive]}>เลขบัตร ปชช.</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.editActions}>
                                <TouchableOpacity
                                    style={styles.cancelBtn}
                                    onPress={() => setIsEditingPromptPay(false)}
                                >
                                    <Text style={styles.cancelBtnText}>ยกเลิก</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.saveBtn}
                                    onPress={handleUpdatePromptPay}
                                    disabled={ppLoading}
                                >
                                    {ppLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>บันทึก</Text>}
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : (
                        <View style={styles.cardContent}>
                            <InfoRow
                                icon="person-outline"
                                label="ชื่อบัญชี"
                                value={ppName || 'ยังไม่ตั้งค่า'}
                            />
                            <InfoRow
                                icon={ppType === 'phone' ? 'call-outline' : 'card-outline'}
                                label={ppType === 'phone' ? 'เบอร์โทรศัพท์' : 'เลขบัตร ปชช.'}
                                value={ppId || 'ยังไม่ตั้งค่า'}
                            />
                            {isOwner && (
                                <TouchableOpacity style={styles.cardActionBtn} onPress={() => setIsEditingPromptPay(true)}>
                                    <Text style={styles.cardActionText}>ตั้งค่า PromptPay</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}
                </View>

                {/* Manager Account Card */}
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <View style={[styles.cardIcon, { backgroundColor: '#FFF3E0' }]}>
                            <Ionicons name="key-outline" size={24} color={THEME_COLOR} />
                        </View>
                        <Text style={styles.cardTitle}>บัญชีผู้จัดการ</Text>
                    </View>

                    {loading ? (
                        <ActivityIndicator />
                    ) : credentials ? (
                        <View style={styles.cardContent}>
                            <InfoRow
                                icon="mail-outline"
                                label="Email"
                                value={credentials.email}
                                onCopy={() => copyToClipboard(credentials.email, 'Email')}
                            />
                            <View style={styles.infoRow}>
                                <View style={styles.infoRowIcon}>
                                    <Ionicons name="lock-closed-outline" size={20} color="#666" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.infoRowLabel}>รหัสผ่าน</Text>
                                    <Text style={styles.infoRowValue}>
                                        {showPassword ? credentials.password : '••••••••••'}
                                    </Text>
                                </View>
                                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.iconBtn}>
                                    <Ionicons
                                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                                        size={20}
                                        color={THEME_COLOR}
                                    />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => copyToClipboard(credentials.password, 'รหัสผ่าน')} style={styles.iconBtn}>
                                    <Ionicons name="copy-outline" size={20} color={THEME_COLOR} />
                                </TouchableOpacity>
                            </View>

                            {isOwner && (
                                <TouchableOpacity style={styles.textActionBtn} onPress={handleResetCredentials}>
                                    <Text style={[styles.textActionLabel, { color: '#FF3B30' }]}>รีเซ็ตรหัสผ่าน</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    ) : (
                        <View style={styles.cardContent}>
                            <Text style={styles.emptyText}>ยังไม่มีข้อมูลบัญชีผู้จัดการ</Text>
                        </View>
                    )}
                </View>

                {/* Danger Zone */}
                {isOwner && (
                    <TouchableOpacity
                        style={styles.deleteLink}
                        onPress={handleDeleteBranch}
                        disabled={deleting}
                    >
                        {deleting ? <ActivityIndicator color="#FF3B30" /> : (
                            <>
                                <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                                <Text style={styles.deleteLinkText}>ลบสาขานี้</Text>
                            </>
                        )}
                    </TouchableOpacity>
                )}

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: BG_COLOR,
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
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
    },
    scrollContent: {
        padding: 16,
    },
    // Hero Section
    heroSection: {
        alignItems: 'center',
        marginBottom: 20,
    },
    storeIconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#eee',
        // Shadow
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    storeName: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#333',
        textAlign: 'center',
        marginBottom: 4,
    },
    storeAddress: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
        maxWidth: '80%',
        lineHeight: 20,
    },
    storePhone: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
        marginTop: 4,
    },
    editLinkBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 10,
        backgroundColor: '#fff',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#eee',
    },
    editLinkText: {
        marginLeft: 4,
        color: THEME_COLOR,
        fontSize: 13,
        fontWeight: '600',
    },
    // Primary Action
    primaryActionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: THEME_COLOR,
        borderRadius: 16,
        padding: 20,
        marginBottom: 24,
        shadowColor: THEME_COLOR,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    primaryActionIcon: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    primaryActionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 4,
    },
    primaryActionSubtitle: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.9)',
    },
    // Section Headers
    sectionHeader: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 12,
        marginLeft: 4,
    },
    // Cards
    card: {
        backgroundColor: '#fff',
        borderRadius: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
        overflow: 'hidden',
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    cardIcon: {
        width: 36,
        height: 36,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },
    cardContent: {
        padding: 16,
    },
    // Info Rows
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    infoRowIcon: {
        width: 30,
        alignItems: 'center',
        marginRight: 12,
    },
    infoRowLabel: {
        fontSize: 12,
        color: '#999',
        marginBottom: 2,
    },
    infoRowValue: {
        fontSize: 15,
        color: '#333',
    },
    iconBtn: {
        padding: 8,
    },
    cardActionBtn: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: THEME_COLOR,
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
        marginTop: 8,
    },
    cardActionText: {
        color: THEME_COLOR,
        fontSize: 14,
        fontWeight: '600',
    },
    textActionBtn: {
        alignItems: 'center',
        paddingVertical: 8,
    },
    textActionLabel: {
        fontSize: 14,
        fontWeight: '600',
    },
    emptyText: {
        textAlign: 'center',
        color: '#999',
        fontStyle: 'italic',
        paddingVertical: 10,
    },
    // Forms
    editForm: {
        width: '100%',
        backgroundColor: '#fff',
        padding: 20,
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    inputLabel: {
        fontSize: 13,
        color: '#666',
        marginBottom: 8,
        fontWeight: '500',
    },
    input: {
        backgroundColor: '#F5F5F5',
        borderRadius: 10,
        padding: 12,
        fontSize: 16,
        color: '#333',
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#eee',
    },
    editActions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 8,
    },
    cancelBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 10,
        backgroundColor: '#f0f0f0',
        alignItems: 'center',
    },
    cancelBtnText: {
        color: '#666',
        fontWeight: '600',
    },
    saveBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 10,
        backgroundColor: THEME_COLOR,
        alignItems: 'center',
    },
    saveBtnText: {
        color: '#fff',
        fontWeight: '600',
    },
    typeSelector: {
        flexDirection: 'row',
        marginBottom: 16,
        backgroundColor: '#f5f5f5',
        borderRadius: 10,
        padding: 4,
    },
    typeBtn: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 8,
    },
    typeBtnActive: {
        backgroundColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 1,
    },
    typeBtnText: {
        fontSize: 13,
        color: '#666',
    },
    typeBtnTextActive: {
        color: THEME_COLOR,
        fontWeight: '600',
    },
    // Danger Zone
    deleteLink: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 20,
        padding: 16,
    },
    deleteLinkText: {
        color: '#FF3B30',
        marginLeft: 8,
        fontSize: 14,
        fontWeight: '500',
    },
});
