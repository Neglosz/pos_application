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
      Alert.alert('ผิดพลาด', 'โปรดตรวจสอบและกรอกข้อมูลให้ครบถ้วน');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('ผิดพลาด', 'รหัสผ่านไม่ตรงกัน');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('ผิดพลาด', 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      Alert.alert('สำเร็จ', 'เปลี่ยนรหัสผ่านสำเร็จ', [
        {
          text: 'OK',
          onPress: () => {
            // Sign out to ensure clean state or just navigate
            // Usually good practice to force re-login or just go to home
            // But here we might want to go to SignIn or Home depending on flow
            // If update is successful, user is logged in.
            onNavigateToSignIn();
          },
        },
      ]);
    } catch (error) {
      Alert.alert('ผิดพลาด', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#52616B' }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Image
          style={{ width: 100, height: 100 }}
          source={{ uri: "https://i.postimg.cc/CMk3WcZs/Chat-GPT-Image-Jan-5-2026-12-04-50-AM-Photoroom.png" }}
        />
        <Text style={{ fontSize: 30, fontWeight: '700', color: '#fff', marginTop: 10 }}>Zippy Till</Text>
        <Text style={{ fontSize: 16, color: '#fff' }}>ระบบจัดการร้านค้า</Text>
      </View>

      <View style={{
        flex: 2,
        backgroundColor: '#fff',
        borderTopLeftRadius: 25,
        borderTopRightRadius: 25,
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
            <Text style={{ fontWeight: '600', marginBottom: 8 }}>รหัสผ่านใหม่</Text>
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
                style={{ flex: 1, fontSize: 16 }}
                placeholder="รหัสผ่านใหม่"
                secureTextEntry
                value={newPassword}
                onChangeText={setNewPassword}
                autoCapitalize="none"
              />
            </View>
          </View>

          <View style={{ marginBottom: 30 }}>
            <Text style={{ fontWeight: '600', marginBottom: 8 }}>ยืนยันรหัสผ่าน</Text>
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
                style={{ flex: 1, fontSize: 16 }}
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
              backgroundColor: '#1E2022',
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
            <Text style={{ color: '#666', fontWeight: '600' }}>ยกเลิก</Text>
          </TouchableOpacity>

        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}
