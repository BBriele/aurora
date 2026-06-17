/** Minimal Home Assistant surface the Aurora UI needs (no external dep). */
export interface HassEntity {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
}

export interface HassConnection {
  subscribeMessage<T>(
    callback: (message: T) => void,
    subscribeMessage: { type: string }
  ): Promise<() => void>;
}

export interface HassUser {
  id: string;
  name: string;
  is_admin: boolean;
}

export interface HomeAssistant {
  states: Record<string, HassEntity>;
  connection: HassConnection;
  user?: HassUser;
  /** Active UI language (e.g. "en", "it"), used to localize the card. */
  language: string;
  callWS<T>(msg: Record<string, unknown>): Promise<T>;
  callService(
    domain: string,
    service: string,
    serviceData?: Record<string, unknown>
  ): Promise<unknown>;
}

/** One playable entry in an audio preset (a single track, station or folder). */
export interface PresetItem {
  media_content_id: string;
  media_content_type: string;
  title: string;
  thumbnail?: string | null;
}

/**
 * A named, reusable audio source: a single sound or an ordered playlist, with
 * media-player-style playback behaviour (shuffle, loop, end-of-ring volume).
 */
export interface AudioPreset {
  id: string;
  name: string;
  items: PresetItem[];
  shuffle?: boolean;
  loop?: boolean;
  /** Volume (0–100) to restore on the speaker when the ring stops; null = off. */
  volume_end?: number | null;
}

/** A per-person profile: a display name, device role bindings + audio presets. */
export interface Profile {
  name: string;
  bindings: Record<string, unknown>;
  audio_presets?: AudioPreset[];
}
export type Profiles = Record<string, Profile>;

export type RepeatMode = "once" | "daily" | "weekly";
export type MissionType =
  | "none"
  | "tap"
  | "math"
  | "qr"
  | "shake"
  | "open_door"
  | "vision";

export interface AlarmSchedule {
  repeat_mode: RepeatMode;
  weekdays: number[];
  on_date?: string | null;
}

export interface AlarmFeatures {
  light: {
    enabled: boolean;
    target?: string | null;
    duration_min: number;
    color_temp_kelvin?: number | null;
    post_stop: string;
  };
  audio: {
    enabled: boolean;
    target?: string | null;
    source?: string | null;
    volume_profile: "fixed" | "fade_in";
    volume_max: number;
  };
  smart_window: { enabled: boolean; minutes: number; signals: string[] };
  mission: { type: MissionType; params: Record<string, unknown>; vision_prompt?: string | null };
  snooze: { max: number; duration: number };
  briefing: { enabled: boolean; blocks: string[]; template?: string | null };
}

export interface Alarm {
  id: string;
  time: string;
  label: string;
  owner?: string | null;
  profile_id?: string | null;
  enabled: boolean;
  skip_next: boolean;
  schedule: AlarmSchedule;
  features: AlarmFeatures;
}

/** A partial payload used when creating/updating an alarm. */
export type AlarmInput = {
  time: string;
  label?: string;
  profile_id?: string | null;
  enabled?: boolean;
  skip_next?: boolean;
  schedule?: Partial<AlarmSchedule>;
  features?: Partial<Record<keyof AlarmFeatures, unknown>>;
};

export interface AuroraSettings {
  entry_id: string | null;
  data: Record<string, unknown>;
  options: Record<string, unknown>;
}

export interface RoleEntities {
  roles: Record<string, string[]>;
  calendars: string[];
  weather: string[];
  todo: string[];
  vision_providers: { id: string; title: string }[];
}

/** Wake-up briefing block keys (labels localized via "briefing.block.<key>"). */
export const BRIEFING_BLOCKS = ["time", "weather", "calendar", "todo"] as const;
export type BriefingBlock = (typeof BRIEFING_BLOCKS)[number];

// Role icons are emoji (not language-dependent). Labels/descriptions are
// localized via the "role.<key>.label/.desc" keys in translations.ts.
export const ROLE_ICONS: Record<string, string> = {
  audio_sink: "🔊",
  wake_light: "🌅",
  display_surface: "🖥️",
  notify_channel: "🔔",
  sleep_signal: "😴",
  presence_signal: "🚶",
  conversation: "🗣️",
  tts: "📣",
  vision_provider: "👁️",
};

// Mission types in display order. Labels are localized via "mission.<type>".
export const MISSION_TYPES: MissionType[] = [
  "none",
  "tap",
  "math",
  "qr",
  "shake",
  "open_door",
  "vision",
];
