/** Typed wrappers over the Aurora backend WebSocket + service contract. */
import type { Alarm, AlarmInput, AuroraSettings, HomeAssistant, RoleEntities } from "./types";

interface CollectionEvent {
  type: "added" | "updated" | "removed";
  item?: Alarm;
  item_id?: string;
}

/** Subscribe to the live alarm collection. Returns the unsubscribe promise. */
export function subscribeAlarms(
  hass: HomeAssistant,
  onChange: (alarms: Alarm[]) => void
): Promise<() => void> {
  const items = new Map<string, Alarm>();
  return hass.connection.subscribeMessage<CollectionEvent>(
    (ev) => {
      if ((ev.type === "added" || ev.type === "updated") && ev.item) {
        items.set(ev.item.id, ev.item);
      } else if (ev.type === "removed" && ev.item_id) {
        items.delete(ev.item_id);
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
