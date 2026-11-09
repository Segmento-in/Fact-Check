"""Display words and color mappings for claim and article verdicts."""

VERDICT_LABELS = {
    "supported": "Verified with evidence",
    "refuted": "Evidence says this is false",
    "mixed": "Evidence shows only part of this is true",
    "not_enough_evidence": "Not enough evidence yet",
}

VERDICT_COLORS = {
    "supported": "green",
    "refuted": "red",
    "mixed": "yellow",
    "not_enough_evidence": "grey",
}

