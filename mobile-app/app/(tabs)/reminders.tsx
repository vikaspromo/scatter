import { StyleSheet, SectionList, ActivityIndicator, View as RNView } from 'react-native';
import { Text, View } from '@/components/Themed';
import { fetchRemindedItems, updateUserItemStatus } from '@/lib/supabase';
import { getDeviceId } from '@/lib/deviceId';
import { InboxItem as InboxItemType } from '@/types';
import { useState, useCallback, useEffect, useMemo } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useFocusEffect } from '@react-navigation/native';
import { formatSectionHeader } from '@/lib/dateUtils';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import ActionableItemCard from '@/components/ActionableItemCard';

interface Section {
  title: string;
  date: string | null;
  data: InboxItemType[];
}

function groupByDate(items: InboxItemType[]): Section[] {
  const groups: { [key: string]: InboxItemType[] } = {};

  items.forEach(item => {
    const key = item.date_start || '__no_date__';
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(item);
  });

  const sections: Section[] = Object.entries(groups).map(([key, data]) => ({
    title: formatSectionHeader(key === '__no_date__' ? null : key),
    date: key === '__no_date__' ? null : key,
    data,
  }));

  sections.sort((a, b) => {
    if (a.date === null && b.date === null) return 0;
    if (a.date === null) return 1;
    if (b.date === null) return -1;
    return a.date.localeCompare(b.date);
  });

  return sections;
}

function SectionHeader({ title, hasDate }: { title: string; hasDate: boolean }) {
  return (
    <RNView style={styles.sectionHeaderContainer}>
      <RNView style={[styles.sectionHeader, hasDate && styles.sectionHeaderWithDate]}>
        {hasDate && (
          <FontAwesome name="calendar" size={14} color="#FFFFFF" style={styles.sectionIcon} />
        )}
        <Text style={[styles.sectionTitle, hasDate && styles.sectionTitleWithDate]}>{title}</Text>
      </RNView>
    </RNView>
  );
}

export default function RemindersScreen() {
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
      const data = await fetchRemindedItems(deviceId);
      setItems(data);
    } catch (err) {
      console.error('Failed to load reminders:', err);
      setError('Failed to load reminders.');
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  useEffect(() => {
    if (deviceId) {
      loadItems();
    }
  }, [deviceId, loadItems]);

  useFocusEffect(
    useCallback(() => {
      if (deviceId) {
        loadItems();
      }
    }, [deviceId, loadItems])
  );

  const sections = useMemo(() => groupByDate(items), [items]);

  const handleArchive = async (itemId: string) => {
    if (!deviceId) return;

    // Optimistically remove from list
    setItems(items.filter(item => item.id !== itemId));

    try {
      await updateUserItemStatus(deviceId, itemId, 'archived');
    } catch (err) {
      console.error('Failed to archive item:', err);
    }
  };

  const handleRemind = (itemId: string) => {
    // Item is already in reminders, tapping remind just keeps it there
    // No action needed - the item stays in the list
  };

  if (loading) {
    return (
      <View style={styles.emptyContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.emptySubtitle}>Loading reminders...</Text>
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
        <FontAwesome name="bell-o" size={64} color="#ccc" />
        <Text style={styles.emptyTitle}>No reminders</Text>
        <Text style={styles.emptySubtitle}>
          Items you mark "Remind" will appear here
        </Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ActionableItemCard
            item={item}
            onArchive={() => handleArchive(item.id)}
            onRemind={() => handleRemind(item.id)}
            showDateBadge={false}
          />
        )}
        renderSectionHeader={({ section }) => (
          <SectionHeader title={section.title} hasDate={section.date !== null} />
        )}
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled={false}
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
  sectionHeaderContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  sectionHeaderWithDate: {
    backgroundColor: '#FF6D00',
  },
  sectionIcon: {
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
  },
  sectionTitleWithDate: {
    color: '#FFFFFF',
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
    color: '#999',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
  },
});
