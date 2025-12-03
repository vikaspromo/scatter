import { StyleSheet, ActivityIndicator, FlatList } from 'react-native';
import { Text, View, useThemeColor } from '@/components/Themed';
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

  // Theme colors
  const background = useThemeColor({}, 'background');
  const textSecondary = useThemeColor({}, 'textSecondary');
  const tint = useThemeColor({}, 'tint');
  const errorColor = useThemeColor({}, 'error');
  const success = useThemeColor({}, 'success');

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

  // For swipe gesture - removes card from list
  const handleSwipeBookmark = async (itemId: string) => {
    if (!deviceId) return;

    // Optimistically remove from list
    setItems(items.filter(item => item.id !== itemId));

    try {
      await updateUserItemStatus(deviceId, itemId, 'remind');
    } catch (err) {
      console.error('Failed to bookmark item:', err);
    }
  };

  // For toggle button - keeps card in place
  const handleBookmarkToggle = async (itemId: string, isBookmarked: boolean) => {
    if (!deviceId) return;

    try {
      await updateUserItemStatus(deviceId, itemId, isBookmarked ? 'remind' : 'inbox');
    } catch (err) {
      console.error('Failed to toggle bookmark:', err);
    }
  };

  if (loading) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: background }]}>
        <ActivityIndicator size="large" color={tint} />
        <Text style={styles.emptySubtitle}>Loading items...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: background }]}>
        <FontAwesome name="exclamation-circle" size={64} color={errorColor} />
        <Text style={styles.emptyTitle}>Error</Text>
        <Text style={[styles.emptySubtitle, { color: textSecondary }]}>{error}</Text>
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: background }]}>
        <FontAwesome name="check-circle" size={64} color={success} />
        <Text style={styles.emptyTitle}>All caught up!</Text>
        <Text style={[styles.emptySubtitle, { color: textSecondary }]}>
          No new items to review. Check back later.
        </Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={[styles.container, { backgroundColor: background }]}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ActionableItemCard
            item={item}
            onArchive={() => handleArchive(item.id)}
            onBookmarkToggle={(isBookmarked) => handleBookmarkToggle(item.id, isBookmarked)}
            onSwipeBookmark={() => handleSwipeBookmark(item.id)}
            initialBookmarked={false}
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
  },
  listContent: {
    paddingVertical: 8,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 8,
  },
});
