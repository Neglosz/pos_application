import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Image, KeyboardAvoidingView, ScrollView, Platform, ActivityIndicator, Alert } from "react-native";
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Feather from '@expo/vector-icons/Feather';
import { supabase } from "../services/supabase";


export default function SignUpScreen({ onSignUp, onNavigateToSignIn }) {
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const [loading, setLoading] = useState(false);

    const handleSignUp = async () => {
        if(!fullName || !email || !password || !confirmPassword){
            Alert.alert('ข้อมูลผิดพลาด','กรุณากรอกข้อมูลให้ครบ');
            return;
        }
        if(password !== confirmPassword){
            Alert.alert('ข้อผิดพลาด','รหัสผ่านไม่ตรงกัน');
            return;
        }
        if(password.length < 6){
            Alert.alert('ข้อผิดพลาด','รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
            return;
        }

        setLoading(true);
        const { data, error } = await supabase.auth.signUp({
            email: email,
            password: password,
        });

        if(error){
            setLoading(false);
            Alert.alert('สมัครสมาชิกไม่สำเร็จ', error.message);
            return;
        }

        if(data.user){
            const {error:updateError} = await supabase
                .from('profiles')
                .update({ full_name: fullName})
                .eq('id', data.user.id);
            if(updateError){
                console.log('Update profile error:',updateError.message);
            }
        }
        setLoading(false);

        Alert.alert('สำเร็จ','สมัครสมาชิกเรียบร้อยแล้ว', [
            { text: 'ตกลง', onPress: () => onSignUp && onSignUp() }
        ]);
    };

    return (
        <KeyboardAvoidingView
            style={{ flex: 1, backgroundColor: '#52616B' }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <View style={{ flex: 1, backgroundColor: '#52616B' }}>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <Image style={{ width: 100, height: 100 }} source={{ uri: "https://i.postimg.cc/CMk3WcZs/Chat-GPT-Image-Jan-5-2026-12-04-50-AM-Photoroom.png" }} />
                    <Text style={{ fontSize: 30, fontWeight: '700', color: '#fff' }}>Zippy Till</Text>
                    <Text style={{ fontSize: 16, color: '#fff' }}>ระบบจัดการร้านค้า</Text>
                </View>
            </View>
            <View style={{ flex: 2.5, backgroundColor: '#fff', borderTopLeftRadius: 25, borderTopRightRadius: 25, shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 8 }}>
                <ScrollView
                    contentContainerStyle={{ flexGrow: 1, paddingBottom: 30 }}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <View style={{ paddingTop: 25, paddingBottom: 15, alignItems: 'center' }}>
                        <Text style={{ fontSize: 20, fontWeight: '800' }}>สมัครสมาชิก</Text>
                        <Text style={{ fontSize: 16, marginTop: 5 }}>สร้างบัญชีใหม่</Text>
                    </View>
                    <View style={{ paddingHorizontal: 20 }}>
                        <View style={{ marginBottom: 15 }}>
                            <Text style={{ fontWeight: '800', marginBottom: 8 }}>ชื่อผู้ใช้</Text>
                            <View style={{ height: 50, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 2, elevation: 3, backgroundColor: 'white', borderRadius: 10, flexDirection: 'row' }}>
                                <View style={{ width: 50, justifyContent: 'center', alignItems: 'center' }}>
                                    <Feather name="user" size={24} color="#989898" />
                                </View>
                                <View style={{ flex: 1, justifyContent: 'center' }}>
                                    <TextInput
                                        placeholder="ชื่อ-นามสกุล"
                                        style={{ fontSize: 16 }}
                                        value={fullName}
                                        onChangeText={setFullName}
                                        editable={!loading}
                                    />
                                </View>
                            </View>
                        </View>
                        <View style={{ marginBottom: 15 }}>
                            <Text style={{ fontWeight: '800', marginBottom: 8 }}>อีเมล</Text>
                            <View style={{ height: 50, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 2, elevation: 3, backgroundColor: 'white', borderRadius: 10, flexDirection: 'row' }}>
                                <View style={{ width: 50, justifyContent: 'center', alignItems: 'center' }}>
                                    <MaterialCommunityIcons name="email-outline" size={24} color="#989898" />
                                </View>
                                <View style={{ flex: 1, justifyContent: 'center' }}>
                                    <TextInput
                                        placeholder="your@email.com"
                                        style={{ fontSize: 16 }}
                                        keyboardType="email-address"
                                        autoCapitalize="none"
                                        value={email}
                                        onChangeText={setEmail}
                                        editable={!loading}
                                    />
                                </View>
                            </View>
                        </View>
                        <View style={{ marginBottom: 15 }}>
                            <Text style={{ fontWeight: '800', marginBottom: 8 }}>รหัสผ่าน</Text>
                            <View style={{ height: 50, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 2, elevation: 3, backgroundColor: 'white', borderRadius: 10, flexDirection: 'row' }}>
                                <View style={{ width: 50, justifyContent: 'center', alignItems: 'center' }}>
                                    <Feather name="lock" size={24} color="#989898" />
                                </View>
                                <View style={{ flex: 1, justifyContent: 'center' }}>
                                    <TextInput
                                        placeholder="••••••••••"
                                        style={{ fontSize: 16 }}
                                        secureTextEntry={!showPassword}
                                        value={password}
                                        onChangeText={setPassword}
                                        editable={!loading}
                                    />
                                </View>
                                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ width: 50, justifyContent: 'center', alignItems: 'center' }}>
                                    <Feather name={showPassword ? "eye" : "eye-off"} size={24} color="#989898" />
                                </TouchableOpacity>
                            </View>
                        </View>
                        <View style={{ marginBottom: 20 }}>
                            <Text style={{ fontWeight: '800', marginBottom: 8 }}>ยืนยันรหัสผ่าน</Text>
                            <View style={{ height: 50, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 2, elevation: 3, backgroundColor: 'white', borderRadius: 10, flexDirection: 'row' }}>
                                <View style={{ width: 50, justifyContent: 'center', alignItems: 'center' }}>
                                    <Feather name="lock" size={24} color="#989898" />
                                </View>
                                <View style={{ flex: 1, justifyContent: 'center' }}>
                                    <TextInput
                                        placeholder="••••••••••"
                                        style={{ fontSize: 16 }}
                                        secureTextEntry={!showConfirmPassword}
                                        value={confirmPassword}
                                        onChangeText={setConfirmPassword}
                                        editable={!loading}
                                    />
                                </View>
                                <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={{ width: 50, justifyContent: 'center', alignItems: 'center' }}>
                                    <Feather name={showConfirmPassword ? "eye" : "eye-off"} size={24} color="#989898" />
                                </TouchableOpacity>
                            </View>
                        </View>
                        <TouchableOpacity 
                            onPress={handleSignUp} 
                            disabled={loading}
                            style={{ height: 50, backgroundColor: '#1E2022', borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff"/>
                            ):(
                                <Text style={{ fontWeight: '700', color: '#fff', fontSize: 18 }}>สมัครสมาชิก</Text>
                            )}
                        </TouchableOpacity>
                        <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
                            <Text>มีบัญชีแล้ว? </Text>
                            <TouchableOpacity onPress={onNavigateToSignIn}>
                                <Text style={{ fontWeight: '700' }}>เข้าสู่ระบบ</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </ScrollView>
            </View>
        </KeyboardAvoidingView>
    )
}