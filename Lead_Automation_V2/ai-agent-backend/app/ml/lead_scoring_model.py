"""Random-forest lead fit scoring.

Replaces the old hand-weighted sum (org_size + budget + channel points) with a
trained `RandomForestRegressor`. The three raw signals are the same ones the
Fit Scorer panel already collects (org_size, budget, channel) — this module
only changes how they turn into a score, not the API contract, so nothing
downstream (FitScoreIn/FitScoreOut, the frontend panel) needs to change.

Why a forest instead of a linear/rule-based score: real ICP fit isn't
additive — an enterprise account with real budget closes disproportionately
better than the sum of its parts would suggest, and high-intent channels
(LinkedIn, WhatsApp) matter more when there's budget behind them than when
there isn't. A tree ensemble captures those interactions; a weighted sum
can't.

No historical CRM outcomes exist yet to train on, so the model is fit on a
synthetic dataset generated from documented sales heuristics (see
`_synthesize_training_data`) plus noise, rather than shipping a black box with
invented provenance. Swap `_synthesize_training_data` for a query against
real closed-won/closed-lost leads the moment that data exists — the
training/serving code around it does not need to change.
"""
from __future__ import annotations

import logging
import threading

import numpy as np
from sklearn.ensemble import RandomForestRegressor

logger = logging.getLogger(__name__)

ORG_SIZES = ["small", "medium", "enterprise"]
BUDGETS = ["low", "medium", "high"]
CHANNELS = ["email", "webchat", "instagram", "whatsapp", "linkedin"]

_ORG_SIZE_LABEL = {"small": "1-50 employees", "medium": "50-500 employees", "enterprise": "500+ employees"}
_BUDGET_LABEL = {"low": "under $5k", "medium": "$5k-$20k", "high": "$20k+"}

# Base points per level — same magnitudes as the old rule-based scorer, so a
# lead that used to score ~85 still lands in a similar neighborhood. The
# forest is what's new, not the underlying scale.
_ORG_BASE = {"small": 15.0, "medium": 30.0, "enterprise": 40.0}
_BUDGET_BASE = {"low": 10.0, "medium": 25.0, "high": 40.0}
_CHANNEL_BASE = {"email": 10.0, "webchat": 8.0, "instagram": 12.0, "whatsapp": 20.0, "linkedin": 20.0}

FEATURE_NAMES = [
    "org_size_ord", "budget_ord",
    "channel_email", "channel_webchat", "channel_instagram", "channel_whatsapp", "channel_linkedin",
]


def _encode(org_size: str, budget: str, channel: str) -> np.ndarray:
    org = (org_size or "").lower()
    bud = (budget or "").lower()
    chan = (channel or "").lower()

    org_ord = ORG_SIZES.index(org) if org in ORG_SIZES else -1
    budget_ord = BUDGETS.index(bud) if bud in BUDGETS else -1

    channel_onehot = [1.0 if chan == c else 0.0 for c in CHANNELS]
    return np.array([float(org_ord), float(budget_ord), *channel_onehot], dtype=float)


def _synthesize_training_data(n_samples: int, seed: int) -> tuple[np.ndarray, np.ndarray]:
    """Generates a labelled dataset from sales heuristics + noise.

    Encodes the same domain knowledge the old rule-based scorer had (bigger
    orgs and bigger budgets score higher, high-intent channels score higher)
    plus two interaction effects a linear sum can't express:
      - enterprise x high-budget deals close disproportionately well
      - high-intent channels (LinkedIn/WhatsApp) matter more when budget backs them
    """
    rng = np.random.default_rng(seed)
    rows = []
    labels = []

    for _ in range(n_samples):
        org = rng.choice(ORG_SIZES)
        budget = rng.choice(BUDGETS)
        channel = rng.choice(CHANNELS)

        score = _ORG_BASE[org] + _BUDGET_BASE[budget] + _CHANNEL_BASE[channel]

        if org == "enterprise" and budget == "high":
            score += 10.0
        if channel in ("linkedin", "whatsapp") and budget == "high":
            score += 5.0
        if org == "small" and budget == "low":
            score -= 5.0  # compounding weak signal, not just additive weakness

        score += rng.normal(0, 6)
        score = float(np.clip(score, 0, 100))

        rows.append(_encode(org, budget, channel))
        labels.append(score)

    return np.array(rows), np.array(labels)


