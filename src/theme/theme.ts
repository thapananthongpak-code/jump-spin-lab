export const colors = {
  bg: '#0B0F14',
  card: '#151B23',
  cardAlt: '#1D2530',
  border: '#2A3544',
  text: '#F2F5F7',
  muted: '#9AA7B5',
  accent: '#C6F432',
  onAccent: '#0B0F14',
  spin: '#4CC9F0',
  danger: '#FF6B6B',
  warn: '#FFB547',
  gold: '#F5C542',
  silver: '#C9D1D9',
  bronze: '#D08B5B',
};

export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
export const radius = { sm: 10, md: 16, lg: 24, pill: 999 };

/** Kanit is loaded in the root layout (@expo-google-fonts/kanit). */
export const fonts = {
  regular: 'Kanit_400Regular',
  semi: 'Kanit_600SemiBold',
  bold: 'Kanit_800ExtraBold',
  black: 'Kanit_900Black',
};

/** Lane colours: player 1..4 keep their colour on every screen of a match. */
export const playerColors = ['#FF4D4D', '#3D8BFF', '#FFD23F', '#3DDC84'];
export const playerColor = (index: number): string => playerColors[index % playerColors.length];
