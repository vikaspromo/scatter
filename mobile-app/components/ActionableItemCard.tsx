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
import { Text, useThemeColor } from '@/components/Themed';
import { Swipeable } from 'react-native-gesture-handler';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { InboxItem as InboxItemType } from '@/types';
import { fontSize, fontWeight, lineHeight } from '@/constants/Typography';
import { formatEventDate } from '@/lib/dateUtils';

interface ActionableItemCardProps {
  item: InboxItemType;
  onArchive: () => void;
  onRemind: () => void;
  showDateBadge?: boolean;
}

// Component that renders text with clickable links
function LinkedText({ children, style, linkColor }: { children: string; style?: any; linkColor: string }) {
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

  // Theme colors
  const cardBackground = useThemeColor({}, 'cardBackground');
  const textPrimary = useThemeColor({}, 'textPrimary');
  const textSecondary = useThemeColor({}, 'textSecondary');
  const textMuted = useThemeColor({}, 'textMuted');
  const border = useThemeColor({}, 'border');
  const tint = useThemeColor({}, 'tint');
  const eventOrange = useThemeColor({}, 'eventOrange');

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
      <RNView style={[styles.leftAction, { backgroundColor: tint }]}>
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
      <RNView style={[styles.rightAction, { backgroundColor: textSecondary }]}>
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
        style={[styles.container, { backgroundColor: cardBackground }]}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.9}
      >
        {/* Header row: sender, date badge */}
        <RNView style={styles.header}>
          <RNView style={styles.headerLeft}>
            <Text style={[styles.senderName, { color: textPrimary }]}>{senderName}</Text>
          </RNView>

          {showDateBadge && eventDate && (
            <RNView style={[styles.dateBadge, { backgroundColor: eventOrange }]}>
              <FontAwesome name="calendar" size={10} color="#fff" style={styles.dateBadgeIcon} />
              <Text style={styles.dateBadgeText}>{eventDate}</Text>
            </RNView>
          )}
        </RNView>

        {/* Email source line */}
        <Text style={[styles.emailSource, { color: textSecondary }]} numberOfLines={2}>
          Via email "{item.subject}" sent on {emailDate}
        </Text>

        {/* Content */}
        {expanded ? (
          <LinkedText style={[styles.contentExpanded, { color: textPrimary }]} linkColor={tint}>{item.content}</LinkedText>
        ) : (
          <RNView>
            <Text style={[styles.contentCollapsed, { color: textPrimary }]} numberOfLines={3}>
              {item.content}
            </Text>
            <RNView style={styles.expandHint}>
              <FontAwesome name="chevron-down" size={12} color={textMuted} />
              <Text style={[styles.expandHintText, { color: textMuted }]}>Tap to see more</Text>
            </RNView>
          </RNView>
        )}

        {/* Action buttons */}
        <RNView style={[styles.bottomActions, { borderTopColor: border }]}>
          <TouchableOpacity
            style={styles.bottomActionButton}
            onPress={(e) => {
              e.stopPropagation();
              onArchive();
            }}
          >
            <FontAwesome name="archive" size={16} color={textSecondary} />
            <Text style={[styles.bottomActionText, { color: textSecondary }]}>Archive</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.bottomActionButton, styles.remindActionButton]}
            onPress={(e) => {
              e.stopPropagation();
              onRemind();
            }}
          >
            <FontAwesome name="bell" size={16} color={tint} />
            <Text style={[styles.bottomActionText, { color: tint }]}>Add to reminders</Text>
          </TouchableOpacity>
        </RNView>
      </TouchableOpacity>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  container: {
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
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
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
    lineHeight: lineHeight.base,
  },
  contentExpanded: {
    fontSize: fontSize.base,
    lineHeight: lineHeight.base,
  },
  emailSource: {
    fontSize: 13,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  expandHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    gap: 4,
  },
  expandHintText: {
    fontSize: 12,
  },
  bottomActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
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
    fontWeight: fontWeight.medium,
  },
  leftAction: {
    justifyContent: 'center',
    marginVertical: 6,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    marginLeft: 16,
  },
  rightAction: {
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
