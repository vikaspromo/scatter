import { StyleSheet, SectionList, ActivityIndicator, View as RNView } from 'react-native';
import { Text, View, useThemeColor } from '@/components/Themed';
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
  isMajorHeader?: boolean; // For "Coming up" and "Additional bookmarks" headers
  data: InboxItemType[];
}

function groupBookmarks(items: InboxItemType[]): Section[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const sixDaysFromNow = new Date(today);
  sixDaysFromNow.setDate(sixDaysFromNow.getDate() + 6);
  sixDaysFromNow.setHours(23, 59, 59, 999);

  // Split items into "coming up" (with dates in next 7 days) and "additional" (rest)
  const comingUpItems: InboxItemType[] = [];
  const additionalItems: InboxItemType[] = [];

  items.forEach(item => {
    if (item.date_start) {
      const itemDate = new Date(item.date_start);
      if (itemDate >= today && itemDate <= sixDaysFromNow) {
        comingUpItems.push(item);
      } else {
        additionalItems.push(item);
      }
    } else {
      additionalItems.push(item);
    }
  });

  const sections: Section[] = [];

  // "Coming up" section with date sub-groups
  if (comingUpItems.length > 0) {
    // Add major header
    sections.push({
      title: 'Coming up',
      date: null,
      isMajorHeader: true,
      data: [],
    });

    // Group by date
    const dateGroups: { [key: string]: InboxItemType[] } = {};
    comingUpItems.forEach(item => {
      const key = item.date_start!;
      if (!dateGroups[key]) {
        dateGroups[key] = [];
      }
      dateGroups[key].push(item);
    });

    // Sort date groups chronologically and add as sections
    Object.entries(dateGroups)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([dateKey, data]) => {
        sections.push({
          title: formatSectionHeader(dateKey),
          date: dateKey,
          data,
        });
      });
  }

  // "Additional bookmarks" section
  if (additionalItems.length > 0) {
    // Sort by email_date descending (newest first)
    additionalItems.sort((a, b) =>
      new Date(b.email_date).getTime() - new Date(a.email_date).getTime()
    );

    sections.push({
      title: 'Additional bookmarks',
      date: null,
      isMajorHeader: true,
      data: additionalItems,
    });
  }

  return sections;
}

function SectionHeader({
  title,
  hasDate,
  isMajorHeader,
  eventOrange,
  textSecondary,
}: {
  title: string;
  hasDate: boolean;
  isMajorHeader?: boolean;
  eventOrange: string;
  textSecondary: string;
}) {
  // Major headers ("Coming up", "Additional bookmarks") are plain text
  if (isMajorHeader) {
    return (
      <RNView style={styles.majorHeaderContainer}>
        <Text style={[styles.majorHeaderTitle, { color: textSecondary }]}>{title}</Text>
      </RNView>
    );
  }

  return (
    <RNView style={styles.sectionHeaderContainer}>
      <RNView style={[
        styles.sectionHeader,
        hasDate && [styles.sectionHeaderWithDate, { backgroundColor: eventOrange }]
      ]}>
        {hasDate && (
          <FontAwesome name="calendar" size={14} color="#FFFFFF" style={styles.sectionIcon} />
        )}
        <Text style={[
          styles.sectionTitle,
          { color: hasDate ? '#FFFFFF' : textSecondary }
        ]}>{title}</Text>
      </RNView>
    </RNView>
  );
}

export default function RemindersScreen() {
  const [items, setItems] = useState<InboxItemType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);

  // Theme colors
  const background = useThemeColor({}, 'background');
  const textSecondary = useThemeColor({}, 'textSecondary');
  const textMuted = useThemeColor({}, 'textMuted');
  const tint = useThemeColor({}, 'tint');
  const errorColor = useThemeColor({}, 'error');
  const eventOrange = useThemeColor({}, 'eventOrange');

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

  const sections = useMemo(() => groupBookmarks(items), [items]);

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

  // For swipe gesture - removes card from list (un-bookmark)
  const handleSwipeBookmark = async (itemId: string) => {
    if (!deviceId) return;

    // Optimistically remove from list
    setItems(items.filter(item => item.id !== itemId));

    try {
      await updateUserItemStatus(deviceId, itemId, 'inbox');
    } catch (err) {
      console.error('Failed to remove bookmark:', err);
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
        <Text style={[styles.emptySubtitle, { color: textMuted }]}>Loading bookmarks...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: background }]}>
        <FontAwesome name="exclamation-circle" size={64} color={errorColor} />
        <Text style={[styles.emptyTitle, { color: textMuted }]}>Error</Text>
        <Text style={[styles.emptySubtitle, { color: textMuted }]}>{error}</Text>
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: background }]}>
        <FontAwesome name="bookmark-o" size={64} color={textMuted} />
        <Text style={[styles.emptyTitle, { color: textMuted }]}>No bookmarks</Text>
        <Text style={[styles.emptySubtitle, { color: textMuted }]}>
          Additional bookmarks will appear here
        </Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={[styles.container, { backgroundColor: background }]}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ActionableItemCard
            item={item}
            onArchive={() => handleArchive(item.id)}
            onBookmarkToggle={(isBookmarked) => handleBookmarkToggle(item.id, isBookmarked)}
            onSwipeBookmark={() => handleSwipeBookmark(item.id)}
            initialBookmarked={true}
            showDateBadge={false}
          />
        )}
        renderSectionHeader={({ section }) => (
          <SectionHeader
            title={section.title}
            hasDate={section.date !== null}
            isMajorHeader={section.isMajorHeader}
            eventOrange={eventOrange}
            textSecondary={textSecondary}
          />
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
  sectionHeaderWithDate: {},
  sectionIcon: {
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  majorHeaderContainer: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
  },
  majorHeaderTitle: {
    fontSize: 17,
    fontWeight: '600',
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
