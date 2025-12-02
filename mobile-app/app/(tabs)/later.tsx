import { StyleSheet, FlatList, TouchableOpacity, View as RNView } from 'react-native';
import { Text, View } from '@/components/Themed';
import { mockMaybeLaterItems } from '@/data/mockData';
import { InboxItem as InboxItemType, TriageDecision } from '@/types';
import { useState } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface LaterItemProps {
  item: InboxItemType;
  onRemindMe: () => void;
  onDismiss: () => void;
}

function LaterItem({ item, onRemindMe, onDismiss }: LaterItemProps) {
  const dateDisplay = formatDate(item.date);

  return (
    <View style={styles.itemContainer}>
      <RNView style={styles.itemContent}>
        <RNView style={styles.itemHeader}>
          <FontAwesome
            name={item.itemType === 'task' ? 'check-square-o' : 'calendar'}
            size={16}
            color="#666"
          />
          <Text style={styles.itemTitle} numberOfLines={1}>
            {item.title}
          </Text>
        </RNView>
        {dateDisplay && <Text style={styles.itemDate}>{dateDisplay}</Text>}
      </RNView>
      <RNView style={styles.itemActions}>
        <TouchableOpacity style={styles.actionButton} onPress={onRemindMe}>
          <FontAwesome name="bell" size={16} color="#007AFF" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={onDismiss}>
          <FontAwesome name="times" size={16} color="#999" />
        </TouchableOpacity>
      </RNView>
    </View>
  );
}

export default function LaterScreen() {
  const [items, setItems] = useState<InboxItemType[]>(mockMaybeLaterItems);

  const handleRemindMe = (itemId: string) => {
    console.log(`Promote to remind_me: ${itemId}`);
    setItems((prev) => prev.filter((item) => item.id !== itemId));
    // TODO: Create notification for this item
  };

  const handleDismiss = (itemId: string) => {
    console.log(`Dismiss: ${itemId}`);
    setItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  if (items.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <FontAwesome name="clock-o" size={64} color="#ccc" />
        <Text style={styles.emptyTitle}>Nothing here</Text>
        <Text style={styles.emptySubtitle}>
          Items you mark "Maybe later" will appear here
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
          <LaterItem
            item={item}
            onRemindMe={() => handleRemindMe(item.id)}
            onDismiss={() => handleDismiss(item.id)}
          />
        )}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <Text style={styles.headerText}>
            Tap the bell to set a reminder, or X to dismiss
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
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 10,
    padding: 12,
  },
  itemContent: {
    flex: 1,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
  itemDate: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
    marginLeft: 24,
  },
  itemActions: {
    flexDirection: 'row',
    gap: 4,
  },
  actionButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
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
