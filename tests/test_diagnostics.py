"""Tests for custom_components.aurora.diagnostics.

Covers async_get_config_entry_diagnostics: the returned dict shape, PII
redaction of owner/CONF_OWNER fields, alarm count accuracy, and coordinator
state reflection — all exercised through the public integration surface.
"""

from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.aurora.const import (
    CONF_OWNER,
    DOMAIN,
    SERVICE_ADD_ALARM,
    SERVICE_TRIGGER_NOW,
)
from custom_components.aurora.diagnostics import async_get_config_entry_diagnostics


async def _setup(
    hass: HomeAssistant,
    *,
    options: dict | None = None,
    data: dict | None = None,
) -> MockConfigEntry:
    """Create, register, and load an Aurora config entry."""
    entry = MockConfigEntry(
        domain=DOMAIN,
        title="Aurora",
        options=options or {},
        data=data or {},
    )
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


async def test_diagnostics_top_level_keys(hass: HomeAssistant) -> None:
    """async_get_config_entry_diagnostics returns all expected top-level keys."""
    entry = await _setup(hass)
    result = await async_get_config_entry_diagnostics(hass, entry)

    assert isinstance(result, dict)
    expected_keys = (
        "entry", "state", "active_alarm_id", "next_alarm", "alarm_count", "alarms"
    )
    for key in expected_keys:
        assert key in result, f"Missing key: {key!r}"


async def test_diagnostics_entry_sub_keys(hass: HomeAssistant) -> None:
    """The 'entry' sub-dict contains version, data, and options."""
    entry = await _setup(hass)
    result = await async_get_config_entry_diagnostics(hass, entry)

    entry_diag = result["entry"]
    assert isinstance(entry_diag, dict)
    for key in ("version", "data", "options"):
        assert key in entry_diag, f"Missing entry sub-key: {key!r}"


async def test_diagnostics_entry_version_format(hass: HomeAssistant) -> None:
    """entry.version is formatted as '<major>.<minor>'."""
    entry = await _setup(hass)
    result = await async_get_config_entry_diagnostics(hass, entry)

    version = result["entry"]["version"]
    assert isinstance(version, str)
    assert "." in version, f"Expected 'major.minor' format, got: {version!r}"
    major, _, minor = version.partition(".")
    assert major.isdigit() and minor.isdigit()


async def test_diagnostics_initial_state_is_idle(hass: HomeAssistant) -> None:
    """Coordinator starts in 'idle'; diagnostics reflect that immediately."""
    entry = await _setup(hass)
    result = await async_get_config_entry_diagnostics(hass, entry)

    assert result["state"] == "idle"
    assert result["active_alarm_id"] is None
    assert result["next_alarm"] is None


async def test_diagnostics_alarm_count_zero_initially(hass: HomeAssistant) -> None:
    """With no alarms added, alarm_count is 0 and alarms list is empty."""
    entry = await _setup(hass)
    result = await async_get_config_entry_diagnostics(hass, entry)

    assert result["alarm_count"] == 0
    assert result["alarms"] == []


async def test_diagnostics_alarm_count_increments(hass: HomeAssistant) -> None:
    """alarm_count matches the number of alarms added via the service."""
    entry = await _setup(hass)

    await hass.services.async_call(
        DOMAIN,
        SERVICE_ADD_ALARM,
        {"time": "07:00", "label": "Morning"},
        blocking=True,
    )
    await hass.async_block_till_done()

    result = await async_get_config_entry_diagnostics(hass, entry)
    assert result["alarm_count"] == 1
    assert len(result["alarms"]) == 1

    await hass.services.async_call(
        DOMAIN,
        SERVICE_ADD_ALARM,
        {"time": "08:30", "label": "Work"},
        blocking=True,
    )
    await hass.async_block_till_done()

    result = await async_get_config_entry_diagnostics(hass, entry)
    assert result["alarm_count"] == 2
    assert len(result["alarms"]) == 2


async def test_diagnostics_next_alarm_shape(hass: HomeAssistant) -> None:
    """next_alarm dict exposes alarm_id, label, owner, fire_at when present."""
    entry = await _setup(hass)
    await hass.services.async_call(
        DOMAIN,
        SERVICE_ADD_ALARM,
        {"time": "07:00", "label": "Morning"},
        blocking=True,
    )
    await hass.async_block_till_done()

    result = await async_get_config_entry_diagnostics(hass, entry)
    # After adding an enabled alarm there should be a scheduled next_alarm.
    if result["next_alarm"] is not None:
        next_alarm = result["next_alarm"]
        for key in ("alarm_id", "label", "owner", "fire_at"):
            assert key in next_alarm, f"next_alarm missing key: {key!r}"


