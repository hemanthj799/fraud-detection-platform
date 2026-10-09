from prometheus_client import Counter, Histogram


TRANSACTIONS_PROCESSED = Counter(
    "fraud_transactions_processed_total",
    "Total number of transactions processed"
)

FRAUD_DECISIONS = Counter(
    "fraud_decisions_total",
    "Number of transactions by final risk decision",
    ["decision"]
)

TRANSACTION_LATENCY = Histogram(
    "fraud_transaction_processing_seconds",
    "Time spent processing each transaction"
)