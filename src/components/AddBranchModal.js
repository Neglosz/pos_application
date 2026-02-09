import { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, TextInput, Modal, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../services/supabase";
import * as Crypto from 'expo-crypto';
import { Buffer } from 'buffer';

import { API_BASE_URL as API_URL } from '../config';
const EMAIL_DOMAIN = 'yourpos.app';
const ENCRYPTION_KEY = 'yourpos-secret-key-2026';

export default function AddBranchModal({ visible, onClose, onSuccess }) {
    const [branchName, setBranchName] = useState('');
    const [address, setAddress] = useState('');
    const [phone, setPhone] = useState('');
    const [generatedEmail, setGeneratedEmail] = useState('');
    const [generatedPassword, setGeneratedPassword] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (visible) {
            // Reset form when modal opens
            setBranchName('');
            setAddress('');
            setPhone('');
            generateCredentials();
        }
    }, [visible]);

    const generateCredentials = () => {
        // Generate random suffix for email
        const randomSuffix = Math.random().toString(36).substring(2, 8);
        setGeneratedEmail(`store-${randomSuffix}@${EMAIL_DOMAIN}`);

        // Generate random password (10 chars)
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
        let password = '';
        for (let i = 0; i < 10; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        setGeneratedPassword(password);
    };

    const generateEmailFromName = (name) => {
        if (!name.trim()) return;

        // Convert Thai/English name to slug
        const slug = name
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9ก-๙-]/g, '')
            .substring(0, 30);

        // Add random suffix to ensure uniqueness
        const randomSuffix = Math.random().toString(36).substring(2, 6);
        setGeneratedEmail(`${slug || 'store'}-${randomSuffix}@${EMAIL_DOMAIN}`);
    };

    // Simple XOR encryption with Base64 encoding
    const encryptPassword = (password) => {
        let result = '';
        for (let i = 0; i < password.length; i++) {
            result += String.fromCharCode(password.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length));
        }
        return Buffer.from(result, 'binary').toString('base64');
    };

    const handleSubmit = async () => {
        if (!branchName.trim()) {
            Alert.alert('ข้อมูลไม่ครบ', 'กรุณากรอกชื่อสาขา');
            return;
        }

        setLoading(true);

        try {
            // Get current user and session
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('กรุณา login ใหม่');

            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Session หมดอายุ กรุณา login ใหม่');

            // 1. Create store
            const { data: store, error: storeError } = await supabase
                .from('stores')
                .insert({
                    owner_id: user.id,
                    name: branchName,
                    address: address,
                    phone: phone,
                })
                .select()
                .single();

            if (storeError) throw storeError;

            // 2. Create manager account via Supabase Admin API (through backend)
            const response = await fetch(`${API_URL}/branches/create-manager`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                    'x-user-id': user.id,
                    'x-store-id': store.id,
                },
                body: JSON.stringify({
                    store_id: store.id,
                    email: generatedEmail,
                    password: generatedPassword,
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'ไม่สามารถสร้างบัญชีผู้จัดการได้');
            }

            // 3. Store encrypted credentials in store_credentials table
            const encryptedPassword = encryptPassword(generatedPassword);

            const { error: credError } = await supabase
                .from('store_credentials')
                .insert({
                    store_id: store.id,
                    email: generatedEmail,
                    password_encrypted: encryptedPassword,
                });

            if (credError) {
                console.error('Failed to store credentials:', credError);
                // Don't throw - store was created successfully
            }

            Alert.alert('สำเร็จ', 'สร้างสาขาใหม่เรียบร้อยแล้ว');
            onSuccess && onSuccess();

        } catch (error) {
            console.error('Create branch error:', error);
            Alert.alert('ข้อผิดพลาด', error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={onClose}
            statusBarTranslucent={true}
        >
            <View style={styles.overlay}>
                <View style={styles.modal}>
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <Ionicons name="close" size={24} color="#666" />
                        </TouchableOpacity>
                        <Text style={styles.title}>เพิ่มสาขาใหม่</Text>
                        <View style={styles.closeBtn} />
                    </View>

                    {/* Form */}
                    <View style={styles.form}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>ชื่อสาขา</Text>
                            <View style={styles.inputContainer}>
                                <Ionicons name="storefront-outline" size={20} color="#999" style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="สาขา"
                                    value={branchName}
                                    onChangeText={(text) => {
                                        setBranchName(text);
                                        generateEmailFromName(text);
                                    }}
                                />
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>ที่ตั้ง</Text>
                            <View style={styles.inputContainer}>
                                <Ionicons name="location-outline" size={20} color="#999" style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="เลขที่, ถนน, แขวง/ตำบล, เขต/อำเภอ"
                                    value={address}
                                    onChangeText={setAddress}
                                />
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>เบอร์โทรศัพท์</Text>
                            <View style={styles.inputContainer}>
                                <Ionicons name="call-outline" size={20} color="#999" style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="0xx-xxx-xxxx"
                                    value={phone}
                                    onChangeText={setPhone}
                                    keyboardType="phone-pad"
                                />
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Email ผู้จัดการ</Text>
                            <View style={[styles.inputContainer, styles.readOnly]}>
                                <Ionicons name="mail-outline" size={20} color="#999" style={styles.inputIcon} />
                                <TextInput
                                    style={[styles.input, styles.readOnlyText]}
                                    value={generatedEmail}
                                    editable={false}
                                />
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>รหัสผ่าน</Text>
                            <View style={[styles.inputContainer, styles.readOnly]}>
                                <Ionicons name="lock-closed-outline" size={20} color="#999" style={styles.inputIcon} />
                                <TextInput
                                    style={[styles.input, styles.readOnlyText]}
                                    value={generatedPassword}
                                    editable={false}
                                    secureTextEntry={false}
                                />
                            </View>
                        </View>
                    </View>

                    {/* Submit Button */}
                    <TouchableOpacity
                        style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
                        onPress={handleSubmit}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.submitBtnText}>ยืนยัน</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modal: {
        backgroundColor: '#fff',
        borderRadius: 16,
        width: '100%',
        maxWidth: 400,
        padding: 20,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 24,
    },
    closeBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1E2022',
    },
    form: {
        marginBottom: 20,
    },
    inputGroup: {
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        fontWeight: '500',
        color: '#333',
        marginBottom: 8,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f5f5f5',
        borderRadius: 10,
        paddingHorizontal: 12,
    },
    inputIcon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        paddingVertical: 14,
        fontSize: 15,
        color: '#333',
    },
    readOnly: {
        backgroundColor: '#eee',
    },
    readOnlyText: {
        color: '#666',
    },
    submitBtn: {
        backgroundColor: '#1E2022',
        borderRadius: 10,
        paddingVertical: 16,
        alignItems: 'center',
    },
    submitBtnDisabled: {
        opacity: 0.7,
    },
    submitBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});
