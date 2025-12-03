/**
 * Typography constants for consistent text styling across the app.
 *
 * Rule: Never use a font size smaller than `fontSize.base` (15px).
 */

export const fontSize = {
  base: 15,      // Standard body text - minimum size
  large: 17,     // Slightly emphasized text
  title: 20,     // Card titles, section headers
  header: 24,    // Screen titles
};

export const fontWeight = {
  normal: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

export const lineHeight = {
  tight: 20,     // For single-line text
  base: 22,      // Standard body text
  relaxed: 26,   // For larger text
};

export const colors = {
  // Text colors
  textPrimary: '#333',
  textSecondary: '#666',
  textMuted: '#999',

  // Accent colors
  eventOrange: '#E65100',
  eventOrangeLight: '#FFF3E0',

  // UI colors
  divider: '#e0e0e0',
  cardBackground: '#fff',
};

// Pre-composed text styles for common use cases
export const textStyles = {
  body: {
    fontSize: fontSize.base,
    color: colors.textPrimary,
    lineHeight: lineHeight.base,
  },
  bodyBold: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    lineHeight: lineHeight.base,
  },
  secondary: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
    lineHeight: lineHeight.base,
  },
  secondaryBold: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.textSecondary,
    lineHeight: lineHeight.base,
  },
  muted: {
    fontSize: fontSize.base,
    color: colors.textMuted,
    lineHeight: lineHeight.base,
  },
  eventDate: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.eventOrange,
  },
};
