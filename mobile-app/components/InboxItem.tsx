import React, { useState } from 'react';
import { StyleSheet, View as RNView, ScrollView, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { Text, View } from '@/components/Themed';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { InboxItem as InboxItemType } from '@/types';
import { fontSize, fontWeight, lineHeight, colors } from '@/constants/Typography';

interface Props {
  item: InboxItemType;
}

export function formatEventDate(dateStr: string | null): string {
  if (!dateStr) return '';

  const date = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.getTime() === today.getTime()) {
    return 'Happening today';
  } else if (date.getTime() === tomorrow.getTime()) {
    return 'Happening tomorrow';
  }

  const daysUntil = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  // More than a week away - use "Mon DD" format
  if (daysUntil > 7) {
    return `Happening on ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  }

  // 2-7 days away - show "on {day}"
  if (daysUntil >= 2) {
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
    return `Happening on ${dayName}`;
  }

  return `Happening on ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

function formatEmailDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function parseSenderName(fromAddress: string): string {
  // Handle "Name <email>" format
  const match = fromAddress.match(/^"?([^"<]+)"?\s*<.*>$/);
  let name = match ? match[1].trim() : null;

  // Handle plain email - extract part before @
  if (!name) {
    const emailMatch = fromAddress.match(/^([^@]+)@/);
    name = emailMatch ? emailMatch[1] : fromAddress;
  }

  // Strip (DCPS) specifically
  name = name.replace(/\s*\(DCPS\)\s*/gi, ' ').trim();

  // Reformat "Last, First" to "First Last"
  const lastFirstMatch = name.match(/^([^,]+),\s*(.+)$/);
  if (lastFirstMatch) {
    name = `${lastFirstMatch[2]} ${lastFirstMatch[1]}`;
  }

  return name;
}

function parseEmailAddress(fromAddress: string): string {
  // Extract email from "Name <email>" format
  const match = fromAddress.match(/<([^>]+)>/);
  if (match) {
    return match[1];
  }
  // If no angle brackets, assume it's just the email
  return fromAddress;
}

export default function InboxItem({ item }: Props) {
  const emailDateDisplay = formatEmailDate(item.email_date);
  const senderName = parseSenderName(item.from_address);
  const emailAddress = parseEmailAddress(item.from_address);

  const [showScrollHint, setShowScrollHint] = useState(false);
  const [contentHeight, setContentHeight] = useState(0);
  const [scrollViewHeight, setScrollViewHeight] = useState(0);

  const isScrollable = contentHeight > scrollViewHeight;
  const shouldShowHint = isScrollable && showScrollHint;

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset } = event.nativeEvent;
    // Hide hint once user scrolls down a bit
    if (contentOffset.y > 10) {
      setShowScrollHint(false);
    }
  };

  const handleContentSizeChange = (_width: number, height: number) => {
    setContentHeight(height);
    // Show hint when we know content is larger than container
    if (height > scrollViewHeight && scrollViewHeight > 0) {
      setShowScrollHint(true);
    }
  };

  const handleLayout = (event: any) => {
    const { height } = event.nativeEvent.layout;
    setScrollViewHeight(height);
    // Show hint when we know content is larger than container
    if (contentHeight > height && contentHeight > 0) {
      setShowScrollHint(true);
    }
  };

  return (
    <View style={styles.container}>
      {/* Email metadata */}
      <RNView style={styles.header}>
        <Text style={styles.metaText}>From {senderName}</Text>
      </RNView>

      {/* Content - school's exact message */}
      <ScrollView
        style={styles.contentScroll}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        onContentSizeChange={handleContentSizeChange}
        onLayout={handleLayout}
        scrollEventThrottle={16}
      >
        <Text style={styles.content}>{item.content}</Text>

        {/* Source email footer - scrolls with content */}
        <RNView style={styles.footer}>
          <Text style={styles.footerText}>{emailAddress}</Text>
          <Text style={styles.footerText}>Subject: "{item.subject}"</Text>
          <Text style={styles.footerText}>Sent {emailDateDisplay}</Text>
        </RNView>
      </ScrollView>

      {/* Scroll hint - shows when content overflows */}
      {shouldShowHint && (
        <RNView style={styles.scrollHint}>
          <FontAwesome name="chevron-down" size={12} color="#999" />
          <Text style={styles.scrollHintText}>Scroll for more</Text>
        </RNView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    maxHeight: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  metaText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.textSecondary,
    flex: 1,
  },
  contentScroll: {
    flexGrow: 0,
  },
  content: {
    fontSize: fontSize.base,
    color: colors.textPrimary,
    lineHeight: lineHeight.base,
  },
  footer: {
    marginTop: 32,
    alignItems: 'flex-end',
  },
  footerText: {
    fontSize: 13,
    fontStyle: 'italic',
    color: colors.textSecondary,
    lineHeight: 18,
    textAlign: 'right',
  },
  scrollHint: {
    alignItems: 'center',
    paddingTop: 12,
    gap: 4,
  },
  scrollHintText: {
    fontSize: 12,
    color: '#999',
  },
});
