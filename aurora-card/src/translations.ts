/**
 * Card UI string catalogue. English is the source/default language; other
 * languages fall back to English per-key. Selected at runtime from
 * `hass.language` — nothing is hardcoded in the components.
 *
 * Weekday letters/names are stored as delimited strings (letters by ",",
 * names by "|") and split by the helpers in localize.ts.
 */
export type Lang = "en" | "it";

export const STRINGS: Record<Lang, Record<string, string>> = {
  en: {
    // common
    "common.cancel": "Cancel",
    "common.save": "Save",
    "common.saving": "Saving…",
    "common.saved": "✓ Saved",
    "common.loading": "Loading…",
    "common.optional": "optional",
    "common.delete": "Delete",
    "common.none": "—",

    // weekdays (Mon-first); letters split by "," names by "|"
    "weekday.letters": "M,T,W,T,F,S,S",
    "weekday.names": "Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday",

    // roles
    "role.audio_sink.label": "Speaker",
    "role.audio_sink.desc": "Where the alarm rings",
    "role.wake_light.label": "Light / screen (sunrise)",
    "role.wake_light.desc": "A light or screen for the sunrise ramp",
    "role.display_surface.label": "Display surface",
    "role.display_surface.desc": "A screen that shows the ring view",
    "role.notify_channel.label": "Notifications",
    "role.notify_channel.desc": "Where notifications arrive (phone, watch, overlay…)",
    "role.sleep_signal.label": "Sleep signals",
    "role.sleep_signal.desc": "Sensors that tell whether you are asleep (watch, mattress…)",
    "role.presence_signal.label": "Presence signals",
    "role.presence_signal.desc": "Sensors that tell whether you are present / awake",
    "role.conversation.label": "Voice agent",
    "role.conversation.desc": "Voice assistant for commands",
    "role.tts.label": "Text-to-speech",
    "role.tts.desc": "Voice for the briefing and announcements",

    // missions
    "mission.none": "None",
    "mission.tap": "Tap",
    "mission.math": "Math",
    "mission.qr": "QR code",
    "mission.shake": "Shake",
    "mission.open_door": "Open door",
    "mission.vision": "Selfie (AI)",

    // repeat modes
    "repeat.once": "Once",
    "repeat.daily": "Every day",
    "repeat.weekly": "Weekly",

    // schedule summary
    "summary.daily": "Every day",
    "summary.once": "Once",
    "summary.on_date": "On {date}",
    "summary.never": "Never",

    // alarm dialog
    "dialog.new_title": "New alarm",
    "dialog.edit_title": "Edit alarm",
    "dialog.label": "Label",
    "dialog.label_placeholder": "e.g. Work alarm",
    "dialog.repeat": "Repeat",
    "dialog.days": "Days",
    "dialog.mission": "Anti-snooze mission",
    "dialog.sound": "Sound (URI/playlist)",
    "dialog.snooze_max": "Max snooze",
    "dialog.snooze_duration": "Snooze length (min)",
    "dialog.fade_in": "Rising volume (fade-in)",
    "dialog.sunrise": "Sunrise (light/screen ramp)",
    "dialog.smart": "Smart wake",
    "dialog.smart_desc": "Ring earlier if I detect you already awake (your profile's signals)",
    "dialog.briefing": "Wake-up briefing",
    "dialog.briefing_desc": "Speak time, weather and agenda when you stop the alarm",

    // briefing blocks
    "briefing.block.time": "Time & greeting",
    "briefing.block.weather": "Weather",
    "briefing.block.calendar": "Calendar",
    "briefing.block.todo": "To-dos",

    // alarm list
    "alarms.title": "Alarms",
    "alarms.new": "+ New",
    "alarms.empty": "No alarms yet — tap “+ New” to create one.",
    "alarms.default_label": "Alarm",
    "alarms.skip_badge": "skip 1",
    "alarms.skip_title": "Skip the next one",

    // dashboard card
    "card.next_alarm": "Next alarm",
    "card.no_alarm": "No alarm scheduled",
    "card.open_app": "Open the Aurora app →",
    "rel.now": "now",
    "rel.in_min": "in {n} min",
    "rel.in_hm": "in {h}h {m}m",
    "rel.in_h": "in {h}h",
    "rel.in_day": "in 1 day",
    "rel.in_days": "in {n} days",

    // panel
    "panel.all": "Everyone",
    "panel.profile": "Profile",
    "panel.tab_alarms": "Alarms",
    "panel.tab_devices": "Devices",
    "panel.tab_globals": "Shared",
    "panel.select_profile": "Select a profile to configure its devices.",

    // devices view
    "devices.loading": "Loading devices…",
    "devices.intro": "{name}'s devices — all optional. Search and add only what you need; the exact alarm time is always guaranteed.",
    "devices.this_profile": "this profile",
    "devices.save": "Save my devices",

    // globals view
    "globals.intro": "Settings shared across the whole installation.",
    "globals.ring_max": "Max ring duration (min)",
    "globals.skip_calendars": "Skip-day calendars",
    "globals.holiday_calendars": "Holiday calendars (auto-skip)",
    "globals.briefing_intro": "Wake-up briefing — sources read when an alarm has the briefing on. Empty = auto-detect.",
    "globals.weather": "Weather (weather entity)",
    "globals.briefing_calendars": "Briefing calendars",
    "globals.todo_lists": "To-do lists",
    "globals.save": "Save shared settings",

    // entity picker
    "picker.none": "No compatible entity found.",
    "picker.empty_option": "— None —",
    "picker.add": "＋ Add…",

    // ring overlay
    "ring.label": "Time to get up",
    "ring.snooze": "Snooze",
    "ring.stop": "Stop",
  },
  it: {
    "common.cancel": "Annulla",
    "common.save": "Salva",
    "common.saving": "Salvataggio…",
    "common.saved": "✓ Salvato",
    "common.loading": "Caricamento…",
    "common.optional": "opzionale",
    "common.delete": "Elimina",
    "common.none": "—",

    "weekday.letters": "L,M,M,G,V,S,D",
    "weekday.names": "Lunedì|Martedì|Mercoledì|Giovedì|Venerdì|Sabato|Domenica",

    "role.audio_sink.label": "Altoparlante",
    "role.audio_sink.desc": "Dove suona la sveglia",
    "role.wake_light.label": "Luce / schermo (alba)",
    "role.wake_light.desc": "Luce o schermo per la rampa alba",
    "role.display_surface.label": "Superficie display",
    "role.display_surface.desc": "Schermo che mostra la schermata sveglia",
    "role.notify_channel.label": "Notifiche",
    "role.notify_channel.desc": "Dove arrivano le notifiche (telefono, watch, overlay…)",
    "role.sleep_signal.label": "Segnali di sonno",
    "role.sleep_signal.desc": "Sensori che capiscono se stai dormendo (watch, materasso…)",
    "role.presence_signal.label": "Segnali di presenza",
    "role.presence_signal.desc": "Sensori che capiscono se sei presente / sveglio",
    "role.conversation.label": "Agente vocale",
    "role.conversation.desc": "Assistente vocale per i comandi",
    "role.tts.label": "Sintesi vocale",
    "role.tts.desc": "Voce per briefing e annunci",

    "mission.none": "Nessuna",
    "mission.tap": "Tocco",
    "mission.math": "Matematica",
    "mission.qr": "Codice QR",
    "mission.shake": "Scuoti",
    "mission.open_door": "Apri porta",
    "mission.vision": "Selfie (AI)",

    "repeat.once": "Una volta",
    "repeat.daily": "Ogni giorno",
    "repeat.weekly": "Settimanale",

    "summary.daily": "Ogni giorno",
    "summary.once": "Una volta",
    "summary.on_date": "Il {date}",
    "summary.never": "Mai",

    "dialog.new_title": "Nuova sveglia",
    "dialog.edit_title": "Modifica sveglia",
    "dialog.label": "Etichetta",
    "dialog.label_placeholder": "Es. Sveglia lavoro",
    "dialog.repeat": "Ripetizione",
    "dialog.days": "Giorni",
    "dialog.mission": "Missione anti-snooze",
    "dialog.sound": "Suono (URI/playlist)",
    "dialog.snooze_max": "Max snooze",
    "dialog.snooze_duration": "Durata snooze (min)",
    "dialog.fade_in": "Volume crescente (fade-in)",
    "dialog.sunrise": "Alba (rampa luce/schermo)",
    "dialog.smart": "Risveglio intelligente",
    "dialog.smart_desc": "Suona prima se ti rilevo già sveglio (segnali del tuo profilo)",
    "dialog.briefing": "Briefing al risveglio",
    "dialog.briefing_desc": "Pronuncia ora, meteo e impegni quando fermi la sveglia",

    "briefing.block.time": "Ora e saluto",
    "briefing.block.weather": "Meteo",
    "briefing.block.calendar": "Calendario",
    "briefing.block.todo": "Cose da fare",

    "alarms.title": "Sveglie",
    "alarms.new": "+ Nuova",
    "alarms.empty": "Nessuna sveglia — tocca “+ Nuova” per crearne una.",
    "alarms.default_label": "Sveglia",
    "alarms.skip_badge": "salta 1",
    "alarms.skip_title": "Salta la prossima",

    "card.next_alarm": "Prossima sveglia",
    "card.no_alarm": "Nessuna sveglia programmata",
    "card.open_app": "Apri l'app Aurora →",
    "rel.now": "ora",
    "rel.in_min": "tra {n} min",
    "rel.in_hm": "tra {h}h {m}m",
    "rel.in_h": "tra {h}h",
    "rel.in_day": "tra 1 giorno",
    "rel.in_days": "tra {n} giorni",

    "panel.all": "Tutti",
    "panel.profile": "Profilo",
    "panel.tab_alarms": "Sveglie",
    "panel.tab_devices": "Dispositivi",
    "panel.tab_globals": "Globali",
    "panel.select_profile": "Seleziona un profilo per configurarne i dispositivi.",

    "devices.loading": "Caricamento dispositivi…",
    "devices.intro": "Dispositivi di {name} — tutto opzionale. Cerca e aggiungi solo ciò che ti serve; l'orario esatto è sempre garantito.",
    "devices.this_profile": "questo profilo",
    "devices.save": "Salva i miei dispositivi",

    "globals.intro": "Impostazioni condivise da tutta l'installazione.",
    "globals.ring_max": "Durata massima suoneria (min)",
    "globals.skip_calendars": "Calendari per salto impegni",
    "globals.holiday_calendars": "Calendari festività (auto-skip)",
    "globals.briefing_intro": "Briefing del risveglio — sorgenti lette quando la sveglia ha il briefing attivo. Vuoto = rilevamento automatico.",
    "globals.weather": "Meteo (entità weather)",
    "globals.briefing_calendars": "Calendari del briefing",
    "globals.todo_lists": "Liste di cose da fare",
    "globals.save": "Salva globali",

    "picker.none": "Nessuna entità compatibile trovata.",
    "picker.empty_option": "— Nessuno —",
    "picker.add": "＋ Aggiungi…",

    "ring.label": "È ora di alzarsi",
    "ring.snooze": "Posponi",
    "ring.stop": "Stop",
  },
};
