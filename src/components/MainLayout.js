import React from 'react';
import { View, StyleSheet } from 'react-native';
import TopBar from './TopBar';
import BottomNav from './BottomNav';

export default function MainLayout({ children }) {
    return (
        <View style={styles.container}>
            <TopBar />
            <View style={styles.content}>
                {children}
            </View>
            <BottomNav />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { flex: 1 },
});