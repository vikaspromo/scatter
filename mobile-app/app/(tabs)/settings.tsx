import { StyleSheet } from 'react-native';
import { View } from '@/components/Themed';

export default function SettingsScreen() {
  return (
    <View style={styles.container} />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
});
