export const SOCKET_URL = import.meta.env.VITE_SERVER_URL;

export const UPDATE_INTERVAL = 16;
export const NUM_MAX_UNDO = 32;
export const MIN_POINT_DISTANCE = 3;
export const MIN_POINT_DISTANCE_PEN = 1;
export const WAIT_BEFORE_EXIT = 50; // ms
export const ZOOM_DISPLAY_TIME = 2250; // ms
export const HANDLE_TOP_LEFT = "top-left";
export const HANDLE_TOP = "top";
export const HANDLE_TOP_RIGHT = "top-right";
export const HANDLE_RIGHT = "right";
export const HANDLE_BOTTOM_RIGHT = "bottom-right";
export const HANDLE_BOTTOM = "bottom";
export const HANDLE_BOTTOM_LEFT = "bottom-left";
export const HANDLE_LEFT = "left";
export const PRESET_COLORS = ['#000000', '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ffffff'];
export const LASSO_LINE_COLOR = "#959494"
export const SELECTION_BOX_COLOR = "#3b82f6"
export const RESIZE_HANDLE_WH = 12;

export const CURSOR_COLORS = ['#8b5cf6', '#ef4444', '#f97316', '#22c55e', '#3b82f6', '#ec4899', '#14b8a6', '#f59e0b'];
export const CURSOR_EMIT_INTERVAL = 16;     // time in ms
export const CURSOR_IDLE_FADE = 5000;
export const CURSOR_IDLE_REMOVE = 15000;
