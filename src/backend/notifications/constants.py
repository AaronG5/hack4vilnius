"""
Known `Notification.event_type` values.

The contract only documents these as free-text examples (no enum), so the
field itself stays an unconstrained string; these constants just keep the
values used by our own notification-sending code consistent.
"""

EVENT_STATUS_CHANGED = "status_changed"
EVENT_VALIDATION_REQUESTED = "validation_requested"
EVENT_POINTS_AWARDED = "points_awarded"
