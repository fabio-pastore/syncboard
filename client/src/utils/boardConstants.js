/**
 * @fileoverview Centralized constants for the SyncBoard application.
 */

/** The base URL for the Socket.io server connection. */
export const SOCKET_URL = import.meta.env.VITE_SERVER_URL;

/** Minimum interval in milliseconds between rendering/emitting updates. */
export const UPDATE_INTERVAL = 16;

/** Maximum number of entries in the undo/redo history stack. */
export const NUM_MAX_UNDO = 64;

/** Minimum distance between points for mouse drawing (in stage units). */
export const MIN_POINT_DISTANCE = 3;

/** Minimum distance between points for pen/stylus drawing (in stage units). */
export const MIN_POINT_DISTANCE_PEN = 1;

/** Delay in milliseconds before navigating away after exit (allows thumbnail save). */
export const WAIT_BEFORE_EXIT = 50; // ms

/** Duration in milliseconds to display the zoom level indicator after zooming. */
export const ZOOM_DISPLAY_TIME = 2250; // ms

/** Debounce interval in milliseconds for input controls like sliders. */
export const INPUT_UPDATE_INTERVAL = 30; // ms

/** Handle identifier constants for the selection box resize handles. */
export const HANDLE_TOP_LEFT = "top-left";
export const HANDLE_TOP = "top";
export const HANDLE_TOP_RIGHT = "top-right";
export const HANDLE_RIGHT = "right";
export const HANDLE_BOTTOM_RIGHT = "bottom-right";
export const HANDLE_BOTTOM = "bottom";
export const HANDLE_BOTTOM_LEFT = "bottom-left";
export const HANDLE_LEFT = "left";

/** Preset color palette for quick color selection in the toolbar. */
export const PRESET_COLORS = ['#000000', '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ffffff'];

/** Color of the selection lasso polygon. */
export const LASSO_LINE_COLOR = "#959494"

/** Color of the selection bounding box and handles. */
export const SELECTION_BOX_COLOR = "#3b82f6"

/** Width and height of resize handles in pixels. */
export const RESIZE_HANDLE_WH = 12;

/** Palette of colors assigned to remote user cursors based on socket ID hash. */
export const CURSOR_COLORS = ['#8b5cf6', '#ef4444', '#f97316', '#22c55e', '#3b82f6', '#ec4899', '#14b8a6', '#f59e0b'];

/** Minimum interval in milliseconds between cursor position emissions. */
export const CURSOR_EMIT_INTERVAL = 16;

/** Time in milliseconds after which an idle cursor begins to fade out. */
export const CURSOR_IDLE_FADE = 5000;

/** Time in milliseconds after which an idle cursor is removed entirely. */
export const CURSOR_IDLE_REMOVE = 15000;