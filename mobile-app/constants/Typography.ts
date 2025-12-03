/**
 * Typography constants for consistent text styling across the app.
 *
 * Rule: Never use a font size smaller than `fontSize.base` (15px).
 *
 * For colors, use Colors.ts with useThemeColor hook for dark mode support.
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
