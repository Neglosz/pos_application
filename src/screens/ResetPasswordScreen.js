import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Image,
} from 'react-native';
import { supabase } from '../services/supabase';
import { Ionicons } from '@expo/vector-icons';

export default function ResetPasswordScreen({ onNavigateToSignIn }) {
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleUpdatePassword = async () => {
        if (!newPassword || !confirmPassword) {
            Alert.alert('ข้อมูลไม่ครบ', 'กรุณากรอกรหัสผ่านใหม่และยืนยันรหัสผ่านให้ครบ');
            return;
        }

        if (newPassword !== confirmPassword) {
            Alert.alert('รหัสผ่านไม่ตรงกัน', 'กรุณากรอกรหัสผ่านให้ตรงกันทั้งสองช่อง');
            return;
        }

        if (newPassword.length < 6) {
            Alert.alert('รหัสผ่านสั้นเกินไป', 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
            return;
        }

        setLoading(true);
        try {
            const { error } = await supabase.auth.updateUser({
                password: newPassword,
            });

            if (error) throw error;

            Alert.alert('เปลี่ยนรหัสผ่านสำเร็จ', 'รหัสผ่านของคุณถูกเปลี่ยนเรียบร้อยแล้ว กรุณาเข้าสู่ระบบอีกครั้ง', [
                {
                    text: 'ตกลง',
                    onPress: () => onNavigateToSignIn(),
                },
            ]);
        } catch (error) {
            const m = error?.message?.toLowerCase() || '';
            if (m.includes('token') && (m.includes('expired') || m.includes('invalid'))) {
                Alert.alert('ลิงก์หมดอายุ', 'ลิงก์สำหรับตั้งรหัสผ่านใหม่หมดอายุแล้ว กรุณาขอลิงก์ใหม่อีกครั้ง', [
                    { text: 'ตกลง', onPress: () => onNavigateToSignIn() }
                ]);
            } else if (m.includes('session') && (m.includes('missing') || m.includes('expired'))) {
                Alert.alert('ลิงก์ถูกใช้งานแล้ว', 'ลิงก์นี้ถูกใช้งานไปแล้วหรือหมดอายุ กรุณาขอลิงก์ใหม่อีกครั้ง', [
                    { text: 'ตกลง', onPress: () => onNavigateToSignIn() }
                ]);
            } else if (m.includes('network') || m.includes('fetch')) {
                Alert.alert('เกิดข้อผิดพลาด', 'ไม่สามารถเชื่อมต่ออินเทอร์เน็ตได้ กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่');
            } else if (m.includes('same password') || m.includes('different from the old')) {
                Alert.alert('รหัสผ่านซ้ำ', 'รหัสผ่านใหม่ต้องไม่เหมือนรหัสผ่านเดิม กรุณาตั้งรหัสผ่านใหม่');
            } else {
                Alert.alert('เกิดข้อผิดพลาด', 'ไม่สามารถเปลี่ยนรหัสผ่านได้ กรุณาลองใหม่อีกครั้ง');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={{ flex: 1, backgroundColor: '#FAF6F1' }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <View style={{ position: 'absolute', top: -120, left: -120, width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(243, 112, 33, 0.15)', }} />
            <View style={{ position: 'absolute', top: -100, right: -100, width: 250, height: 250, borderRadius: 125, backgroundColor: 'rgba(243, 200, 150, 0.20)', }} />
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <Image
                    style={{ width: 100, height: 100 }}
                    source={{ uri: "https://i.postimg.cc/CMk3WcZs/Chat-GPT-Image-Jan-5-2026-12-04-50-AM-Photoroom.png" }}
                />
                <Text style={{ fontSize: 30, fontWeight: '700', color: '#000', marginTop: 10 }}>Zippy Till</Text>
                <Text style={{ fontSize: 18, color: '#000' }}>ระบบจัดการร้านค้า</Text>
            </View>

            <View style={{
                flex: 2,
                backgroundColor: '#fff',
                borderTopLeftRadius: 55,
                borderTopRightRadius: 55,
                paddingHorizontal: 20,
                paddingTop: 30
            }}>
                <ScrollView showsVerticalScrollIndicator={false}>
                    <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' }}>
                        ตั้งรหัสผ่านใหม่
                    </Text>
                    <Text style={{ textAlign: 'center', color: '#666', marginBottom: 30 }}>
                        ใส่รหัสผ่านใหม่ข้างล่าง
                    </Text>

                    <View style={{ marginBottom: 20 }}>
                        <Text style={{ fontWeight: '600', marginBottom: 8, fontSize: 18 }}>รหัสผ่านใหม่</Text>
                        <View style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            backgroundColor: '#f5f5f5',
                            borderRadius: 10,
                            paddingHorizontal: 15,
                            height: 50,
                            borderWidth: 1,
                            borderColor: '#eee'
                        }}>
                            <Ionicons name="lock-closed-outline" size={20} color="#999" style={{ marginRight: 10 }} />
                            <TextInput
                                style={{ flex: 1, fontSize: 18 }}
                                placeholder="รหัสผ่านใหม่"
                                secureTextEntry
                                value={newPassword}
                                onChangeText={setNewPassword}
                                autoCapitalize="none"
                            />
                        </View>
                    </View>

                    <View style={{ marginBottom: 30 }}>
                        <Text style={{ fontWeight: '600', marginBottom: 8, fontSize: 18 }}>ยืนยันรหัสผ่าน</Text>
                        <View style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            backgroundColor: '#f5f5f5',
                            borderRadius: 10,
                            paddingHorizontal: 15,
                            height: 50,
                            borderWidth: 1,
                            borderColor: '#eee'
                        }}>
                            <Ionicons name="lock-closed-outline" size={20} color="#999" style={{ marginRight: 10 }} />
                            <TextInput
                                style={{ flex: 1, fontSize: 18 }}
                                placeholder="ยืนยันหัสผ่าน"
                                secureTextEntry
                                value={confirmPassword}
                                onChangeText={setConfirmPassword}
                                autoCapitalize="none"
                            />
                        </View>
                    </View>

                    <TouchableOpacity
                        style={{
                            backgroundColor: '#e9751dff',
                            height: 55,
                            borderRadius: 12,
                            justifyContent: 'center',
                            alignItems: 'center',
                            marginBottom: 15,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.2,
                            shadowRadius: 4,
                            elevation: 4
                        }}
                        onPress={handleUpdatePassword}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>อัปเดตรหัสผ่าน</Text>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity onPress={onNavigateToSignIn} style={{ alignItems: 'center', padding: 10 }}>
                        <Text style={{ color: '#666', fontWeight: '600', fontSize: 18 }}>ยกเลิก</Text>
                    </TouchableOpacity>

                </ScrollView>
            </View>
        </KeyboardAvoidingView>
    );
}
