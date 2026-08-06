"""Support capability registry."""
from __future__ import annotations

from .tickets import (
    CSATRiskCapability,
    ConversationSummaryCapability,
    CustomerTimelineCapability,
    EscalationCapability,
    SLAMonitorCapability,
    SuggestedReplyCapability,
    TicketClassificationCapability,
)

ALL_CAPABILITIES = [
    TicketClassificationCapability,
    SuggestedReplyCapability,
    CSATRiskCapability,
    EscalationCapability,
    SLAMonitorCapability,
    ConversationSummaryCapability,
    CustomerTimelineCapability,
]

__all__ = ["ALL_CAPABILITIES"]
