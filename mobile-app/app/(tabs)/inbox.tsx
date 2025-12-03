import { StyleSheet, ActivityIndicator, TouchableOpacity, View as RNView } from 'react-native';
import { Text, View } from '@/components/Themed';
import InboxItem, { formatEventDate } from '@/components/InboxItem';
import { fetchInboxItems, updateUserItemStatus } from '@/lib/supabase';
import { getDeviceId } from '@/lib/deviceId';
import { InboxItem as InboxItemType, TriageDecision } from '@/types';
import { useState, useCallback, useEffect } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function InboxScreen() {
  const [items, setItems] = useState<InboxItemType[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [viewHistory, setViewHistory] = useState<InboxItemType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

  // Initialize device ID on mount
  useEffect(() => {
    getDeviceId().then(setDeviceId);
  }, []);

  const loadItems = useCallback(async () => {
    if (!deviceId) return;

    try {
      setError(null);
      const data = await fetchInboxItems(deviceId);
      setItems(data);
      setCurrentIndex(0);
      setViewHistory([]);
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

  const currentItem = items[currentIndex];
  const canUndo = viewHistory.length > 0;

  const undo = () => {
    if (viewHistory.length > 0) {
      const newHistory = [...viewHistory];
      const prevItem = newHistory.pop()!;
      setViewHistory(newHistory);
      // Restore the item to the list and go back to it
      setItems([...items.slice(0, currentIndex), prevItem, ...items.slice(currentIndex)]);
      setCurrentIndex(currentIndex);
    }
  };

  const handleTriage = async (decision: TriageDecision) => {
    if (!currentItem || !deviceId) return;

    try {
      await updateUserItemStatus(deviceId, currentItem.id, decision);
    } catch (err: any) {
      console.error('Failed to update item status:', err?.message || err);
      // Don't block the UI - item is still removed locally
    }

    // Save current item to history for undo
    setViewHistory([...viewHistory, currentItem]);

    // Remove current item from list
    const newItems = items.filter((_, idx) => idx !== currentIndex);
    setItems(newItems);

    // Keep currentIndex the same (will show next item) unless we're at the end
    if (currentIndex >= newItems.length) {
      setCurrentIndex(Math.max(0, newItems.length - 1));
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
      {/* Header */}
      <RNView style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={[styles.navButton, !canUndo && styles.navButtonDisabled]}
          onPress={undo}
          disabled={!canUndo}
        >
          <FontAwesome name="undo" size={20} color={canUndo ? '#333' : '#ccc'} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Inbox</Text>
        <RNView style={styles.navButton} />
      </RNView>

      {/* Event date banner - above card */}
      {currentItem.date_start && formatEventDate(currentItem.date_start, currentItem.date_end) && (
        <RNView style={styles.eventDateBannerContainer}>
          <RNView style={styles.eventDateBanner}>
            <FontAwesome name="calendar" size={14} color="#FFFFFF" style={styles.eventDateIcon} />
            <Text style={styles.eventDateText}>{formatEventDate(currentItem.date_start, currentItem.date_end)}</Text>
          </RNView>
        </RNView>
      )}

      {/* Card */}
      <RNView style={styles.cardContainer}>
        <InboxItem item={currentItem} />
      </RNView>

      {/* Action Bar */}
      <RNView style={[styles.actionBar, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleTriage('done')}
        >
          <RNView style={styles.actionIconContainer}>
            <FontAwesome name="times" size={20} color="#999" />
          </RNView>
          <Text style={styles.actionLabel}>Done</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleTriage('remind')}
        >
          <RNView style={[styles.actionIconContainer, styles.keepIconContainer]}>
            <FontAwesome name="check" size={20} color="#fff" />
          </RNView>
          <Text style={styles.actionLabel}>Remind</Text>
        </TouchableOpacity>
      </RNView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  navButton: {
    padding: 8,
  },
  navButtonDisabled: {
    opacity: 0.3,
  },
  eventDateBannerContainer: {
    paddingHorizontal: 16,
    marginTop: 16,
  },
  eventDateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#FF6D00',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  eventDateIcon: {
    marginRight: 8,
  },
  eventDateText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cardContainer: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingVertical: 16,
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: 16,
    paddingHorizontal: 32,
  },
  actionButton: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  actionIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: '#999',
  },
  keepIconContainer: {
    backgroundColor: '#007AFF',
    borderWidth: 0,
  },
  actionLabel: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
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
