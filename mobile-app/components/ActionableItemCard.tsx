import React, { useState, useRef, useMemo } from 'react';
import {
  StyleSheet,
  View as RNView,
  TouchableOpacity,
  Pressable,
  Platform,
  Animated,
  Linking,
  Text as RNText,
  ActionSheetIOS,
  Alert,
} from 'react-native';
import { Text, useThemeColor } from '@/components/Themed';
import { Swipeable } from 'react-native-gesture-handler';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { InboxItem as InboxItemType } from '@/types';
import { fontSize, fontWeight, lineHeight } from '@/constants/Typography';
import { formatEventDate, formatRelativeTime } from '@/lib/dateUtils';

// Approximate character limit for collapsed text (~3 lines)
const COLLAPSED_MAX_CHARS = 180;

interface ActionableItemCardProps {
  item: InboxItemType;
  onArchive: () => void;
  onBookmarkToggle: (isBookmarked: boolean) => void;
  onSwipeBookmark: () => void;  // For swipe gesture (one-way, removes card)
  initialBookmarked?: boolean;
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

type ReminderTime = '8pm_night_before' | '7am_morning' | 'off';

const REMINDER_OPTIONS: { value: ReminderTime; label: string }[] = [
  { value: '8pm_night_before', label: '8pm the night before' },
  { value: '7am_morning', label: '7am that morning' },
  { value: 'off', label: 'Reminder off' },
];

export default function ActionableItemCard({
  item,
  onArchive,
  onBookmarkToggle,
  onSwipeBookmark,
  initialBookmarked = false,
  showDateBadge = true,
}: ActionableItemCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(initialBookmarked);
  const [reminderTime, setReminderTime] = useState<ReminderTime>(
    initialBookmarked && item.date_start ? '8pm_night_before' : 'off'
  );
  const [showReminderMenu, setShowReminderMenu] = useState(false);
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
  const relativeTime = formatRelativeTime(item.email_date);
  const eventDate = formatEventDate(item.date_start, item.date_end);

  // Prepare collapsed content: normalize whitespace, truncate, determine if "more" needed
  const collapsedContent = useMemo(() => {
    // Replace newlines and multiple spaces with single space
    const normalized = item.content.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();

    if (normalized.length <= COLLAPSED_MAX_CHARS) {
      return { text: normalized, needsMore: false };
    }

    // Find word boundary to truncate at
    let truncateAt = COLLAPSED_MAX_CHARS;
    while (truncateAt > 0 && normalized[truncateAt] !== ' ') {
      truncateAt--;
    }
    if (truncateAt === 0) truncateAt = COLLAPSED_MAX_CHARS;

    return { text: normalized.substring(0, truncateAt).trim(), needsMore: true };
  }, [item.content]);

  const handleArchive = () => {
    swipeableRef.current?.close();
    onArchive();
  };

  const handleSwipeBookmark = () => {
    swipeableRef.current?.close();
    onSwipeBookmark();
  };

  const handleBookmarkToggle = () => {
    const newState = !isBookmarked;
    setIsBookmarked(newState);
    onBookmarkToggle(newState);
    // When bookmarking an item with a date, default to 8pm reminder
    if (newState && item.date_start) {
      setReminderTime('8pm_night_before');
    } else if (!newState) {
      setReminderTime('off');
    }
  };

  const showReminderOptions = () => {
    const options = [...REMINDER_OPTIONS.map(o => o.label), 'Cancel'];
    const cancelButtonIndex = options.length - 1;

    if (Platform.OS === 'web') {
      // Web: toggle dropdown menu
      setShowReminderMenu(!showReminderMenu);
    } else if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex,
          title: 'Reminder Time',
        },
        (buttonIndex) => {
          if (buttonIndex !== cancelButtonIndex) {
            setReminderTime(REMINDER_OPTIONS[buttonIndex].value);
          }
        }
      );
    } else {
      // Android fallback using Alert
      Alert.alert(
        'Reminder Time',
        'When would you like to be reminded?',
        [
          ...REMINDER_OPTIONS.map((option) => ({
            text: option.label,
            onPress: () => setReminderTime(option.value),
          })),
          { text: 'Cancel', style: 'cancel' as const },
        ]
      );
    }
  };

  const selectReminderOption = (value: ReminderTime) => {
    setReminderTime(value);
    setShowReminderMenu(false);
  };

  const getReminderLabel = () => {
    if (reminderTime === '8pm_night_before') return '8pm night before';
    if (reminderTime === '7am_morning') return '7am morning of';
    return null;
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
          <FontAwesome name="bookmark" size={20} color="#fff" />
          <Text style={styles.actionText}>Bookmark</Text>
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
      renderLeftActions={isBookmarked ? undefined : renderLeftActions}
      renderRightActions={renderRightActions}
      onSwipeableOpen={(direction) => {
        if (direction === 'left' && !isBookmarked) {
          handleSwipeBookmark();
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

        {/* Content */}
        {expanded ? (
          <LinkedText style={[styles.contentExpanded, { color: textPrimary }]} linkColor={tint}>{item.content}</LinkedText>
        ) : (
          <Text style={[styles.contentCollapsed, { color: textPrimary }]}>
            {collapsedContent.text}
            {collapsedContent.needsMore && (
              <>
                <Text>... </Text>
                <Text style={{ color: textMuted }}>more</Text>
              </>
            )}
          </Text>
        )}

        {/* Email source footer */}
        <Text style={[styles.emailSource, { color: textMuted }]} numberOfLines={1}>
          "{item.subject}" • {relativeTime}
        </Text>

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
          <RNView style={styles.bookmarkContainer}>
            {isBookmarked && item.date_start && (
              <RNView style={styles.reminderWrapper}>
                <Pressable
                  style={({ pressed }) => [
                    styles.notificationButton,
                    pressed && { opacity: 0.6 }
                  ]}
                  onPress={() => {
                    showReminderOptions();
                  }}
                >
                  <FontAwesome
                    name={reminderTime !== 'off' ? 'bell' : 'bell-o'}
                    size={14}
                    color={reminderTime !== 'off' ? tint : textMuted}
                  />
                  {getReminderLabel() && (
                    <Text style={[styles.notificationText, { color: reminderTime !== 'off' ? tint : textMuted }]}>
                      {getReminderLabel()}
                    </Text>
                  )}
                </Pressable>
                {Platform.OS === 'web' && showReminderMenu && (
                  <RNView style={[styles.reminderMenu, { backgroundColor: cardBackground, borderColor: border }]}>
                    {REMINDER_OPTIONS.map((option) => (
                      <Pressable
                        key={option.value}
                        style={({ pressed }) => [
                          styles.reminderMenuItem,
                          pressed && { backgroundColor: border }
                        ]}
                        onPress={() => selectReminderOption(option.value)}
                      >
                        <Text style={[
                          styles.reminderMenuText,
                          { color: reminderTime === option.value ? tint : textPrimary }
                        ]}>
                          {option.label}
                        </Text>
                        {reminderTime === option.value && (
                          <FontAwesome name="check" size={12} color={tint} />
                        )}
                      </Pressable>
                    ))}
                  </RNView>
                )}
              </RNView>
            )}
            <TouchableOpacity
              style={[styles.bottomActionButton, styles.remindActionButton]}
              onPress={(e) => {
                e.stopPropagation();
                handleBookmarkToggle();
              }}
            >
              <FontAwesome name={isBookmarked ? "bookmark" : "bookmark-o"} size={18} color={tint} />
            </TouchableOpacity>
          </RNView>
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
    marginTop: 8,
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
  bookmarkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reminderWrapper: {
    position: 'relative',
  },
  notificationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 6,
    gap: 4,
  },
  notificationText: {
    fontSize: 12,
  },
  reminderMenu: {
    position: 'absolute',
    bottom: '100%',
    right: 0,
    marginBottom: 4,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 160,
    ...Platform.select({
      web: {
        boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.15)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
      },
    }),
  },
  reminderMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  reminderMenuText: {
    fontSize: 14,
  },
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
