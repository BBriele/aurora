"""Tests for Aurora repair-issue logic (_async_check_issues / _has_audio_sink).

The single repair issue the coordinator can raise is ``no_audio_sink``: created
when at least one alarm is enabled but no AudioSink role is bound anywhere
(globally, per-profile, or on the alarm's own audio.target). Clearing the
condition (adding an audio sink or disabling all alarms) must delete the issue.

All tests drive the system through the public surface:
    setup entry → call service / reload with new options → assert issue_registry.
"""

from homeassistant.core import HomeAssistant
from homeassistant.helpers import issue_registry as ir
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.aurora.const import (
    CONF_PROFILE_BINDINGS,
    CONF_PROFILES,
    DOMAIN,
    ROLE_AUDIO_SINK,
    SERVICE_ADD_ALARM,
    SERVICE_REMOVE_ALARM,
    SERVICE_UPDATE_ALARM,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_ISSUE_ID = "no_audio_sink"


async def _setup(
    hass: HomeAssistant,
    *,
    options: dict | None = None,
) -> MockConfigEntry:
    """Create, add, and load an Aurora config entry; return it."""
    entry = MockConfigEntry(domain=DOMAIN, title="Aurora", options=options or {})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


def _has_issue(hass: HomeAssistant) -> bool:
    """Return True when the no_audio_sink repair issue is present."""
    reg = ir.async_get(hass)
    return (DOMAIN, _ISSUE_ID) in reg.issues


# ---------------------------------------------------------------------------
# No alarms → no issue
# ---------------------------------------------------------------------------


async def test_no_issue_when_no_alarms(hass: HomeAssistant) -> None:
    """With zero alarms setup should not raise the no_audio_sink issue."""
    await _setup(hass)
    assert not _has_issue(hass)


# ---------------------------------------------------------------------------
# Enabled alarm + no audio sink → issue raised
# ---------------------------------------------------------------------------


async def test_issue_raised_when_enabled_alarm_without_sink(
    hass: HomeAssistant,
) -> None:
    """An enabled alarm with no AudioSink bound must produce no_audio_sink."""
    await _setup(hass)
    await hass.services.async_call(
        DOMAIN,
        SERVICE_ADD_ALARM,
        {"time": "07:00", "label": "Wake"},
        blocking=True,
    )
    await hass.async_block_till_done()

    assert _has_issue(hass)


# ---------------------------------------------------------------------------
# Enabled alarm + global audio sink → no issue
# ---------------------------------------------------------------------------


async def test_no_issue_when_global_audio_sink_bound(hass: HomeAssistant) -> None:
    """A globally bound AudioSink must suppress the repair issue."""
    await _setup(hass, options={ROLE_AUDIO_SINK: "media_player.bedroom"})
    await hass.services.async_call(
        DOMAIN,
        SERVICE_ADD_ALARM,
        {"time": "07:00", "label": "Wake"},
        blocking=True,
    )
    await hass.async_block_till_done()

    assert not _has_issue(hass)


# ---------------------------------------------------------------------------
# Issue cleared when audio sink added via entry reload
# ---------------------------------------------------------------------------


async def test_issue_cleared_after_audio_sink_added(hass: HomeAssistant) -> None:
    """Reloading the entry with an AudioSink bound clears a prior issue.

    Sequence:
    1. Setup with no sink → add an alarm → issue appears.
    2. Reload the entry with a global audio sink → issue must be gone.
    """
    entry = await _setup(hass)

    await hass.services.async_call(
        DOMAIN,
        SERVICE_ADD_ALARM,
        {"time": "07:00", "label": "Wake"},
        blocking=True,
    )
    await hass.async_block_till_done()
    assert _has_issue(hass), "pre-condition: issue must exist before reload"

    # Update options to include an audio sink, then reload.
    hass.config_entries.async_update_entry(
        entry, options={ROLE_AUDIO_SINK: "media_player.bedroom"}
    )
    assert await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done()

    # After reload + re-setup, the alarm collection is re-loaded from storage.
    # The coordinator calls _async_check_issues() during async_setup, so if
    # the alarm persisted the issue state depends on storage. We only assert
    # what we can guarantee from the public surface: if the entry loaded clean
    # with a sink bound, any residual issue should be gone.
    assert not _has_issue(hass)


# ---------------------------------------------------------------------------
# Issue cleared when all alarms removed
# ---------------------------------------------------------------------------


async def test_issue_cleared_when_all_alarms_removed(hass: HomeAssistant) -> None:
    """Removing the last enabled alarm must delete the no_audio_sink issue."""
    await _setup(hass)

    await hass.services.async_call(
        DOMAIN,
        SERVICE_ADD_ALARM,
        {"time": "07:00", "label": "Only Alarm"},
        blocking=True,
    )
    await hass.async_block_till_done()
    assert _has_issue(hass), "pre-condition: issue must exist"

    # Retrieve the alarm id from the coordinator.
    entry = hass.config_entries.async_entries(DOMAIN)[0]
    coordinator = entry.runtime_data.coordinator
    items = coordinator.alarms.async_items()
    assert items, "expected at least one alarm in storage"
    alarm_id = items[0]["id"]

    await hass.services.async_call(
        DOMAIN,
        SERVICE_REMOVE_ALARM,
        {"id": alarm_id},
        blocking=True,
    )
    await hass.async_block_till_done()

    assert not _has_issue(hass)


# ---------------------------------------------------------------------------
# Issue cleared when the alarm is disabled (not removed)
# ---------------------------------------------------------------------------


async def test_issue_cleared_when_alarm_disabled(hass: HomeAssistant) -> None:
    """Disabling (not removing) the only alarm must delete the no_audio_sink issue."""
    await _setup(hass)

    await hass.services.async_call(
        DOMAIN,
        SERVICE_ADD_ALARM,
        {"time": "07:00", "label": "Disableable"},
        blocking=True,
    )
    await hass.async_block_till_done()
    assert _has_issue(hass), "pre-condition: issue must exist"

    entry = hass.config_entries.async_entries(DOMAIN)[0]
    coordinator = entry.runtime_data.coordinator
    items = coordinator.alarms.async_items()
    assert items
    alarm_id = items[0]["id"]

    await hass.services.async_call(
        DOMAIN,
        SERVICE_UPDATE_ALARM,
        {"id": alarm_id, "enabled": False},
        blocking=True,
    )
    await hass.async_block_till_done()

    assert not _has_issue(hass)


# ---------------------------------------------------------------------------
# Issue NOT raised when alarm is disabled and no sink present
# ---------------------------------------------------------------------------


async def test_no_issue_when_alarm_disabled_and_no_sink(hass: HomeAssistant) -> None:
    """A disabled alarm with no audio sink must not produce the repair issue."""
    await _setup(hass)

    await hass.services.async_call(
        DOMAIN,
        SERVICE_ADD_ALARM,
        {"time": "07:00", "label": "Disabled", "enabled": False},
        blocking=True,
    )
    await hass.async_block_till_done()

    assert not _has_issue(hass)


# ---------------------------------------------------------------------------
# Per-profile audio sink suppresses the issue
# ---------------------------------------------------------------------------


async def test_no_issue_when_profile_has_audio_sink(hass: HomeAssistant) -> None:
    """An AudioSink bound in a profile's role bindings must suppress the issue.

    The coordinator._has_audio_sink() iterates CONF_PROFILES values looking
    for CONF_PROFILE_BINDINGS dicts that contain ROLE_AUDIO_SINK.
    """
    profile_options = {
        CONF_PROFILES: {
            "profile_a": {
                CONF_PROFILE_BINDINGS: {
                    ROLE_AUDIO_SINK: "media_player.bedroom",
                }
            }
        }
    }
    await _setup(hass, options=profile_options)

    await hass.services.async_call(
        DOMAIN,
        SERVICE_ADD_ALARM,
        {"time": "07:00", "label": "Profile Alarm"},
        blocking=True,
    )
    await hass.async_block_till_done()

    assert not _has_issue(hass)


# ---------------------------------------------------------------------------
# Multiple alarms: issue still present if none has a sink
# ---------------------------------------------------------------------------


async def test_issue_with_multiple_enabled_alarms_no_sink(
    hass: HomeAssistant,
) -> None:
    """The no_audio_sink issue is raised regardless of how many alarms exist."""
    await _setup(hass)

    for label, t in (("First", "06:00"), ("Second", "07:00")):
        await hass.services.async_call(
            DOMAIN,
            SERVICE_ADD_ALARM,
            {"time": t, "label": label},
            blocking=True,
        )
    await hass.async_block_till_done()

    assert _has_issue(hass)


# ---------------------------------------------------------------------------
# Issue severity and fixable flag
# ---------------------------------------------------------------------------


async def test_issue_severity_and_not_fixable(hass: HomeAssistant) -> None:
    """The no_audio_sink issue must be WARNING severity and not auto-fixable."""
    await _setup(hass)
    await hass.services.async_call(
        DOMAIN,
        SERVICE_ADD_ALARM,
        {"time": "07:00", "label": "Test"},
        blocking=True,
    )
    await hass.async_block_till_done()

    reg = ir.async_get(hass)
    issue = reg.issues.get((DOMAIN, _ISSUE_ID))
    assert issue is not None
    assert issue.severity is ir.IssueSeverity.WARNING
    assert issue.is_fixable is False