class LeadScoringModel:
    """Lazily-trained singleton so the API doesn't retrain on every request."""

    _instance: "LeadScoringModel | None" = None
    _lock = threading.Lock()

    def __init__(self) -> None:
        X, y = _synthesize_training_data(n_samples=4000, seed=42)
        self.model = RandomForestRegressor(
            n_estimators=150, max_depth=6, min_samples_leaf=5, random_state=42,
        )
        self.model.fit(X, y)
        self.feature_importances_ = dict(zip(FEATURE_NAMES, self.model.feature_importances_))
        logger.info("lead_scoring_model_trained", extra={"feature_importances": self.feature_importances_})

    @classmethod
    def instance(cls) -> "LeadScoringModel":
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = cls()
        return cls._instance

    def _group_importance(self) -> dict[str, float]:
        """Collapses the 7 one-hot/ordinal feature importances into the 3
        conceptual signals the UI shows (org size, budget, channel)."""
        fi = self.feature_importances_
        org = fi["org_size_ord"]
        budget = fi["budget_ord"]
        channel = sum(fi[f"channel_{c}"] for c in CHANNELS)
        total = org + budget + channel
        if total <= 0:
            return {"org_size": 1 / 3, "budget": 1 / 3, "channel": 1 / 3}
        return {"org_size": org / total, "budget": budget / total, "channel": channel / total}

    def predict(self, org_size: str | None, budget: str | None, channel: str | None) -> dict:
        x = _encode(org_size, budget, channel).reshape(1, -1)
        raw_score = float(self.model.predict(x)[0])
        score = int(round(max(0.0, min(100.0, raw_score))))

        weights = self._group_importance()
        # Distribute the predicted score across the three signals in
        # proportion to how much the forest actually relies on each one —
        # this is what makes the breakdown reflect the *model*, not a
        # hand-picked weighting.
        org_pts = round(score * weights["org_size"])
        budget_pts = round(score * weights["budget"])
        channel_pts = score - org_pts - budget_pts  # remainder, keeps the sum exact

        org_key = (org_size or "").lower()
        budget_key = (budget or "").lower()
        channel_key = (channel or "").lower()

        factors = [
            {"label": "Company size", "value": _ORG_SIZE_LABEL.get(org_key, "unknown"),
             "points": org_pts, "max": 100, "model_weight": round(weights["org_size"], 3)},
            {"label": "Budget", "value": _BUDGET_LABEL.get(budget_key, "unknown"),
             "points": budget_pts, "max": 100, "model_weight": round(weights["budget"], 3)},
            {"label": "Channel", "value": channel_key or "unknown",
             "points": channel_pts, "max": 100, "model_weight": round(weights["channel"], 3)},
        ]

        dominant = max(("org_size", "budget", "channel"), key=lambda k: weights[k])
        dominant_label = {"org_size": "company size", "budget": "budget", "channel": "inbound channel"}[dominant]

        if score >= 75:
            tier = "hot"
            reason = (f"Strong fit — the model weighs {dominant_label} most heavily here, "
                      "and this lead scores well on it alongside the other signals.")
            action = "Route to a senior rep today and offer a same-week demo slot."
        elif score >= 45:
            tier = "warm"
            reason = (f"A real opportunity, but at least one signal — commonly {dominant_label} "
                      "in the model's view — is holding the score back.")
            action = "Qualify the weaker signal before booking a demo — confirm budget owner and timeline."
        else:
            tier = "cold"
            reason = "Below the model's fit threshold on most signals, particularly " + dominant_label + "."
            action = "Keep on a nurture sequence; revisit if budget or headcount changes."

        return {
            "score": score,
            "tier": tier,
            "tier_reason": reason,
            "factors": factors,
            "recommended_action": action,
            "model": "random_forest_v1",
        }


def predict_fit_score(org_size: str | None, budget: str | None, channel: str | None) -> dict:
    return LeadScoringModel.instance().predict(org_size, budget, channel)
