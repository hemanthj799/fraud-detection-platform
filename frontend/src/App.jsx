
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  Bell,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Clock3,
  Gauge,
  LayoutDashboard,
  LoaderCircle,
  Menu,
  RefreshCw,
  Search,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import "./App.css";

// Use the production domain that passed your CORS test.
const API_URL = "https://fraud-detection-platform-flame.vercel.app";

const INITIAL_TRANSACTION = {
  step: 1,
  type: "PAYMENT",
  amount: "2500",
  oldbalanceOrg: "10000",
  newbalanceOrig: "7500",
  oldbalanceDest: "5000",
  newbalanceDest: "7500",
};

// This is illustrative UI data, not live transaction analytics.
const SAMPLE_ACTIVITY = [
  { time: "09:00", volume: 18 },
  { time: "10:00", volume: 26 },
  { time: "11:00", volume: 21 },
  { time: "12:00", volume: 34 },
  { time: "13:00", volume: 29 },
  { time: "14:00", volume: 41 },
  { time: "15:00", volume: 33 },
  { time: "16:00", volume: 46 },
];

function formatAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";

  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatTime(value) {
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function getRiskLabel(result) {
  const value = String(result?.risk_level ?? "").toUpperCase();

  if (value) return value;

  const probability = Number(result?.fraud_probability);
  if (Number.isFinite(probability)) {
    if (probability >= 0.7) return "HIGH";
    if (probability >= 0.3) return "MEDIUM";
    return "LOW";
  }

  return "UNKNOWN";
}

function getDecision(result) {
  const decision = result?.decision;
  return decision ? String(decision).toUpperCase() : "UNAVAILABLE";
}

function isFraudLike(result) {
  const risk = getRiskLabel(result);
  const decision = getDecision(result);

  return (
    risk === "HIGH" ||
    risk === "CRITICAL" ||
    decision === "BLOCK" ||
    decision === "DECLINE" ||
    decision === "REJECT"
  );
}

function getRiskClass(risk) {
  const value = String(risk).toLowerCase();

  if (value === "high" || value === "critical") return "risk-high";
  if (value === "medium" || value === "moderate") return "risk-medium";
  if (value === "low") return "risk-low";

  return "risk-unknown";
}

function App() {
  const [transaction, setTransaction] = useState(INITIAL_TRANSACTION);
  const [apiStatus, setApiStatus] = useState("checking");
  const [checkingApi, setCheckingApi] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [apiResult, setApiResult] = useState(null);
  const [apiError, setApiError] = useState("");
  const [history, setHistory] = useState([]);
  const [activeView, setActiveView] = useState("Overview");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [compactMode, setCompactMode] = useState(false);
  const [notificationsReadAt, setNotificationsReadAt] = useState(null);
  const [confirmClearHistory, setConfirmClearHistory] = useState(false);

  const checkApi = useCallback(async () => {
    setCheckingApi(true);

    try {
      const response = await fetch(`${API_URL}/`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        throw new Error(`API returned HTTP ${response.status}`);
      }

      setApiStatus("online");
    } catch (error) {
      console.error("API health check failed:", error);
      setApiStatus("offline");
    } finally {
      setCheckingApi(false);
    }
  }, []);

  useEffect(() => {
    checkApi();
  }, [checkApi]);

  useEffect(() => {
    function handleEscape(event) {
      if (event.key === "Escape") {
        setSettingsOpen(false);
        setNotificationsOpen(false);
        setSidebarOpen(false);
        setConfirmClearHistory(false);
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  const updateTransaction = (event) => {
    const { name, value } = event.target;

    setTransaction((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const analyzedCount = history.length;
  const fraudLikeCount = history.filter((item) =>
    isFraudLike(item.result)
  ).length;

  const unreadNotifications = history.filter((item) => {
    if (!notificationsReadAt) return true;
    return new Date(item.createdAt) > new Date(notificationsReadAt);
  }).length;

  const recentHistory = useMemo(() => history.slice(0, 6), [history]);

  async function analyzeTransaction(event) {
    event.preventDefault();

    setAnalyzing(true);
    setApiError("");
    setApiResult(null);

    const amount = Number(transaction.amount);
    const originBefore = Number(transaction.oldbalanceOrg);
    const originAfter = Number(transaction.newbalanceOrig);
    const destinationBefore = Number(transaction.oldbalanceDest);
    const destinationAfter = Number(transaction.newbalanceDest);

    if (
      !Number.isFinite(amount) ||
      !Number.isFinite(originBefore) ||
      !Number.isFinite(originAfter) ||
      !Number.isFinite(destinationBefore) ||
      !Number.isFinite(destinationAfter) ||
      amount < 0 ||
      originBefore < 0 ||
      originAfter < 0 ||
      destinationBefore < 0 ||
      destinationAfter < 0
    ) {
      setApiError("Enter valid, non-negative numeric values in every transaction field.");
      setAnalyzing(false);
      return;
    }

    // Keep the field names expected by the current API.
    const payload = {
      step: Number(transaction.step) || 1,
      type: transaction.type,
      amount,
      oldbalanceOrg: originBefore,
      newbalanceOrig: originAfter,
      oldbalanceDest: destinationBefore,
      newbalanceDest: destinationAfter,
    };

    try {
      const response = await fetch(`${API_URL}/predict`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      const responseText = await response.text();
      let result;

      try {
        result = responseText ? JSON.parse(responseText) : {};
      } catch {
        throw new Error(
          `The API returned an unexpected response (HTTP ${response.status}).`
        );
      }

      if (!response.ok) {
        throw new Error(
          result.detail ||
            result.message ||
            `Prediction request failed with HTTP ${response.status}.`
        );
      }

      setApiResult(result);
      setApiStatus("online");

      const record = {
        id:
          result.request_id ||
          `TX-${Date.now().toString().slice(-8)}`,
        createdAt: new Date().toISOString(),
        amount,
        type: transaction.type,
        result,
      };

      setHistory((current) => [record, ...current]);
    } catch (error) {
      console.error("Transaction analysis failed:", error);
      setApiError(
        error.message ||
          "Could not reach the API. Check your connection and try again."
      );
      setApiStatus("offline");
    } finally {
      setAnalyzing(false);
    }
  }

  function resetForm() {
    setTransaction(INITIAL_TRANSACTION);
    setApiResult(null);
    setApiError("");
  }

  function markNotificationsRead() {
    setNotificationsReadAt(new Date().toISOString());
  }

  function clearHistory() {
    setHistory([]);
    setApiResult(null);
    setConfirmClearHistory(false);
    setNotificationsReadAt(new Date().toISOString());
  }

  const navItems = [
    { label: "Overview", icon: LayoutDashboard },
    { label: "Risk Analyzer", icon: ShieldAlert },
    { label: "Transactions", icon: Activity },
  ];

  return (
    <div className={`app-shell ${compactMode ? "compact-mode" : ""}`}>
      {sidebarOpen && (
        <button
          className="mobile-scrim"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">
            <ShieldCheck size={24} strokeWidth={2.2} />
          </div>
          <div className="brand-copy">
            <span className="brand-name">FraudGuard</span>
            <span className="brand-subtitle">RISK INTELLIGENCE</span>
          </div>
          <button
            className="icon-button sidebar-mobile-close"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <X size={19} />
          </button>
        </div>

        <div className="sidebar-label">WORKSPACE</div>

        <nav className="nav-list" aria-label="Main navigation">
          {navItems.map(({ label, icon: Icon }) => (
            <button
              key={label}
              className={`nav-item ${activeView === label ? "nav-item-active" : ""}`}
              onClick={() => {
                setActiveView(label);
                setSidebarOpen(false);
              }}
            >
              <Icon size={18} />
              <span>{label}</span>
              {activeView === label && <ChevronRight size={16} className="nav-chevron" />}
            </button>
          ))}
        </nav>

        <div className="sidebar-spacer" />

        <div className="sidebar-status-card">
          <div className="status-card-top">
            <span className="status-dot" />
            <span>API Status</span>
            <strong className={apiStatus === "online" ? "text-success" : apiStatus === "offline" ? "text-danger" : ""}>
              {apiStatus === "checking"
                ? "Checking"
                : apiStatus === "online"
                  ? "Online"
                  : "Offline"}
            </strong>
          </div>
          <p>
            {apiStatus === "online"
              ? "Production backend connected"
              : apiStatus === "offline"
                ? "Unable to reach backend"
                : "Checking backend connection"}
          </p>
          <button className="status-refresh" onClick={checkApi} disabled={checkingApi}>
            <RefreshCw size={13} className={checkingApi ? "spin" : ""} />
            Check connection
          </button>
        </div>

        <button
          className="nav-item sidebar-settings"
          onClick={() => setSettingsOpen(true)}
        >
          <Settings size={18} />
          <span>Settings</span>
          <ChevronRight size={16} className="nav-chevron" />
        </button>

        <div className="sidebar-footer">
          <div className="avatar">FD</div>
          <div className="user-info">
            <strong>Fraud Analyst</strong>
            <span>Demo workspace</span>
          </div>
          <button
            className="icon-button user-settings-button"
            aria-label="Open settings"
            onClick={() => setSettingsOpen(true)}
          >
            <SlidersHorizontal size={17} />
          </button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-menu-button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={20} />
            </button>
            <div className="breadcrumbs">
              <span>RISK INTELLIGENCE</span>
              <ChevronRight size={14} />
              <strong>{activeView.toUpperCase()}</strong>
            </div>
          </div>

          <div className="topbar-actions">
            <div className={`topbar-api ${apiStatus}`}>
              <span className="status-dot" />
              <span>
                {apiStatus === "checking"
                  ? "Checking API"
                  : apiStatus === "online"
                    ? "API Online"
                    : "API Offline"}
              </span>
            </div>

            <button
              className={`icon-button notification-button ${notificationsOpen ? "icon-button-active" : ""}`}
              aria-label={`Notifications${unreadNotifications ? `, ${unreadNotifications} unread` : ""}`}
              aria-expanded={notificationsOpen}
              onClick={() => {
                setNotificationsOpen((open) => !open);
                setSettingsOpen(false);
              }}
            >
              <Bell size={19} />
              {unreadNotifications > 0 && (
                <span className="notification-badge">
                  {unreadNotifications > 9 ? "9+" : unreadNotifications}
                </span>
              )}
            </button>

            <button
              className="topbar-avatar"
              aria-label="Open settings"
              onClick={() => setSettingsOpen(true)}
            >
              FD
            </button>
          </div>
        </header>

        <div className="page-content">
          {activeView === "Overview" && (
            <>
              <section className="page-heading">
                <div>
                  <div className="eyebrow">
                    <span className="eyebrow-line" />
                    LIVE INFERENCE
                  </div>
                  <h1>Fraud Detection Center</h1>
                  <p>
                    Analyze transactions and inspect your model&apos;s risk predictions.
                  </p>
                </div>
                <div className="heading-actions">
                  <span className="live-pill">
                    <span className="status-dot" />
                    LIVE API
                  </span>
                  <button className="button button-secondary" onClick={checkApi} disabled={checkingApi}>
                    <RefreshCw size={15} className={checkingApi ? "spin" : ""} />
                    Check connection
                  </button>
                </div>
              </section>

              <MetricsRow
                analyzedCount={analyzedCount}
                fraudLikeCount={fraudLikeCount}
                apiStatus={apiStatus}
              />

              <section className="dashboard-grid">
                <TransactionAnalyzer
                  transaction={transaction}
                  onChange={updateTransaction}
                  onSubmit={analyzeTransaction}
                  onReset={resetForm}
                  analyzing={analyzing}
                  result={apiResult}
                  error={apiError}
                />

                <ActivityCard />
              </section>

              <RecentAnalyses history={recentHistory} />
            </>
          )}

          {activeView === "Risk Analyzer" && (
            <>
              <section className="page-heading">
                <div>
                  <div className="eyebrow">
                    <span className="eyebrow-line" />
                    MODEL INFERENCE
                  </div>
                  <h1>Risk Analyzer</h1>
                  <p>Submit transaction details to the deployed prediction API.</p>
                </div>
                <span className="live-pill">
                  <span className="status-dot" />
                  LIVE API
                </span>
              </section>

              <div className="single-column">
                <TransactionAnalyzer
                  transaction={transaction}
                  onChange={updateTransaction}
                  onSubmit={analyzeTransaction}
                  onReset={resetForm}
                  analyzing={analyzing}
                  result={apiResult}
                  error={apiError}
                />
              </div>
            </>
          )}

          {activeView === "Transactions" && (
            <>
              <section className="page-heading">
                <div>
                  <div className="eyebrow">
                    <span className="eyebrow-line" />
                    SESSION ACTIVITY
                  </div>
                  <h1>Transaction History</h1>
                  <p>Review predictions generated during this browser session.</p>
                </div>
                <button
                  className="button button-secondary"
                  onClick={() => setConfirmClearHistory(true)}
                  disabled={history.length === 0}
                >
                  <X size={15} />
                  Clear history
                </button>
              </section>

              <RecentAnalyses history={history} full />

              <div className="info-note">
                <CircleHelp size={17} />
                <span>
                  Records are stored in browser memory for this session. They are not
                  saved to a database and will be cleared when the page state resets.
                </span>
              </div>
            </>
          )}

          <footer className="app-footer">
            <span>FraudGuard · Portfolio demonstration</span>
            <span>
              <Shield size={13} />
              Model trained on synthetic transaction data
            </span>
          </footer>
        </div>
      </main>

      {notificationsOpen && (
        <div className="popover-backdrop" onClick={() => setNotificationsOpen(false)}>
          <section
            className="notification-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="notifications-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="panel-heading">
              <div>
                <span className="panel-kicker">WORKSPACE</span>
                <h2 id="notifications-title">Notifications</h2>
              </div>
              <button
                className="icon-button"
                onClick={() => setNotificationsOpen(false)}
                aria-label="Close notifications"
              >
                <X size={18} />
              </button>
            </div>

            <div className="notification-summary">
              <div className="notification-summary-icon">
                <Bell size={18} />
              </div>
              <div>
                <strong>
                  {history.length === 0
                    ? "You're all caught up"
                    : `${history.length} analysis${history.length === 1 ? "" : "es"} this session`}
                </strong>
                <p>Updates from your current FraudGuard session.</p>
              </div>
            </div>

            <div className="notification-list">
              <div className="notification-entry">
                <span className={`notification-entry-icon ${apiStatus === "online" ? "entry-success" : "entry-warning"}`}>
                  {apiStatus === "online" ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}
                </span>
                <div>
                  <strong>
                    API {apiStatus === "online" ? "connected" : apiStatus === "checking" ? "connection checking" : "unavailable"}
                  </strong>
                  <p>
                    {apiStatus === "online"
                      ? "The production API health check succeeded."
                      : apiStatus === "checking"
                        ? "The application is checking the backend."
                        : "Use Check connection to retry the API health check."}
                  </p>
                </div>
              </div>

              {history.length === 0 ? (
                <div className="empty-notifications">
                  <Activity size={22} />
                  <strong>No transaction analyses yet</strong>
                  <p>Your recent prediction activity will appear here.</p>
                </div>
              ) : (
                history.slice(0, 5).map((item) => (
                  <div className="notification-entry" key={item.id}>
                    <span className={`notification-entry-icon ${isFraudLike(item.result) ? "entry-warning" : "entry-success"}`}>
                      {isFraudLike(item.result) ? <AlertTriangle size={17} /> : <CheckCircle2 size={17} />}
                    </span>
                    <div>
                      <strong>
                        {item.type} analysis · {getRiskLabel(item.result)}
                      </strong>
                      <p>
                        Amount {formatAmount(item.amount)} · Decision {getDecision(item.result)}
                      </p>
                      <span className="notification-time">{formatTime(item.createdAt)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="panel-footer">
              <span>Session-only notifications</span>
              <button
                className="button button-secondary button-small"
                onClick={markNotificationsRead}
              >
                <Check size={14} />
                Mark read
              </button>
            </div>
          </section>
        </div>
      )}

      {settingsOpen && (
        <div className="modal-backdrop" onClick={() => setSettingsOpen(false)}>
          <section
            className="settings-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="panel-heading">
              <div>
                <span className="panel-kicker">PREFERENCES</span>
                <h2 id="settings-title">Workspace settings</h2>
                <p>Configure this browser session.</p>
              </div>
              <button
                className="icon-button"
                onClick={() => setSettingsOpen(false)}
                aria-label="Close settings"
              >
                <X size={18} />
              </button>
            </div>

            <div className="settings-section">
              <div className="settings-section-title">
                <Gauge size={17} />
                <span>API configuration</span>
              </div>
              <label className="settings-label" htmlFor="api-endpoint">
                Production API endpoint
              </label>
              <input
                id="api-endpoint"
                className="settings-input"
                value={API_URL}
                readOnly
              />
              <div className="settings-api-status">
                <span className={`status-dot ${apiStatus === "offline" ? "status-dot-danger" : ""}`} />
                <span>
                  {apiStatus === "online"
                    ? "Backend reachable"
                    : apiStatus === "checking"
                      ? "Checking backend"
                      : "Backend unreachable"}
                </span>
                <button
                  className="text-button"
                  onClick={checkApi}
                  disabled={checkingApi}
                >
                  <RefreshCw size={13} className={checkingApi ? "spin" : ""} />
                  Test
                </button>
              </div>
            </div>

            <div className="settings-section">
              <div className="settings-section-title">
                <SlidersHorizontal size={17} />
                <span>Display preferences</span>
              </div>
              <label className="setting-toggle">
                <span>
                  <strong>Compact dashboard</strong>
                  <small>Reduce spacing between dashboard sections.</small>
                </span>
                <input
                  type="checkbox"
                  checked={compactMode}
                  onChange={(event) => setCompactMode(event.target.checked)}
                />
              </label>
            </div>

            <div className="settings-section">
              <div className="settings-section-title">
                <Activity size={17} />
                <span>Session information</span>
              </div>
              <div className="settings-detail-row">
                <span>Analyses this session</span>
                <strong>{analyzedCount}</strong>
              </div>
              <div className="settings-detail-row">
                <span>Risk-flagged responses</span>
                <strong>{fraudLikeCount}</strong>
              </div>
              <div className="settings-detail-row">
                <span>Storage</span>
                <strong>Browser memory</strong>
              </div>
            </div>

            <div className="settings-notice">
              <CircleHelp size={16} />
              <span>
                These preferences apply to this page session. The API endpoint is
                read-only and cannot be changed here.
              </span>
            </div>

            <div className="modal-actions">
              <button
                className="button button-secondary"
                onClick={() => setSettingsOpen(false)}
              >
                Close
              </button>
              <button
                className="button button-primary"
                onClick={() => {
                  setSettingsOpen(false);
                  checkApi();
                }}
              >
                <Check size={15} />
                Done
              </button>
            </div>
          </section>
        </div>
      )}

      {confirmClearHistory && (
        <div className="modal-backdrop" onClick={() => setConfirmClearHistory(false)}>
          <section
            className="confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="clear-history-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="confirm-icon">
              <AlertTriangle size={23} />
            </div>
            <h2 id="clear-history-title">Clear session history?</h2>
            <p>This removes the analyses currently shown in this browser session. It does not delete anything from the API or a database.</p>
            <div className="modal-actions">
              <button
                className="button button-secondary"
                onClick={() => setConfirmClearHistory(false)}
              >
                Cancel
              </button>
              <button className="button button-danger" onClick={clearHistory}>
                Clear history
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function MetricsRow({ analyzedCount, fraudLikeCount, apiStatus }) {
  const metrics = [
    {
      label: "Transactions analyzed",
      value: analyzedCount,
      detail: "This browser session",
      icon: Activity,
      iconClass: "metric-blue",
    },
    {
      label: "Risk-flagged responses",
      value: fraudLikeCount,
      detail: "Based on returned risk and decision fields",
      icon: ShieldAlert,
      iconClass: "metric-amber",
    },
    {
      label: "API connection",
      value: apiStatus === "online" ? "Online" : apiStatus === "checking" ? "Checking" : "Offline",
      detail: "Production backend",
      icon: Zap,
      iconClass: apiStatus === "online" ? "metric-green" : "metric-purple",
    },
  ];

  return (
    <section className="metrics-grid" aria-label="Session metrics">
      {metrics.map(({ label, value, detail, icon: Icon, iconClass }) => (
        <article className="metric-card" key={label}>
          <div className={`metric-icon ${iconClass}`}>
            <Icon size={19} />
          </div>
          <div className="metric-body">
            <span className="metric-label">{label}</span>
            <strong className="metric-value">{value}</strong>
            <span className="metric-detail">{detail}</span>
          </div>
          <div className="metric-card-corner">
            <ArrowDownRight size={16} />
          </div>
        </article>
      ))}
    </section>
  );
}

function TransactionAnalyzer({
  transaction,
  onChange,
  onSubmit,
  onReset,
  analyzing,
  result,
  error,
}) {
  const probability = Number(result?.fraud_probability);
  const hasProbability = Number.isFinite(probability);
  const risk = result ? getRiskLabel(result) : "";
  const decision = result ? getDecision(result) : "";

  return (
    <section className="panel analyzer-panel" id="risk-analyzer">
      <div className="panel-heading">
        <div>
          <div className="section-icon-heading">
            <div className="section-icon"><ShieldCheck size={18} /></div>
            <span>LIVE INFERENCE</span>
          </div>
          <h2>Analyze a transaction</h2>
          <p>Enter transaction details to request a prediction from the deployed model.</p>
        </div>
        <span className="panel-live-indicator"><span className="status-dot" />API</span>
      </div>

      <form onSubmit={onSubmit}>
        <div className="form-grid">
          <div className="form-field form-field-full">
            <label htmlFor="transaction-type">Transaction type</label>
            <div className="select-wrap">
              <select
                id="transaction-type"
                name="type"
                value={transaction.type}
                onChange={onChange}
              >
                <option value="PAYMENT">PAYMENT</option>
                <option value="TRANSFER">TRANSFER</option>
                <option value="CASH_OUT">CASH_OUT</option>
                <option value="CASH_IN">CASH_IN</option>
                <option value="DEBIT">DEBIT</option>
              </select>
              <ChevronRight size={16} />
            </div>
          </div>

          <NumberField
            label="Amount"
            name="amount"
            value={transaction.amount}
            onChange={onChange}
            placeholder="2500"
            min="0"
          />
          <NumberField
            label="Origin balance before"
            name="oldbalanceOrg"
            value={transaction.oldbalanceOrg}
            onChange={onChange}
            placeholder="10000"
            min="0"
          />
          <NumberField
            label="Origin balance after"
            name="newbalanceOrig"
            value={transaction.newbalanceOrig}
            onChange={onChange}
            placeholder="7500"
            min="0"
          />
          <NumberField
            label="Destination balance before"
            name="oldbalanceDest"
            value={transaction.oldbalanceDest}
            onChange={onChange}
            placeholder="5000"
            min="0"
          />
          <NumberField
            label="Destination balance after"
            name="newbalanceDest"
            value={transaction.newbalanceDest}
            onChange={onChange}
            placeholder="7500"
            min="0"
          />
        </div>

        <div className="form-note">
          <CircleHelp size={15} />
          <span>Predictions depend on the model, its training data, and the features used by the API.</span>
        </div>

        {error && (
          <div className="result-error" role="alert">
            <AlertTriangle size={17} />
            <div>
              <strong>Analysis failed</strong>
              <p>{error}</p>
            </div>
          </div>
        )}

        <div className="form-actions">
          <button
            type="button"
            className="button button-secondary"
            onClick={onReset}
            disabled={analyzing}
          >
            Reset
          </button>
          <button type="submit" className="button button-primary analyze-button" disabled={analyzing}>
            {analyzing ? (
              <>
                <LoaderCircle size={16} className="spin" />
                Analyzing...
              </>
            ) : (
              <>
                <ShieldCheck size={16} />
                Analyze transaction
                <ArrowRight size={15} />
              </>
            )}
          </button>
        </div>
      </form>

      {result && (
        <section className="prediction-result" aria-live="polite">
          <div className="result-heading">
            <div className="result-heading-icon"><CheckCircle2 size={18} /></div>
            <div>
              <h3>API response received</h3>
              <p>Prediction returned by the deployed backend</p>
            </div>
            <span className={`risk-pill ${getRiskClass(risk)}`}>{risk}</span>
          </div>

          <div className="result-summary-grid">
            <div className="result-summary-item">
              <span>Fraud probability</span>
              <strong>
                {hasProbability
                  ? `${(probability * 100).toFixed(2)}%`
                  : "Not provided"}
              </strong>
            </div>
            <div className="result-summary-item">
              <span>Decision</span>
              <strong className={decision === "APPROVE" ? "decision-approve" : "decision-other"}>
                {decision}
              </strong>
            </div>
            <div className="result-summary-item">
              <span>Request ID</span>
              <strong className="request-id">
                {result.request_id || "Not provided"}
              </strong>
            </div>
          </div>

          {hasProbability && (
            <div className="probability-track" aria-label={`Fraud probability ${(probability * 100).toFixed(2)} percent`}>
              <div
                className={`probability-fill ${getRiskClass(risk)}`}
                style={{ width: `${Math.max(0, Math.min(100, probability * 100))}%` }}
              />
            </div>
          )}

          <details className="raw-response">
            <summary>View complete API response <ChevronRight size={15} /></summary>
            <pre>{JSON.stringify(result, null, 2)}</pre>
          </details>
          <p className="result-disclaimer">
            Risk level and decision are displayed from the API response. A prediction is not a guarantee that a transaction is fraudulent or legitimate.
          </p>
        </section>
      )}
    </section>
  );
}

function NumberField({ label, name, value, onChange, placeholder, min }) {
  return (
    <div className="form-field">
      <label htmlFor={name}>{label}</label>
      <input
        id={name}
        name={name}
        type="number"
        min={min}
        step="any"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required
      />
    </div>
  );
}

function ActivityCard() {
  return (
    <section className="panel activity-panel">
      <div className="panel-heading">
        <div>
          <div className="section-icon-heading">
            <div className="section-icon section-icon-purple"><TrendingUp size={18} /></div>
            <span>ACTIVITY PREVIEW</span>
          </div>
          <h2>Transaction activity</h2>
          <p>Illustrative volume trend for the dashboard preview.</p>
        </div>
        <span className="sample-pill">Illustrative</span>
      </div>

      <div className="chart-legend">
        <span className="chart-legend-dot" />
        <span>Transaction volume</span>
        <span className="chart-legend-muted">Sample values</span>
      </div>

      <div className="chart-container">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={SAMPLE_ACTIVITY} margin={{ top: 12, right: 5, left: -22, bottom: 0 }}>
            <defs>
              <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7c6cf2" stopOpacity={0.28} />
                <stop offset="100%" stopColor="#7c6cf2" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#222b3b" strokeDasharray="3 4" vertical={false} />
            <XAxis
              dataKey="time"
              tick={{ fill: "#7f8ba0", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickMargin={12}
            />
            <YAxis
              tick={{ fill: "#7f8ba0", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickCount={4}
            />
            <Tooltip
              contentStyle={{
                background: "#151d2a",
                border: "1px solid #30394b",
                borderRadius: 10,
                color: "#f1f5f9",
                fontSize: 12,
              }}
              labelStyle={{ color: "#9ca8ba" }}
              formatter={(value) => [`${value} sample units`, "Volume"]}
            />
            <Area
              type="monotone"
              dataKey="volume"
              stroke="#8b7cf6"
              strokeWidth={2.5}
              fill="url(#volumeGradient)"
              activeDot={{ r: 4, fill: "#a79cff", stroke: "#151d2a", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-footnote">
        <AlertTriangle size={14} />
        <span>Sample data only — not connected to live transaction volume.</span>
      </div>

      <div className="engine-connected">
        <div className="engine-icon"><Zap size={17} /></div>
        <div>
          <strong>Risk engine connected</strong>
          <p>Prediction results come from your deployed API. Verify the returned fields before interpreting a score.</p>
        </div>
        <CheckCircle2 size={18} className="engine-check" />
      </div>
    </section>
  );
}

function RecentAnalyses({ history, full = false }) {
  return (
    <section className="panel history-panel">
      <div className="panel-heading history-heading">
        <div>
          <div className="section-icon-heading">
            <div className="section-icon section-icon-blue"><Clock3 size={18} /></div>
            <span>SESSION RECORDS</span>
          </div>
          <h2>{full ? "All recent analyses" : "Recent analyses"}</h2>
          <p>
            {full
              ? "Predictions generated during this browser session."
              : "Your latest API prediction requests."}
          </p>
        </div>
        <span className="count-pill">{history.length} record{history.length === 1 ? "" : "s"}</span>
      </div>

      {history.length === 0 ? (
        <div className="empty-history">
          <div className="empty-history-icon"><Search size={22} /></div>
          <strong>No analyses yet</strong>
          <p>Submit a transaction to see its prediction recorded here.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="history-table">
            <thead>
              <tr>
                <th>Transaction</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Risk level</th>
                <th>Decision</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item) => {
                const risk = getRiskLabel(item.result);
                const decision = getDecision(item.result);

                return (
                  <tr key={item.id}>
                    <td>
                      <div className="transaction-id-cell">
                        <span className={`table-transaction-icon ${isFraudLike(item.result) ? "table-icon-warning" : ""}`}>
                          {isFraudLike(item.result) ? <ShieldAlert size={15} /> : <ShieldCheck size={15} />}
                        </span>
                        <span>{item.id}</span>
                      </div>
                    </td>
                    <td><span className="type-label">{item.type}</span></td>
                    <td className="amount-cell">{formatAmount(item.amount)}</td>
                    <td><span className={`risk-pill ${getRiskClass(risk)}`}>{risk}</span></td>
                    <td>
                      <span className={`decision-label ${decision === "APPROVE" ? "decision-approve" : "decision-other"}`}>
                        {decision}
                      </span>
                    </td>
                    <td className="time-cell">{formatTime(item.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default App;
