
import json
import logging
import time
import uuid

from kafka import KafkaConsumer
from prometheus_client import start_http_server

from src.inference.model_predictor import predict_fraud
from src.inference.risk_engine import build_risk_result
from src.database.postgres import save_transaction

from src.monitoring.metrics import (
    TRANSACTIONS_PROCESSED,
    FRAUD_DECISIONS,
    TRANSACTION_LATENCY,
)


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
)
logger = logging.getLogger(__name__)


consumer = KafkaConsumer(
    "fraud-transactions",
    bootstrap_servers="localhost:9092",
    group_id="fraud-detection-consumer",
    auto_offset_reset="earliest",
    value_deserializer=lambda value: json.loads(
        value.decode("utf-8")
    ),
)


start_http_server(8001)

print("Fraud detection consumer started...")
print("Prometheus metrics available at:")
print("http://127.0.0.1:8001/metrics")
print("Waiting for transactions...")


for message in consumer:
    start_time = time.perf_counter()
    transaction = message.value

    # Preserve the producer's ID; generate one for older messages.
    request_id = transaction.get("request_id") or str(uuid.uuid4())
    transaction["request_id"] = request_id

    logger.info(
        "Transaction received | request_id=%s | topic=%s | partition=%s | offset=%s",
        request_id,
        message.topic,
        message.partition,
        message.offset,
    )

    try:
        fraud_probability = predict_fraud(transaction)

        risk_result = build_risk_result(fraud_probability)

        logger.info(
            "Fraud prediction completed | request_id=%s | "
            "probability=%.6f | risk_level=%s | decision=%s",
            request_id,
            fraud_probability,
            risk_result["risk_level"],
            risk_result["decision"],
        )

        save_transaction(
            transaction,
            fraud_probability,
            risk_result,
            request_id=request_id,
        )

        logger.info(
            "Transaction saved to PostgreSQL | request_id=%s",
            request_id,
        )

        TRANSACTIONS_PROCESSED.inc()
        FRAUD_DECISIONS.labels(
            decision=risk_result["decision"]
        ).inc()

    except Exception:
        logger.exception(
            "Transaction processing failed | request_id=%s",
            request_id,
        )
        # Do not silently acknowledge failed database writes.
        # The current consumer's offset-commit configuration
        # should be reviewed before adding retry/DLQ handling.
        continue

    finally:
        processing_time = time.perf_counter() - start_time
        TRANSACTION_LATENCY.observe(processing_time)

        logger.info(
            "Transaction processing finished | request_id=%s | duration_seconds=%.4f",
            request_id,
            processing_time,
        )
