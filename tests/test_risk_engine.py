from src.inference.risk_engine import build_risk_result


def test_low_risk_transaction():
    result = build_risk_result(0.10)

    assert result["decision"] == "APPROVE"
    assert result["risk_level"] == "LOW"


def test_medium_risk_transaction():
    result = build_risk_result(0.40)

    assert result["decision"] == "REVIEW"
    assert result["risk_level"] == "MEDIUM"


def test_high_risk_transaction():
    result = build_risk_result(0.90)

    assert result["decision"] == "BLOCK"
    assert result["risk_level"] == "HIGH"