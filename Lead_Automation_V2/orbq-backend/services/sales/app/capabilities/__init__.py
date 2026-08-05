"""Sales capability registry. Adding a capability = write the class, list it here."""
from __future__ import annotations

from .pipeline import (
    CRMAnalysisCapability,
    ColdLeadRevivalCapability,
    MeetingPrepCapability,
    PipelineAnalysisCapability,
    RevenueForecastCapability,
    SalesHandoffCapability,
)
from .scoring import (
    BuyingIntentCapability,
    LeadScoringCapability,
    OpportunityScoreCapability,
)

ALL_CAPABILITIES = [
    LeadScoringCapability,
    BuyingIntentCapability,
    OpportunityScoreCapability,
    PipelineAnalysisCapability,
    RevenueForecastCapability,
    CRMAnalysisCapability,
    MeetingPrepCapability,
    SalesHandoffCapability,
    ColdLeadRevivalCapability,
]

__all__ = ["ALL_CAPABILITIES"]
