// --- calendarConstants.js ---
/*
  This file is purely for configuration. 
  If you ever want to change a color, 
  tweak an opacity, or add a new availability mode, 
  you do it here
*/

// The different modes the algorithm can use to calculate group availability
export const AVAILABILITY_VIEWS = ['StrictView', 'FlexibleView', 'LenientView'];

// The default mode to fall back to when a user first clicks a group
export const DEFAULT_GROUP_VIEW = 'FlexibleView';

// The absolute fallback if the backend doesn't send multi-view data
export const FALLBACK_VIEW = 'StrictView';

// Visual opacities to ensure overlapping events don't turn into a solid, unreadable blob
export const DEEMPHASIZED_EVENT_OPACITY = 0.5;      // Used for multi-day events so they fade into the background
export const AVAILABILITY_MIN_OPACITY = 0.35;       // The lightest green for 1 person available
export const AVAILABILITY_MAX_OPACITY = 0.82;       // The darkest green for everyone available

// The exact number of milliseconds in a 24-hour day (used for date math)
export const DAY_MS = 24 * 60 * 60 * 1000;

// Standardized constants for the priority of personal events
// Object.freeze prevents these from ever being accidentally changed while the app is running
export const BLOCKING_LEVELS = Object.freeze({
  B1: 'B1', // Low / Optional
  B2: 'B2', // Medium / Flexible
  B3: 'B3'  // High / Immovable
});

// User-friendly labels for the toggle buttons in the UI
export const AVAILABILITY_VIEW_LABELS = {
  StrictView: 'Strict',
  FlexibleView: 'Flexible',
  LenientView: 'Lenient'
};

// A centralized dictionary of every color used in the calendar.
// This makes implementing a "Dark Mode" in the future incredibly easy.
export const COLORS = {
  PETITION: '#ffa963',   // Orange
  BLOCKING: '#34333c',   // Dark Gray
  MANUAL: '#6f6e76',     // Medium Gray
  HARD_BLOCK: '#185abc', // Dark Blue
  MED_BLOCK: '#6395ee',  // Standard Blue
  SOFT_BLOCK: '#aecbfa', // Light Pastel Blue
  NORMAL: '#6395ee'      // Default Blue
};