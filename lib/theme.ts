import { Platform } from 'react-native';

export const Colors = {
  primary: '#3B4FE0',
  primaryLight: '#6B73E8',
  primaryDark: '#2A2DB8',
  accent: '#F5A623',
  accentLight: '#FFB94D',
  success: '#2E7D32',
  warning: '#F5A623',
  error: '#D32F2F',
  info: '#2196F3',

  white: '#FFFFFF',
  canvasBg: '#FCFCFA',

  // Light theme
  light: {
    bg: '#FAFAFA',
    surface: '#FFFFFF',
    surfaceVariant: '#F5F5F5',
    text: '#1A1A1A',
    textSecondary: '#6B6B6B',
    textTertiary: '#9E9E9E',
    border: '#E0E0E0',
    borderStrong: '#BDBDBD',
  },

  // Dark theme
  dark: {
    bg: '#1A1A1A',
    surface: '#2A2A2A',
    surfaceVariant: '#333333',
    text: '#FAFAFA',
    textSecondary: '#B0B0B0',
    textTertiary: '#757575',
    border: '#3A3A3A',
    borderStrong: '#555555',
  },
} as const;

export const Palette = [
  '#1A1A1A',
  '#D32F2F',
  '#F5A623',
  '#2E7D32',
  '#2196F3',
  '#7B1FA2',
];

export const Typography = {
  display: { fontSize: 32, lineHeight: 38, fontWeight: '700' as const },
  headline: { fontSize: 24, lineHeight: 30, fontWeight: '700' as const },
  title: { fontSize: 18, lineHeight: 24, fontWeight: '600' as const },
  subtitle: { fontSize: 16, lineHeight: 22, fontWeight: '600' as const },
  body: { fontSize: 14, lineHeight: 21, fontWeight: '400' as const },
  label: { fontSize: 12, lineHeight: 16, fontWeight: '500' as const },
  caption: { fontSize: 11, lineHeight: 14, fontWeight: '400' as const },
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const Radius = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  pill: 999,
} as const;

export const isWideScreen = () => {
  if (Platform.OS !== 'web') return false;
  return window.innerWidth >= 900;
};
