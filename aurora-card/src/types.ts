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

export interface HomeAssistant {
  states: Record<string, HassEntity>;
  connection: HassConnection;
  callWS<T>(msg: Record<string, unknown>): Promise<T>;
  callService(
    domain: string,
    service: string,
    serviceData?: Record<string, unknown>
  ): Promise<unknown>;
}

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
  enabled: boolean;
  skip_next: boolean;
  schedule: AlarmSchedule;
  features: AlarmFeatures;
}

/** A partial payload used when creating/updating an alarm. */
export type AlarmInput = {
  time: string;
  label?: string;
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
  vision_providers: { id: string; title: string }[];
}

export const WEEKDAY_LETTERS = ["L", "M", "M", "G", "V", "S", "D"];
export const WEEKDAY_NAMES = [
  "Lunedì",
  "Martedì",
  "Mercoledì",
  "Giovedì",
  "Venerdì",
  "Sabato",
  "Domenica",
];

export const ROLE_LABELS: Record<string, string> = {
  audio_sink: "Altoparlante (suoneria)",
  wake_light: "Luce / schermo (alba)",
  display_surface: "Superficie display",
  notify_channel: "Notifiche",
  sleep_signal: "Segnali di sonno",
  presence_signal: "Segnali di presenza",
  conversation: "Agente vocale",
  tts: "Sintesi vocale",
};

export const MISSION_LABELS: Record<MissionType, string> = {
  none: "Nessuna",
  tap: "Tocco",
  math: "Matematica",
  qr: "Codice QR",
  shake: "Scuoti",
  open_door: "Apri porta",
  vision: "Selfie (AI)",
};
