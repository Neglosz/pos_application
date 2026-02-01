import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function SaleScreen() {
    return (
        <View style={styles.container}>
            <MaterialCommunityIcons name="robot" size={80} color="#ddd" />
            <Text style={styles.text}>AI Feature (Coming Soon)</Text>
            <Text style={styles.subText}>หน้านี้สำหรับฟีเจอร์ AI ในอนาคต</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f9fafb',
    },
    text: {
        marginTop: 20,
        fontSize: 18,
        fontWeight: 'bold',
        color: '#999',
    },
    subText: {
        marginTop: 10,
        fontSize: 14,
        color: '#ccc',
    }
});