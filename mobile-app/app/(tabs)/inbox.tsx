import { StyleSheet, FlatList, RefreshControl, ActivityIndicator } from 'react-native';
import { Text, View } from '@/components/Themed';
import InboxItem from '@/components/InboxItem';
import { fetchInboxItems, updateUserItemStatus } from '@/lib/supabase';
import { InboxItem as InboxItemType, TriageDecision } from '@/types';
import { useState, useCallback, useEffect } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';

export default function InboxScreen() {
  const [items, setItems] = useState<InboxItemType[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchInboxItems();
      setItems(data);
    } catch (err) {
      console.error('Failed to load items:', err);
      setError('Failed to load items. Pull to retry.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadItems();
  }, [loadItems]);

  const handleTriage = async (itemId: string, decision: TriageDecision) => {
    console.log(`Triage: ${itemId} -> ${decision}`);

    // Remove item from inbox view immediately (optimistic update)
    setItems((prev) => prev.filter((item) => item.id !== itemId));

    // TODO: Get actual user ID from auth context
    // For now, using a placeholder - will need auth setup
    const userId = 'placeholder-user-id';

    try {
      await updateUserItemStatus(userId, itemId, decision);
    } catch (err) {
      console.error('Failed to update item status:', err);
      // Could restore item on error, but for now just log
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
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <InboxItem
            item={item}
            onTriage={(decision) => handleTriage(item.id, decision)}
          />
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListHeaderComponent={
          <Text style={styles.headerText}>
            {items.length} item{items.length !== 1 ? 's' : ''} to review
          </Text>
        }
      />
    </View>
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
  headerText: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
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
