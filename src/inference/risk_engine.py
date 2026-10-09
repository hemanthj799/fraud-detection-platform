def make_risk_decision(
    fraud_probability: float,
    review_threshold: float = 0.30,
    block_threshold: float = 0.65
) -> str:

    if fraud_probability >= block_threshold:
        return "BLOCK"

    if fraud_probability >= review_threshold:
        return "REVIEW"

    return "APPROVE"


def build_risk_result(
    fraud_probability: float,
    review_threshold: float = 0.30,
    block_threshold: float = 0.65
) -> dict:
    """
    Build a structured fraud-risk response.
    """

    decision = make_risk_decision(
        fraud_probability,
        review_threshold,
        block_threshold
    )

    if fraud_probability >= block_threshold:
        risk_level = "HIGH"

    elif fraud_probability >= review_threshold:
        risk_level = "MEDIUM"

    else:
        risk_level = "LOW"

    return {
        "fraud_probability": round(fraud_probability, 6),
        "risk_level": risk_level,
        "decision": decision
    }