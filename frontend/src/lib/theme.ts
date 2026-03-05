export const theme = {
  colors: {
    success: {
      primary: '#13be66',
      secondary: '#13be6629',
    },
    accent: {
      dark: '#fb4f00',
      primary: '#fb4f00',
      secondary: '#2a7cff29',
    },
    neutral: {
      grey: '#d2d2d2',
      darkGrey: '#101010',
      lightGrey: '#f5f5f5',
      lightestGrey: '#e7e7e7',
    },
    text: {
      primary: '#101010',
      secondary: '#373737',
      tertiary: '#858585',
    },
    failure: {
      primary: '#ff0000',
      secondary: '#ff000029',
    },
    warning: {
      primary: '#f1b000',
      secondary: '#f1b00029',
    },
  },
} as const;

export type Theme = typeof theme;
