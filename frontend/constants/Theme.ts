export const Colors = {
  black: '#000000',
  blackSoft: '#0C0C0C',
  blackMid: '#111111',
  charcoal: '#1A1A1A',
  charcoal2: '#222222',
  charcoal3: '#2C2C2C',
  gold: '#D4AF37',
  goldLight: '#EAD06A',
  goldDark: '#A07D1C',
  bronze: '#CD7F32',
  bronzeLight: '#E09A50',
  cream: '#F5F5DC',
  creamDark: '#EDE8D0',
  muted: '#6B6050',
  mutedLight: '#8A7A60',
  ok: '#4ADE80',
  warn: '#FACC15',
  bad: '#F87171',
  badDark: '#C04040',
  white: '#FFFFFF',
};

export const Typography = {
  cinzel: 'Cinzel_400Regular',
  cinzelBold: 'Cinzel_700SemiBold',
  garamond: 'EBGaramond_400Regular',
  garamondItalic: 'EBGaramond_400Italic',
  mono: 'DMSans_400Regular', // fallback, we'll use System Mono
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  full: 999,
};

export const Shadow = {
  gold: {
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
};
