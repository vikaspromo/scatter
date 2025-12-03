import React, { useState } from 'react';
import { StyleSheet, View as RNView, ScrollView, NativeSyntheticEvent, NativeScrollEvent, Platform, Linking, Text as RNText } from 'react-native';
import { Text, View, useThemeColor } from '@/components/Themed';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { InboxItem as InboxItemType } from '@/types';
import { fontSize, fontWeight, lineHeight } from '@/constants/Typography';

// Component that renders text with clickable links
function LinkedText({ children, style, linkColor }: { children: string; style?: any; linkColor: string }) {
  // Match URLs: both <url> format and plain URLs
  // This regex matches:
  // 1. <https://...> or <http://...> format
  // 2. Plain https:// or http:// URLs (even when attached to words like "herehttps://...")
  const urlRegex = /(?:<(https?:\/\/[^>]+)>|(https?:\/\/[^\s<]+))/gi;

  const parts: Array<{ type: 'text' | 'link'; content: string; url?: string }> = [];
  let lastIndex = 0;
  let match;

  while ((match = urlRegex.exec(children)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      let textBefore = children.slice(lastIndex, match.index);

      // Check if URL is attached to previous word (no space before it)
      // Add a space to separate "here" from the URL display
      if (textBefore.length > 0 && !/\s$/.test(textBefore)) {
        textBefore += ' ';
      }

      parts.push({ type: 'text', content: textBefore });
    }

    // The URL is either in group 1 (angle bracket format) or group 2 (plain URL)
    const url = match[1] || match[2];
    parts.push({ type: 'link', content: url, url });

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < children.length) {
    let textAfter = children.slice(lastIndex);

    // Check if text immediately follows URL (no space after it)
    // Add a space to separate the URL from following text
    if (parts.length > 0 && parts[parts.length - 1].type === 'link' && textAfter.length > 0 && !/^\s/.test(textAfter)) {
      textAfter = ' ' + textAfter;
    }

    parts.push({ type: 'text', content: textAfter });
  }

  // If no links found, just return plain text
  if (parts.length === 0) {
    return <Text style={style}>{children}</Text>;
  }

  const handlePress = (url: string) => {
    Linking.openURL(url).catch(err => console.error('Failed to open URL:', err));
  };

  return (
    <Text style={style}>
      {parts.map((part, index) => {
        if (part.type === 'link') {
          return (
            <RNText
              key={index}
              style={{ color: linkColor, textDecorationLine: 'underline' }}
              onPress={() => handlePress(part.url!)}
            >
              {part.content}
            </RNText>
          );
        }
        return <RNText key={index}>{part.content}</RNText>;
      })}
    </Text>
  );
}

interface Props {
  item: InboxItemType;
}

// Re-export formatEventDate from dateUtils for backwards compatibility
export { formatEventDate } from '@/lib/dateUtils';

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
  // Theme colors
  const cardBackground = useThemeColor({}, 'cardBackground');
  const textPrimary = useThemeColor({}, 'textPrimary');
  const textSecondary = useThemeColor({}, 'textSecondary');
  const textMuted = useThemeColor({}, 'textMuted');
  const tint = useThemeColor({}, 'tint');

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
    <View style={[styles.container, { backgroundColor: cardBackground }]}>
      {/* Email metadata */}
      <RNView style={styles.header}>
        <Text style={[styles.metaText, { color: textSecondary }]}>From {senderName}</Text>
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
        <LinkedText style={[styles.content, { color: textPrimary }]} linkColor={tint}>{item.content}</LinkedText>

        {/* Source email footer - scrolls with content */}
        <RNView style={styles.footer}>
          <Text style={[styles.footerText, { color: textSecondary }]}>{emailAddress}</Text>
          <Text style={[styles.footerText, { color: textSecondary }]}>Subject: "{item.subject}"</Text>
          <Text style={[styles.footerText, { color: textSecondary }]}>Sent {emailDateDisplay}</Text>
        </RNView>
      </ScrollView>

      {/* Scroll hint - shows when content overflows */}
      {shouldShowHint && (
        <RNView style={styles.scrollHint}>
          <FontAwesome name="chevron-down" size={12} color={textMuted} />
          <Text style={[styles.scrollHintText, { color: textMuted }]}>Scroll for more</Text>
        </RNView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    maxHeight: '100%',
    // Platform-specific shadow styles
    ...Platform.select({
      web: {
        boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.1)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  metaText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    flex: 1,
  },
  contentScroll: {
    flexGrow: 0,
  },
  content: {
    fontSize: fontSize.base,
    lineHeight: lineHeight.base,
  },
  footer: {
    marginTop: 32,
    alignItems: 'flex-end',
  },
  footerText: {
    fontSize: 13,
    fontStyle: 'italic',
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
  },
});