async def test_diagnostics_state_reflects_ringing(hass: HomeAssistant) -> None:
    """After trigger_now the diagnostics state transitions to 'ringing'."""
    entry = await _setup(hass)
    await hass.services.async_call(
        DOMAIN,
        SERVICE_ADD_ALARM,
        {"time": "07:00", "label": "Test"},
        blocking=True,
    )
    await hass.async_block_till_done()

    await hass.services.async_call(DOMAIN, SERVICE_TRIGGER_NOW, {}, blocking=True)
    await hass.async_block_till_done()

    result = await async_get_config_entry_diagnostics(hass, entry)
    assert result["state"] == "ringing"
    assert result["active_alarm_id"] is not None


async def test_diagnostics_owner_redacted_in_alarms(hass: HomeAssistant) -> None:
    """Owner field in alarm dicts is redacted to '**REDACTED**'."""
    entry = await _setup(hass)
    await hass.services.async_call(
        DOMAIN,
        SERVICE_ADD_ALARM,
        {"time": "07:00", "label": "Private", "owner": "alice"},
        blocking=True,
    )
    await hass.async_block_till_done()

    result = await async_get_config_entry_diagnostics(hass, entry)
    assert result["alarm_count"] == 1
    alarm = result["alarms"][0]
    # HA's async_redact_data replaces sensitive values with "**REDACTED**".
    # The owner was provided in the service call, so it must be present and redacted.
    assert "owner" in alarm, "Stored alarm dict must contain an 'owner' key"
    assert alarm["owner"] == "**REDACTED**", (
        f"owner must be redacted, got: {alarm['owner']!r}"
    )


async def test_diagnostics_owner_redacted_in_options(hass: HomeAssistant) -> None:
    """CONF_OWNER ('owner') in entry options is redacted."""
    entry = await _setup(hass, options={CONF_OWNER: "bob"})
    result = await async_get_config_entry_diagnostics(hass, entry)

    options_diag = result["entry"]["options"]
    # CONF_OWNER was explicitly set in entry options so it must survive redaction
    # with its value replaced (async_redact_data keeps the key).
    assert CONF_OWNER in options_diag, "CONF_OWNER must be present in options diag"
    assert options_diag[CONF_OWNER] == "**REDACTED**", (
        f"CONF_OWNER must be redacted in options, got: {options_diag[CONF_OWNER]!r}"
    )


async def test_diagnostics_owner_redacted_in_data(hass: HomeAssistant) -> None:
    """CONF_OWNER ('owner') in entry data is redacted."""
    entry = await _setup(hass, data={CONF_OWNER: "carol"})
    result = await async_get_config_entry_diagnostics(hass, entry)

    data_diag = result["entry"]["data"]
    # CONF_OWNER was explicitly set in entry data so it must survive redaction
    # with its value replaced (async_redact_data keeps the key).
    assert CONF_OWNER in data_diag, "CONF_OWNER must be present in data diag"
    assert data_diag[CONF_OWNER] == "**REDACTED**", (
        f"CONF_OWNER must be redacted in data, got: {data_diag[CONF_OWNER]!r}"
    )


async def test_diagnostics_alarms_list_contains_dicts(hass: HomeAssistant) -> None:
    """Each element of 'alarms' is a dict (the stored alarm payload)."""
    entry = await _setup(hass)
    await hass.services.async_call(
        DOMAIN,
        SERVICE_ADD_ALARM,
        {"time": "06:30", "label": "Early"},
        blocking=True,
    )
    await hass.async_block_till_done()

    result = await async_get_config_entry_diagnostics(hass, entry)
    for item in result["alarms"]:
        assert isinstance(item, dict), f"Alarm list element is not a dict: {item!r}"


async def test_diagnostics_is_idempotent(hass: HomeAssistant) -> None:
    """Calling async_get_config_entry_diagnostics twice yields consistent results."""
    entry = await _setup(hass)
    first = await async_get_config_entry_diagnostics(hass, entry)
    second = await async_get_config_entry_diagnostics(hass, entry)

    assert first["alarm_count"] == second["alarm_count"]
    assert first["state"] == second["state"]
    assert first["active_alarm_id"] == second["active_alarm_id"]
