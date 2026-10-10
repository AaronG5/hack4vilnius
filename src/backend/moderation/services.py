"""
Trust-score adjustment logic. Stubbed for now.

Real trust-score rating (lowering it when a flag is confirmed harmful,
previously raising it for validators who caught it) is left for later;
callers get back the unchanged score in the meantime.
"""


def compute_trust_adjustment(current_score: float, outcome: str) -> float:
    """
    Compute a user's new trust score after a moderation decision.

    `outcome` is a `vilnius_backend.choices.ModerationFlagStatus` value.

    Stub: always returns `current_score` unchanged until real trust rating
    is implemented.
    """
    # TODO:
    del outcome
    return current_score
