import React from 'react';
import { StyleSheet, TouchableOpacity, View as RNView } from 'react-native';
import { Text, View } from '@/components/Themed';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { InboxItem as InboxItemType, TriageDecision } from '@/types';

interface Props {
  item: InboxItemType;
  onTriage: (decision: TriageDecision) => void;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';

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
  if (daysUntil > 0 && daysUntil <= 7) {
    return `In ${daysUntil} days`;
  }

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatEmailDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function InboxItem({ item, onTriage }: Props) {
  const itemDateDisplay = formatDate(item.date);
  const emailDateDisplay = formatEmailDate(item.email_date);

  return (
    <View style={styles.container}>
      {/* Header with email date and optional item date */}
      <RNView style={styles.header}>
        <RNView style={styles.iconContainer}>
          <FontAwesome name="envelope-o" size={16} color="#007AFF" />
        </RNView>
        <RNView style={styles.metadata}>
          <RNView style={styles.metaBadge}>
            <Text style={styles.metaText}>{emailDateDisplay}</Text>
          </RNView>
          {itemDateDisplay && (
            <RNView style={[styles.metaBadge, styles.dateBadge]}>
              <FontAwesome name="calendar" size={10} color="#E65100" style={styles.dateIcon} />
              <Text style={[styles.metaText, styles.dateText]}>{itemDateDisplay}</Text>
            </RNView>
          )}
        </RNView>
      </RNView>

      {/* Content - school's exact message */}
      <Text style={styles.content}>{item.content}</Text>

      {/* Triage buttons */}
      <RNView style={styles.buttons}>
        <TouchableOpacity
          style={[styles.button, styles.doneButton]}
          onPress={() => onTriage('done')}
        >
          <FontAwesome name="check" size={14} color="#666" style={styles.buttonIcon} />
          <Text style={styles.doneText}>Done</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.remindMeButton]}
          onPress={() => onTriage('remind')}
        >
          <FontAwesome name="bell" size={14} color="#fff" style={styles.buttonIcon} />
          <Text style={styles.remindMeText}>Save & Remind</Text>
        </TouchableOpacity>
      </RNView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#007AFF15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  metadata: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
  },
  metaBadge: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#666',
  },
  dateBadge: {
    backgroundColor: '#FFF3E0',
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateIcon: {
    marginRight: 4,
  },
  dateText: {
    color: '#E65100',
  },
  content: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
  },
  buttons: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 8,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  buttonIcon: {
    marginRight: 4,
  },
  doneButton: {
    backgroundColor: '#f5f5f5',
  },
  doneText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  remindMeButton: {
    backgroundColor: '#007AFF',
  },
  remindMeText: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '600',
  },
});
