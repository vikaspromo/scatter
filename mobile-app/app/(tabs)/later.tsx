import { StyleSheet, SectionList, ActivityIndicator, TouchableOpacity, View as RNView, Platform } from 'react-native';
import { Text, View } from '@/components/Themed';
import { fetchRemindedItems } from '@/lib/supabase';
import { getDeviceId } from '@/lib/deviceId';
import { InboxItem as InboxItemType } from '@/types';
import { useState, useCallback, useEffect, useMemo } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router } from 'expo-router';

function formatSectionHeader(dateStr: string | null): string {
  if (!dateStr) return 'General reminders';
  const date = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.getTime() === today.getTime()) {
    return 'Today';
  } else if (date.getTime() === tomorrow.getTime()) {
    return 'Tomorrow';
  }

  const daysUntil = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntil >= 2 && daysUntil <= 7) {
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
    return `This ${dayName}`;
  }

  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

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

  // Convert to sections and sort by date
  const sections: Section[] = Object.entries(groups).map(([key, data]) => ({
    title: formatSectionHeader(key === '__no_date__' ? null : key),
    date: key === '__no_date__' ? null : key,
    data,
  }));

  // Sort sections: dated items first (by date), then no-date items last
  sections.sort((a, b) => {
    if (a.date === null && b.date === null) return 0;
    if (a.date === null) return 1;
    if (b.date === null) return -1;
    return a.date.localeCompare(b.date);
  });

  return sections;
}

interface ReminderItemProps {
  item: InboxItemType;
  onPress: () => void;
}

function ReminderItemCard({ item, onPress }: ReminderItemProps) {
  return (
    <TouchableOpacity style={styles.itemContainer} onPress={onPress} activeOpacity={0.7}>
      <RNView style={styles.itemContent}>
        <Text style={styles.itemText} numberOfLines={3}>{item.content}</Text>
        <Text style={styles.subjectText} numberOfLines={1}>"{item.subject}"</Text>
      </RNView>
      <FontAwesome name="chevron-right" size={16} color="#ccc" />
    </TouchableOpacity>
  );
}

function SectionHeader({ title, hasDate }: { title: string; hasDate: boolean }) {
  return (
    <RNView style={styles.sectionHeader}>
      {hasDate && (
        <FontAwesome name="calendar" size={14} color="#E65100" style={styles.sectionIcon} />
      )}
      <Text style={[styles.sectionTitle, !hasDate && styles.sectionTitleNoDate]}>{title}</Text>
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

  // Group items by date
  const sections = useMemo(() => groupByDate(items), [items]);

  const handleItemPress = (item: InboxItemType) => {
    router.push(`/reminder/${item.id}`);
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
    <View style={styles.container}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ReminderItemCard
            item={item}
            onPress={() => handleItemPress(item)}
          />
        )}
        renderSectionHeader={({ section }) => (
          <SectionHeader title={section.title} hasDate={section.date !== null} />
        )}
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled={false}
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
    paddingVertical: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
    backgroundColor: '#f5f5f5',
  },
  sectionIcon: {
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#E65100',
  },
  sectionTitleNoDate: {
    color: '#666',
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 12,
    padding: 16,
    ...Platform.select({
      web: {
        boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.1)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
      },
    }),
  },
  itemContent: {
    flex: 1,
    marginRight: 12,
  },
  itemText: {
    fontSize: 15,
    color: '#333',
    lineHeight: 20,
  },
  subjectText: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 8,
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
