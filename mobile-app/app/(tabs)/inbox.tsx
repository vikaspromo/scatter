import { StyleSheet, ActivityIndicator, FlatList } from 'react-native';
import { Text, View } from '@/components/Themed';
import ActionableItemCard from '@/components/ActionableItemCard';
import { fetchInboxItems, updateUserItemStatus } from '@/lib/supabase';
import { getDeviceId } from '@/lib/deviceId';
import { InboxItem as InboxItemType } from '@/types';
import { useState, useCallback, useEffect } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFocusEffect } from '@react-navigation/native';

export default function InboxScreen() {
  const [items, setItems] = useState<InboxItemType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);

  useEffect(() => {
    getDeviceId().then(setDeviceId);
  }, []);

  const loadItems = useCallback(async () => {
    if (!deviceId) return;

    try {
      setError(null);
      const data = await fetchInboxItems(deviceId);
      setItems(data);
    } catch (err) {
      console.error('Failed to load items:', err);
      setError('Failed to load items.');
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  useEffect(() => {
    if (deviceId) {
      loadItems();
    }
  }, [deviceId, loadItems]);

  // Reload items when tab becomes focused
  useFocusEffect(
    useCallback(() => {
      if (deviceId) {
        loadItems();
      }
    }, [deviceId, loadItems])
  );

  const handleArchive = async (itemId: string) => {
    if (!deviceId) return;

    // Optimistically remove from list
    setItems(items.filter(item => item.id !== itemId));

    try {
      await updateUserItemStatus(deviceId, itemId, 'archived');
    } catch (err) {
      console.error('Failed to archive item:', err);
      // Could restore item here if needed
    }
  };

  const handleRemind = async (itemId: string) => {
    if (!deviceId) return;

    // Optimistically remove from list
    setItems(items.filter(item => item.id !== itemId));

    try {
      await updateUserItemStatus(deviceId, itemId, 'remind');
    } catch (err) {
      console.error('Failed to set reminder:', err);
      // Could restore item here if needed
    }
  };

  if (loading) {
    return (
      <View style={styles.emptyContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.emptySubtitle}>Loading items...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.emptyContainer}>
        <FontAwesome name="exclamation-circle" size={64} color="#FF3B30" />
        <Text style={styles.emptyTitle}>Error</Text>
        <Text style={styles.emptySubtitle}>{error}</Text>
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <FontAwesome name="check-circle" size={64} color="#4CAF50" />
        <Text style={styles.emptyTitle}>All caught up!</Text>
        <Text style={styles.emptySubtitle}>
          No new items to review. Check back later.
        </Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ActionableItemCard
            item={item}
            onArchive={() => handleArchive(item.id)}
            onRemind={() => handleRemind(item.id)}
            showDateBadge={true}
          />
        )}
        contentContainerStyle={styles.listContent}
      />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  listContent: {
    paddingVertical: 8,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: '#f5f5f5',
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
});
