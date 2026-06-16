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

export const ringAction = (hass: HomeAssistant, service: "snooze" | "dismiss" | "trigger_now") =>
  hass.callService("aurora", service, {});

export interface VisionResult {
  awake: boolean;
  latency_ms?: number;
  error?: string;
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
