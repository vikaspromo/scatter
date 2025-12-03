import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  View as RNView,
  TouchableOpacity,
  Platform,
  Animated,
  Linking,
  Text as RNText,
} from 'react-native';
import { Text } from '@/components/Themed';
import { Swipeable } from 'react-native-gesture-handler';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { InboxItem as InboxItemType } from '@/types';
import { fontSize, fontWeight, lineHeight, colors } from '@/constants/Typography';
import { formatEventDate } from '@/lib/dateUtils';

interface ActionableItemCardProps {
  item: InboxItemType;
  onArchive: () => void;
  onRemind: () => void;
  showDateBadge?: boolean;
}

// Component that renders text with clickable links
function LinkedText({ children, style }: { children: string; style?: any }) {
  const urlRegex = /(?:<(https?:\/\/[^>]+)>|(https?:\/\/[^\s<]+))/gi;

  const parts: Array<{ type: 'text' | 'link'; content: string; url?: string }> = [];
  let lastIndex = 0;
  let match;

  while ((match = urlRegex.exec(children)) !== null) {
    if (match.index > lastIndex) {
      let textBefore = children.slice(lastIndex, match.index);
      if (textBefore.length > 0 && !/\s$/.test(textBefore)) {
        textBefore += ' ';
      }
      parts.push({ type: 'text', content: textBefore });
    }

    const url = match[1] || match[2];
    parts.push({ type: 'link', content: url, url });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < children.length) {
    let textAfter = children.slice(lastIndex);
    if (parts.length > 0 && parts[parts.length - 1].type === 'link' && textAfter.length > 0 && !/^\s/.test(textAfter)) {
      textAfter = ' ' + textAfter;
    }
    parts.push({ type: 'text', content: textAfter });
  }

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
              style={styles.link}
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

function parseSenderName(fromAddress: string): string {
  const match = fromAddress.match(/^"?([^"<]+)"?\s*<.*>$/);
  let name = match ? match[1].trim() : null;

  if (!name) {
    const emailMatch = fromAddress.match(/^([^@]+)@/);
    name = emailMatch ? emailMatch[1] : fromAddress;
  }

  name = name.replace(/\s*\(DCPS\)\s*/gi, ' ').trim();

  const lastFirstMatch = name.match(/^([^,]+),\s*(.+)$/);
  if (lastFirstMatch) {
    name = `${lastFirstMatch[2]} ${lastFirstMatch[1]}`;
  }

  return name;
}

function formatEmailDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function ActionableItemCard({
  item,
  onArchive,
  onRemind,
  showDateBadge = true,
}: ActionableItemCardProps) {
  const [expanded, setExpanded] = useState(false);
  const swipeableRef = useRef<Swipeable>(null);

  const senderName = parseSenderName(item.from_address);
  const emailDate = formatEmailDate(item.email_date);
  const eventDate = formatEventDate(item.date_start, item.date_end);

  const handleArchive = () => {
    swipeableRef.current?.close();
    onArchive();
  };

  const handleRemind = () => {
    swipeableRef.current?.close();
    onRemind();
  };

  const renderLeftActions = (
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) => {
    const trans = dragX.interpolate({
      inputRange: [0, 50, 100],
      outputRange: [-20, 0, 0],
    });

    return (
      <RNView style={styles.leftAction}>
        <Animated.View style={[styles.actionContent, { transform: [{ translateX: trans }] }]}>
          <FontAwesome name="bell" size={20} color="#fff" />
          <Text style={styles.actionText}>Remind</Text>
        </Animated.View>
      </RNView>
    );
  };

  const renderRightActions = (
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) => {
    const trans = dragX.interpolate({
      inputRange: [-100, -50, 0],
      outputRange: [0, 0, 20],
    });

    return (
      <RNView style={styles.rightAction}>
        <Animated.View style={[styles.actionContent, { transform: [{ translateX: trans }] }]}>
          <FontAwesome name="archive" size={20} color="#fff" />
          <Text style={styles.actionText}>Archive</Text>
        </Animated.View>
      </RNView>
    );
  };

  return (
    <Swipeable
      ref={swipeableRef}
      renderLeftActions={renderLeftActions}
      renderRightActions={renderRightActions}
      onSwipeableOpen={(direction) => {
        if (direction === 'left') {
          handleRemind();
        } else if (direction === 'right') {
          handleArchive();
        }
      }}
      overshootLeft={false}
      overshootRight={false}
    >
      <TouchableOpacity
        style={styles.container}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.9}
      >
        {/* Header row: sender, date badge, action buttons */}
        <RNView style={styles.header}>
          <RNView style={styles.headerLeft}>
            <Text style={styles.senderName}>{senderName}</Text>
          </RNView>

          {showDateBadge && eventDate && (
            <RNView style={styles.dateBadge}>
              <FontAwesome name="calendar" size={10} color="#fff" style={styles.dateBadgeIcon} />
              <Text style={styles.dateBadgeText}>{eventDate}</Text>
            </RNView>
          )}
        </RNView>

        {/* Content */}
        {expanded ? (
          <LinkedText style={styles.contentExpanded}>{item.content}</LinkedText>
        ) : (
          <Text style={styles.contentCollapsed} numberOfLines={3}>
            {item.content}
          </Text>
        )}

        {/* Footer: email source */}
        <Text style={styles.footer} numberOfLines={2}>
          Via email "{item.subject}" sent on {emailDate}
        </Text>

        {/* Action buttons */}
        <RNView style={styles.bottomActions}>
          <TouchableOpacity
            style={styles.bottomActionButton}
            onPress={(e) => {
              e.stopPropagation();
              onArchive();
            }}
          >
            <FontAwesome name="archive" size={16} color="#8E8E93" />
            <Text style={styles.bottomActionText}>Archive</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.bottomActionButton, styles.remindActionButton]}
            onPress={(e) => {
              e.stopPropagation();
              onRemind();
            }}
          >
            <FontAwesome name="bell" size={16} color="#007AFF" />
            <Text style={[styles.bottomActionText, styles.remindActionText]}>Add to reminders</Text>
          </TouchableOpacity>
        </RNView>
      </TouchableOpacity>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.cardBackground,
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 12,
    padding: 14,
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
    marginBottom: 8,
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  senderName: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6D00',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 8,
  },
  dateBadgeIcon: {
    marginRight: 4,
  },
  dateBadgeText: {
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    color: '#fff',
  },
  contentCollapsed: {
    fontSize: fontSize.base,
    color: colors.textPrimary,
    lineHeight: lineHeight.base,
  },
  contentExpanded: {
    fontSize: fontSize.base,
    color: colors.textPrimary,
    lineHeight: lineHeight.base,
  },
  footer: {
    fontSize: 13,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 8,
  },
  bottomActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  bottomActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    gap: 5,
  },
  remindActionButton: {},
  bottomActionText: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: fontWeight.medium,
  },
  remindActionText: {
    color: '#007AFF',
  },
  link: {
    color: '#007AFF',
    textDecorationLine: 'underline',
  },
  leftAction: {
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    marginVertical: 6,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    marginLeft: 16,
  },
  rightAction: {
    backgroundColor: '#8E8E93',
    justifyContent: 'center',
    alignItems: 'flex-end',
    marginVertical: 6,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    marginRight: 16,
  },
  actionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 8,
  },
  actionText: {
    color: '#fff',
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },
});
