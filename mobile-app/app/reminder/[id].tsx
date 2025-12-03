import { StyleSheet, TouchableOpacity, View as RNView, Platform, ActivityIndicator } from 'react-native';
import { Text, View } from '@/components/Themed';
import { useLocalSearchParams, router } from 'expo-router';
import { useState, useEffect } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import InboxItem, { formatEventDate } from '@/components/InboxItem';
import { supabase, updateUserItemStatus } from '@/lib/supabase';
import { getDeviceId } from '@/lib/deviceId';
import { InboxItem as InboxItemType } from '@/types';

export default function ReminderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [item, setItem] = useState<InboxItemType | null>(null);
  const [loading, setLoading] = useState(true);
  const [deviceId, setDeviceId] = useState<string | null>(null);

  useEffect(() => {
    getDeviceId().then(setDeviceId);
  }, []);

  useEffect(() => {
    async function fetchItem() {
      if (!id) return;

      const { data, error } = await supabase
        .from('items')
        .select(`
          id,
          email_id,
          content,
          date_start,
          date_end,
          created_at,
          is_current,
          superseded_by,
          emails(date, from_address, subject)
        `)
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error fetching item:', error);
        setLoading(false);
        return;
      }

      if (data) {
        setItem({
          id: data.id,
          email_id: data.email_id,
          content: data.content,
          date_start: data.date_start,
          date_end: data.date_end,
          created_at: data.created_at,
          is_current: data.is_current,
          superseded_by: data.superseded_by,
          email_date: data.emails?.date || data.created_at,
          from_address: data.emails?.from_address || '',
          subject: data.emails?.subject || '',
        });
      }
      setLoading(false);
    }

    fetchItem();
  }, [id]);

  const handleDone = async () => {
    if (!deviceId || !id) return;

    try {
      await updateUserItemStatus(deviceId, id, 'done');
      router.back();
    } catch (err) {
      console.error('Failed to mark as done:', err);
    }
  };

  const handleKeep = () => {
    router.back();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!item) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Item not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <RNView style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <FontAwesome name="chevron-left" size={20} color="#007AFF" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reminder</Text>
        <RNView style={styles.headerSpacer} />
      </RNView>

      {/* Event date banner */}
      {item.date_start && formatEventDate(item.date_start, item.date_end) && (
        <RNView style={styles.eventDateBanner}>
          <FontAwesome name="calendar" size={14} color="#E65100" style={styles.eventDateIcon} />
          <Text style={styles.eventDateText}>{formatEventDate(item.date_start, item.date_end)}</Text>
        </RNView>
      )}

      {/* Full Card */}
      <RNView style={styles.cardContainer}>
        <InboxItem item={item} />
      </RNView>

      {/* Action Bar */}
      <RNView style={[styles.actionBar, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity style={styles.actionButton} onPress={handleDone}>
          <RNView style={styles.actionIconContainer}>
            <FontAwesome name="times" size={20} color="#999" />
          </RNView>
          <Text style={styles.actionLabel}>Done</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={handleKeep}>
          <RNView style={[styles.actionIconContainer, styles.keepIconContainer]}>
            <FontAwesome name="check" size={20} color="#fff" />
          </RNView>
          <Text style={styles.actionLabel}>Keep</Text>
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    marginLeft: -8,
  },
  backText: {
    fontSize: 17,
    color: '#007AFF',
    marginLeft: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  headerSpacer: {
    width: 60,
  },
  cardContainer: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingVertical: 16,
  },
  eventDateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 8,
  },
  eventDateIcon: {
    marginRight: 8,
  },
  eventDateText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#E65100',
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: 16,
    paddingHorizontal: 32,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
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
});
