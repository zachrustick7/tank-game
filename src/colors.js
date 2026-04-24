// Master Color Palette — Cozy Tank Game

export const COLORS = {
  // =============================
  // CORE NEUTRALS
  // =============================
  neutral: {
    white:    "#FFFFFF",
    cream:    "#F2E8CF",
    light:    "#EAEAEA",
    mid:      "#CFCFCF",
    dark:     "#2F2F2F",
    charcoal: "#1F1F1F",
  },

  // =============================
  // PRIMARY THEME (COZY MILITARY)
  // =============================
  green: {
    100: "#D7E3D4",
    200: "#A3BFA8",
    300: "#6B8F71",
    400: "#4F6D5A",
    500: "#3A5245",
  },

  brown: {
    100: "#D6C1A3",
    200: "#A98467",
    300: "#8C6A5D",
    400: "#6B4F45",
    500: "#5C4438",
  },

  sand: {
    100: "#F8F5F0",
    200: "#EDE0D4",
    300: "#EAD7B7",
    400: "#DAD7CD",
    500: "#B7B7A4",
  },

  // =============================
  // ACCENTS (SOFT + COZY)
  // =============================
  accent: {
    blue:     "#7DA2A9",
    lavender: "#A3A9CE",
    pink:     "#E5989B",
    peach:    "#FFB4A2",
    gold:     "#D0A85C",
    teal:     "#6FA3A3",
  },

  // =============================
  // TANK FACTIONS / VARIANTS
  // =============================
  tank: {
    green:  "#6B8F71",
    blue:   "#7F9C96",
    red:    "#C27C7C",
    yellow: "#D0A85C",
    purple: "#9A7AA0",
    dark:   "#4F6D5A",
    light:  "#A3BFA8",
    orange: "#FF8D28",
  },

  // =============================
  // COMBAT / EFFECTS
  // =============================
  effects: {
    damage: "#FF6B6B",
    crit:   "#FF3B3B",
    heal:   "#7ED957",

    explosionCore:  "#FFD166",
    explosionMid:   "#F4A261",
    explosionOuter: "#E76F51",

    smoke:  "#B7B7A4",
    shadow: "#5C5C5C",

    shield: "#A3A9CE",
    energy: "#7DA2A9",
  },

  // =============================
  // BIOMES
  // =============================
  biome: {
    grassland: { base: "#A3BFA8", dark: "#6B8F71",  light: "#D7E3D4" },
    desert:    { base: "#EAD7B7", dark: "#D0A85C",  light: "#F8F5F0" },
    snow:      { base: "#EAEAEA", dark: "#CFCFCF",  light: "#FFFFFF" },
    volcanic:  { base: "#8C6A5D", dark: "#5C4438",  light: "#E76F51" },
  },

  // =============================
  // UI SYSTEM
  // =============================
  ui: {
    background:    "#F2E8CF",
    panel:         "#EAD7B7",
    border:        "#CFCFCF",
    textPrimary:   "#2F2F2F",
    textSecondary: "#6B6B6B",
    textInverse:   "#FFFFFF",

    button: {
      primary:   "#6B8F71",
      secondary: "#A3BFA8",
      danger:    "#E5989B",
      disabled:  "#CFCFCF",
    },

    health: {
      full:       "#7ED957",
      mid:        "#FFD166",
      low:        "#FF6B6B",
      background: "#EAEAEA",
    },

    xp: { bar: "#7DA2A9", background: "#EAEAEA" },
  },

  // =============================
  // RARITY SYSTEM
  // =============================
  rarity: {
    common:    "#CFCFCF",
    uncommon:  "#A3BFA8",
    rare:      "#7DA2A9",
    epic:      "#9A7AA0",
    legendary: "#D0A85C",
  },

  // =============================
  // EXTENDED COLORS
  // =============================
  extended: {
    redSoft:    "#E5989B", redDark:    "#C27C7C",
    orangeSoft: "#F4A261", orangeDark: "#E76F51",
    yellowSoft: "#FFD166", yellowDark: "#D0A85C",
    blueSoft:   "#7DA2A9", blueDark:   "#5C7C89",
    purpleSoft: "#A3A9CE", purpleDark: "#7B6D8D",
    tealSoft:   "#6FA3A3", tealDark:   "#4F7D7D",
  },
};
