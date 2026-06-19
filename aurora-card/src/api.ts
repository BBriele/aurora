/** Typed wrappers over the Aurora backend WebSocket + service contract. */
import type { Alarm, AlarmInput, AuroraSettings, HomeAssistant, RoleEntities } from "./types";

/**
 * One change as emitted by HA's StorageCollectionWebsocket subscribe command:
 * `{ change_type, <model>_id, item }`. For us the id key is `alarm_id`.
 */
interface CollectionChange {
  change_type: "added" | "updated" | "removed";
  alarm_id?: string;
  item?: Alarm;
}

/** Subscribe to the live alarm collection. Returns the unsubscribe promise. */
export function subscribeAlarms(
  hass: HomeAssistant,
  onChange: (alarms: Alarm[]) => void
): Promise<() => void> {
  const items = new Map<string, Alarm>();
  const apply = (ch: CollectionChange): void => {
    if ((ch.change_type === "added" || ch.change_type === "updated") && ch.item) {
      items.set(ch.item.id, ch.item);
    } else if (ch.change_type === "removed") {
      const id = ch.alarm_id ?? ch.item?.id;
      if (id) items.delete(id);
    }
  };
  return hass.connection.subscribeMessage<CollectionChange | CollectionChange[]>(
    (msg) => {
      // HA sends an array of changes (and the initial state as added changes).
      if (Array.isArray(msg)) {
        msg.forEach(apply);
      } else {
        apply(msg);
      }
      onChange(
        [...items.values()].sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""))
      );
    },
    { type: "aurora/alarms/subscribe" }
  );
}

export function createAlarm(hass: HomeAssistant, input: AlarmInput): Promise<Alarm> {
  return hass.callWS<Alarm>({ type: "aurora/alarms/create", ...input });
}

export function updateAlarm(
  hass: HomeAssistant,
  id: string,
  changes: Partial<AlarmInput> & Record<string, unknown>
): Promise<Alarm> {
  return hass.callWS<Alarm>({ type: "aurora/alarms/update", alarm_id: id, ...changes });
}

export function deleteAlarm(hass: HomeAssistant, id: string): Promise<unknown> {
  return hass.callWS({ type: "aurora/alarms/delete", alarm_id: id });
}

export function getSettings(hass: HomeAssistant): Promise<AuroraSettings> {
  return hass.callWS<AuroraSettings>({ type: "aurora/settings/get" });
}

export function setSettings(
  hass: HomeAssistant,
  options: Record<string, unknown>
): Promise<{ options: Record<string, unknown> }> {
  return hass.callWS({ type: "aurora/settings/set", options });
}

export function getRoleEntities(hass: HomeAssistant): Promise<RoleEntities> {
  return hass.callWS<RoleEntities>({ type: "aurora/options/entities" });
}

/** Live list of vision models configured across the install's providers. */
export async function getVisionModels(hass: HomeAssistant): Promise<string[]> {
  const res = await hass.callWS<{ models: string[] }>({ type: "aurora/vision/models" });
  return res.models ?? [];
}

export const ringAction = (hass: HomeAssistant, service: "snooze" | "dismiss") =>
  hass.callService("aurora", service, {});

/** Which transport a browse node belongs to (so navigation stays consistent). */
export type BrowseVia = "player" | "source";

/** A node in Home Assistant's media-browse tree (player or media-source). */
export interface BrowseMedia {
  title: string;
  media_class: string;
  media_content_type: string;
  media_content_id: string;
  can_play: boolean;
  can_expand: boolean;
  thumbnail?: string | null;
  children?: BrowseMedia[];
  /** Set by the card to remember which transport produced this node. */
  via?: BrowseVia;
}

/**
 * Browse a media player's own tree (its providers, e.g. Music Assistant). This
 * is the richest source for that player but, crucially, a Music Assistant player
 * does NOT expose Home Assistant's local media sources — use `browseSource` for
 * those (e.g. files under `my_media/sounds`).
 */
export function browsePlayer(
  hass: HomeAssistant,
  entityId: string,
  contentId?: string,
  contentType?: string
): Promise<BrowseMedia> {
  return hass.callWS<BrowseMedia>({
    type: "media_player/browse_media",
    entity_id: entityId,
    ...(contentId ? { media_content_id: contentId } : {}),
    ...(contentType ? { media_content_type: contentType } : {}),
  });
}

/**
 * Browse Home Assistant's media sources (the "My media" tree — local files,
 * `media-source://` providers). Always available regardless of the bound player,
 * so local mp3s under `my_media/sounds` are reachable.
 */
export function browseSource(
  hass: HomeAssistant,
  contentId?: string
): Promise<BrowseMedia> {
  return hass.callWS<BrowseMedia>({
    type: "media_source/browse_media",
    ...(contentId ? { media_content_id: contentId } : {}),
  });
}

export interface VisionResult {
  awake: boolean;
}

export interface BenchmarkResult {
  samples: number;
  succeeded: number;
  failed: number;
  latency_ms: { min: number | null; avg: number | null; max: number | null };
}

export async function benchmarkVision(
  hass: HomeAssistant,
  samples: number
): Promise<BenchmarkResult> {
  // HA's runtime callService accepts extra args (target, notifyOnError, returnResponse)
  // that are not in our minimal stub type; cast to any for the extra params only.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (hass.callService as (...a: any[]) => Promise<any>)(
    "aurora", "benchmark_vision", { samples }, undefined, false, true
  );
  return res.response as BenchmarkResult;
}

/** Submit a selfie (data URL / base64) to the AI-vision provider for a verdict. */
export function visionCheck(
  hass: HomeAssistant,
  image: string,
  alarmId: string | null
): Promise<VisionResult> {
  return hass.callWS<VisionResult>({
    type: "aurora/vision/check",
    image,
    alarm_id: alarmId,
  });
}
