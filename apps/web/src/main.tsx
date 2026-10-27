import React from "react";
import ReactDOM from "react-dom/client";
import {
  Activity,
  Archive,
  ArrowRightLeft,
  ArrowUpRight,
  Ban,
  Check,
  ChevronRight,
  Copy,
  Download,
  Gamepad2,
  KeyRound,
  LockKeyhole,
  LogOut,
  Monitor,
  MousePointer2,
  Pencil,
  Play,
  Plus,
  RefreshCcw,
  RotateCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  UserRound,
  Wifi,
  WifiOff,
  X
} from "lucide-react";
import "./styles.css";

const API_URL = import.meta.env.VITE_API_URL ?? (import.meta.env.PROD ? "/api" : "http://localhost:4100");
const REALTIME_URL = import.meta.env.VITE_REALTIME_URL ?? (import.meta.env.PROD
  ? `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/realtime`
  : "ws://localhost:4200");
const AGENT_INSTALLER_URL = import.meta.env.VITE_AGENT_INSTALLER_URL
  ?? `${API_URL.replace(/\/$/, "")}/downloads/agent`;
const HAS_EXPLICIT_AGENT_INSTALLER_URL = Boolean(import.meta.env.VITE_AGENT_INSTALLER_URL);
const TOKEN_KEY = "remoto.auth.token";
const USER_KEY = "remoto.auth.user";

type DeviceStatus = "online" | "offline";

interface Summary {
  customers: number;
  devices: number;
  onlineDevices: number;
  offlineDevices: number;
  sessions: number;
}

interface HealthResponse {
  gameMode: "disabled" | "experimental";
  agentInstaller: "available" | "not-configured";
}

interface RateLimitDiagnostics {
  store: "redis" | "memory" | "unavailable";
  checkedAt: string;
  redis?: {
    usedMemoryBytes: number | null;
    maxMemoryBytes: number | null;
    keys: number | null;
  };
}

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "technician" | "viewer";
}

interface ManagedUser extends AuthUser {
  active: boolean;
  twoFactorEnabled: boolean;
  createdAt: string;
}

interface Customer {
  id: string;
  name: string;
  document: string;
  contactName: string;
  contactEmail: string;
  deviceCount: number;
  agentKeyCount: number;
}

interface LoginResponse {
  token?: string;
  user: AuthUser;
  requiresTwoFactor?: boolean;
}

class ApiRequestError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
  }
}

interface TwoFactorStatus {
  enabled: boolean;
}

interface TwoFactorSetup {
  secret: string;
  otpauthUri: string;
}

interface Device {
  id: string;
  customerId: string;
  customerName: string;
  displayName: string;
  remoteId: string;
  os: string;
  userName: string;
  localIp: string;
  biosSerial: string | null;
  systemUuid: string | null;
  primaryMac: string | null;
  identityHash: string | null;
  tags: string[];
  status: DeviceStatus;
  secondsSinceLastSeen: number | null;
  archivedAt?: string | null;
}

interface AuditEvent {
  id: string;
  action: string;
  actor: string;
  targetId: string;
  createdAt: string;
}

interface RemoteMonitor {
  index: number;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  primary: boolean;
}

interface InventorySnapshot {
  id: string;
  collectedAt: string;
  hardware: {
    hostname?: string;
    type?: string;
    release?: string;
    arch?: string;
    cpu?: {
      count?: number;
      model?: string;
      speedMhz?: number | null;
    };
    memory?: {
      totalBytes?: number;
      freeBytes?: number;
    };
    disks?: Array<{
      name?: string;
      mountedAt?: string;
      totalBytes?: number;
      freeBytes?: number;
    }>;
    graphics?: {
      adapters?: Array<{ name?: string; adapterRamBytes?: number; driverVersion?: string }>;
      encoding?: string;
    };
  };
  software: {
    runtime?: {
      node?: string;
      agent?: string;
      agentVersion?: string;
    };
    input?: {
      keyboard?: string;
      mouse?: string;
      gamepad?: "keyboard-mouse-map";
      virtualGamepad?: boolean;
      haptics?: boolean;
    };
    capture?: {
      gameModeReady?: boolean;
      ffmpegAvailable?: boolean;
      videoEncoderAvailable?: boolean;
      cpuEncoderAvailable?: boolean;
      selectedEncoderAvailable?: boolean;
      audio?: "off" | "system";
      systemAudioAvailable?: boolean;
      resolvedEncoder?: string;
      resolvedCaptureMethod?: string;
      encoder?: string;
      captureMethod?: string;
      quality?: string;
      width?: number;
      height?: number;
      fps?: number;
      bitrateKbps?: number;
      cpuFallback?: boolean;
    };
    sessions?: {
      interactiveSessionReady?: boolean;
      interactiveTaskInstalled?: boolean;
      interactiveProcessRunning?: boolean;
    };
    displays?: RemoteMonitor[];
  };
}

interface CommandExecution {
  id: string;
  commandType: "ping" | "system-info" | "refresh-inventory" | "list-processes" | "list-services" | "collect-diagnostics";
  status: "pending" | "running" | "succeeded" | "failed";
  requestedBy: string;
  requestedAt: string;
  completedAt: string | null;
  output: unknown;
  error: string | null;
}

interface RemoteSessionResponse {
  id: string;
  status: string;
  mode?: "support" | "game";
  connection?: {
    protocol: string;
    status: "ready" | "not-ready";
    uri?: string;
    command?: string;
    message?: string;
    desktopSession?: {
      sessionId: string;
      deviceId: string;
      mode: "support" | "game";
      monitorIndex?: number;
      role: "host" | "client";
      audio?: "off" | "system";
      remoteId?: string;
      accessToken?: string;
      expiresAt?: string;
    };
  };
}

interface RemoteSessionDescriptor {
  sessionId: string;
  deviceId: string;
  mode: "support" | "game";
  monitorIndex: number | null;
  monitors?: RemoteMonitor[];
  role: "client";
  accessToken: string;
  expiresAt: string;
  audio?: "off" | "system";
}

interface RemoteSession {
  id: string;
  deviceId: string;
  deviceName: string;
  customerName: string;
  remoteId: string;
  technicianName: string;
  reason: string;
  mode: "support" | "game";
  monitorIndex?: number;
  status: "requested" | "approved" | "denied" | "ended";
  requestedAt: string;
  endedAt: string | null;
}

interface AgentKey {
  id: string;
  name: string;
  customerId: string;
  customerName: string;
  active: boolean;
  boundRemoteId: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

interface CreatedAgentKey extends AgentKey {
  key: string;
}

type AppSection = "overview" | "security" | "activity";
type DeviceFilter = "all" | "online" | "offline";

const formatSeen = (seconds: number | null) => {
  if (seconds === null) return "sem heartbeat";
  if (seconds < 5) return "agora";
  if (seconds < 60) return `${seconds}s atras`;
  return `${Math.floor(seconds / 60)}min atras`;
};

const formatBytes = (value?: number) => {
  if (!value || value <= 0) return "n/a";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let nextValue = value;
  let unitIndex = 0;

  while (nextValue >= 1024 && unitIndex < units.length - 1) {
    nextValue /= 1024;
    unitIndex += 1;
  }

  return `${nextValue.toFixed(unitIndex >= 3 ? 1 : 0)} ${units[unitIndex]}`;
};

function commandLabel(commandType: CommandExecution["commandType"]) {
  return {
    ping: "Ping",
    "system-info": "Informacoes do sistema",
    "refresh-inventory": "Atualizar inventario",
    "list-processes": "Processos ativos",
    "list-services": "Servicos instalados",
    "collect-diagnostics": "Diagnostico"
  }[commandType];
}

function formatCommandOutput(value: unknown) {
  if (value === null || value === undefined) return "Sem dados retornados.";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

async function getJson<T>(path: string, token: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined
  });
  const payload = (await response.json().catch(() => ({}))) as { message?: string; code?: string };
  if (!response.ok) throw new ApiRequestError(payload.message ?? `Falha na API: ${response.status}`, response.status, payload.code);
  return payload as T;
}

async function postJson<T>(path: string, token: string, body?: unknown): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const payload = (await response.json().catch(() => ({}))) as { message?: string; code?: string } & T;
  if (!response.ok) throw new ApiRequestError(payload.message ?? `Falha na API: ${response.status}`, response.status, payload.code);
  return payload as T;
}

async function patchJson<T>(path: string, token: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body)
  });

  const payload = (await response.json().catch(() => ({}))) as { message?: string; code?: string } & T;
  if (!response.ok) throw new ApiRequestError(payload.message ?? `Falha na API: ${response.status}`, response.status, payload.code);
  return payload as T;
}

async function deleteJson<T>(path: string, token: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: "DELETE",
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined
  });

  const payload = (await response.json().catch(() => ({}))) as { message?: string; code?: string } & T;
  if (!response.ok) throw new ApiRequestError(payload.message ?? `Falha na API: ${response.status}`, response.status, payload.code);
  return payload as T;
}

function App() {
  const [token, setToken] = React.useState(() => localStorage.getItem(TOKEN_KEY) ?? "");
  const [user, setUser] = React.useState<AuthUser | null>(() => {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  });
  const [authReady, setAuthReady] = React.useState(false);
  const [summary, setSummary] = React.useState<Summary | null>(null);
  const [gameModeEnabled, setGameModeEnabled] = React.useState(false);
  const [agentInstallerAvailable, setAgentInstallerAvailable] = React.useState(HAS_EXPLICIT_AGENT_INSTALLER_URL);
  const [devices, setDevices] = React.useState<Device[]>([]);
  const [auditEvents, setAuditEvents] = React.useState<AuditEvent[]>([]);
  const [sessions, setSessions] = React.useState<RemoteSession[]>([]);
  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [newCustomerName, setNewCustomerName] = React.useState("");
  const [newCustomerDocument, setNewCustomerDocument] = React.useState("");
  const [newCustomerContactName, setNewCustomerContactName] = React.useState("");
  const [newCustomerContactEmail, setNewCustomerContactEmail] = React.useState("");
  const [editingCustomerId, setEditingCustomerId] = React.useState<string | null>(null);
  const [agentKeys, setAgentKeys] = React.useState<AgentKey[]>([]);
  const [managedUsers, setManagedUsers] = React.useState<ManagedUser[]>([]);
  const [editingManagedUserId, setEditingManagedUserId] = React.useState<string | null>(null);
  const [managedUserNameDraft, setManagedUserNameDraft] = React.useState("");
  const [managedUserEmailDraft, setManagedUserEmailDraft] = React.useState("");
  const [archivedDevices, setArchivedDevices] = React.useState<Device[]>([]);
  const [newUserName, setNewUserName] = React.useState("");
  const [newUserEmail, setNewUserEmail] = React.useState("");
  const [newUserPassword, setNewUserPassword] = React.useState("");
  const [newUserRole, setNewUserRole] = React.useState<ManagedUser["role"]>("technician");
  const [newKeyName, setNewKeyName] = React.useState("");
  const [newKeyCustomerId, setNewKeyCustomerId] = React.useState("");
  const [revealedAgentKey, setRevealedAgentKey] = React.useState<string | null>(null);
  const [twoFactorStatus, setTwoFactorStatus] = React.useState<TwoFactorStatus>({ enabled: false });
  const [twoFactorSetup, setTwoFactorSetup] = React.useState<TwoFactorSetup | null>(null);
  const [twoFactorCode, setTwoFactorCode] = React.useState("");
  const [twoFactorMessage, setTwoFactorMessage] = React.useState("");
  const [rateLimitDiagnostics, setRateLimitDiagnostics] = React.useState<RateLimitDiagnostics | null>(null);
  const [rateLimitDiagnosticsLoading, setRateLimitDiagnosticsLoading] = React.useState(false);
  const [loginNotice, setLoginNotice] = React.useState("");
  const [inventorySnapshots, setInventorySnapshots] = React.useState<InventorySnapshot[]>([]);
  const [commands, setCommands] = React.useState<CommandExecution[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = React.useState<string | null>(null);
  const [activeSection, setActiveSection] = React.useState<AppSection>("overview");
  const [deviceQuery, setDeviceQuery] = React.useState("");
  const [deviceFilter, setDeviceFilter] = React.useState<DeviceFilter>("all");
  const [deviceTagsDraft, setDeviceTagsDraft] = React.useState("");
  const [deviceTagsSaving, setDeviceTagsSaving] = React.useState(false);
  const [connectDevice, setConnectDevice] = React.useState<Device | null>(null);
  const [connectReason, setConnectReason] = React.useState("");
  const [connectMode, setConnectMode] = React.useState<"support" | "game">("support");
  const [connectionLoading, setConnectionLoading] = React.useState(false);
  const [onboardingOpen, setOnboardingOpen] = React.useState(false);
  const [onboardingCustomerId, setOnboardingCustomerId] = React.useState("");
  const [onboardingKeyName, setOnboardingKeyName] = React.useState("Novo computador");
  const [onboardingKey, setOnboardingKey] = React.useState<CreatedAgentKey | null>(null);
  const [onboardingLoading, setOnboardingLoading] = React.useState(false);
  const [statusMessage, setStatusMessage] = React.useState("Carregando painel...");
  const [loading, setLoading] = React.useState(true);
  const [gameSession, setGameSession] = React.useState<RemoteSessionDescriptor | null>(null);
  const [gameSessionStarted, setGameSessionStarted] = React.useState(false);

  React.useEffect(() => {
    getJson<HealthResponse>("/health", "")
      .then((health) => {
        setGameModeEnabled(health.gameMode === "experimental");
        if (!HAS_EXPLICIT_AGENT_INSTALLER_URL) setAgentInstallerAvailable(health.agentInstaller === "available");
      })
      .catch(() => {
        setGameModeEnabled(false);
        if (!HAS_EXPLICIT_AGENT_INSTALLER_URL) setAgentInstallerAvailable(false);
      });
  }, []);

  const selectedDevice = devices.find((device) => device.id === selectedDeviceId) ?? devices[0];
  const latestInventory = inventorySnapshots[0];
  const filteredDevices = React.useMemo(() => {
    const normalizedQuery = deviceQuery.trim().toLowerCase();
    return devices.filter((device) => {
      const matchesFilter = deviceFilter === "all" || device.status === deviceFilter;
      const matchesQuery = !normalizedQuery || [
        device.displayName,
        device.customerName,
        device.remoteId,
        device.localIp,
        device.os,
        ...device.tags
      ].some((value) => value.toLowerCase().includes(normalizedQuery));
      return matchesFilter && matchesQuery;
    });
  }, [deviceFilter, deviceQuery, devices]);

  React.useEffect(() => {
    if (!gameModeEnabled && connectMode === "game") setConnectMode("support");
  }, [connectMode, gameModeEnabled]);

  React.useEffect(() => {
    if (filteredDevices.length > 0 && !filteredDevices.some((device) => device.id === selectedDeviceId)) {
      setSelectedDeviceId(filteredDevices[0].id);
    }
  }, [filteredDevices, selectedDeviceId]);

  React.useEffect(() => {
    setDeviceTagsDraft(selectedDevice?.tags.join(", ") ?? "");
  }, [selectedDevice?.id, selectedDevice?.tags]);

  React.useEffect(() => {
    let active = true;
    getJson<AuthUser>("/auth/me", token)
      .then((nextUser) => {
        if (!active) return;
        setUser(nextUser);
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
      })
      .catch(() => {
        if (!active) return;
        setToken("");
        setUser(null);
      })
      .finally(() => {
        if (active) setAuthReady(true);
      });

    return () => {
      active = false;
    };
  }, [token]);

  function saveSession(next: LoginResponse) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(next.token ?? "");
    setUser(next.user);
    setLoginNotice("");
    setAuthReady(true);
    setStatusMessage("Login realizado");
  }

  function resetLocalSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken("");
    setUser(null);
    setSummary(null);
    setDevices([]);
    setAuditEvents([]);
    setSessions([]);
    setArchivedDevices([]);
    setCustomers([]);
    setAgentKeys([]);
    setRevealedAgentKey(null);
    setTwoFactorStatus({ enabled: false });
    setTwoFactorSetup(null);
    setTwoFactorCode("");
    setTwoFactorMessage("");
    setRateLimitDiagnostics(null);
    setRateLimitDiagnosticsLoading(false);
    setSelectedDeviceId(null);
    setActiveSection("overview");
    setDeviceQuery("");
    setDeviceFilter("all");
    setConnectDevice(null);
    setConnectReason("");
    setOnboardingOpen(false);
    setOnboardingKey(null);
  }

  function logout() {
    void postJson<{ ok: boolean }>("/auth/logout", token).catch(() => undefined);
    resetLocalSession();
  }

  const refresh = React.useCallback(async () => {
    if (!token && !user) return;

    setLoading(true);
    try {
      const [nextSummary, nextDevices, nextAuditEvents, nextSessions] = await Promise.all([
        getJson<Summary>("/summary", token),
        getJson<Device[]>("/devices", token),
        getJson<AuditEvent[]>("/audit-events", token),
        getJson<RemoteSession[]>("/remote-sessions", token)
      ]);

      setSummary(nextSummary);
      setDevices(nextDevices);
      setAuditEvents(nextAuditEvents);
      setSessions(nextSessions);
      setSelectedDeviceId((current) => current ?? nextDevices[0]?.id ?? null);
      setStatusMessage("Painel atualizado");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Erro ao carregar painel");
      if (error instanceof ApiRequestError && error.code === "two_factor_required") {
        setActiveSection("security");
        setStatusMessage("Ative o 2FA para liberar as operacoes remotas.");
      } else if (error instanceof ApiRequestError && error.status === 401) {
        logout();
      }
    } finally {
      setLoading(false);
    }
  }, [token, user]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const canManageKeys = user?.role === "owner" || user?.role === "admin";
  const canManageOwnSecurity = user?.role === "owner" || user?.role === "admin" || user?.role === "technician";

  async function refreshRateLimitDiagnostics() {
    if (!canManageKeys) return;
    setRateLimitDiagnosticsLoading(true);
    try {
      setRateLimitDiagnostics(await getJson<RateLimitDiagnostics>("/admin/rate-limit/diagnostics", token));
    } catch {
      setRateLimitDiagnostics({ store: "unavailable", checkedAt: new Date().toISOString() });
    } finally {
      setRateLimitDiagnosticsLoading(false);
    }
  }

  React.useEffect(() => {
    if (!user || !canManageOwnSecurity) {
      setCustomers([]);
      setAgentKeys([]);
      setRateLimitDiagnostics(null);
      return;
    }

    let active = true;
    const twoFactorRequest = getJson<TwoFactorStatus>("/auth/2fa/status", token);
    const adminRequest = canManageKeys
      ? Promise.all([
          getJson<Customer[]>("/customers", token),
          getJson<AgentKey[]>("/agent-keys", token),
          getJson<ManagedUser[]>("/users", token),
          getJson<Device[]>("/devices/archived", token)
        ])
      : Promise.resolve(null);
    const diagnosticsRequest = canManageKeys
      ? getJson<RateLimitDiagnostics>("/admin/rate-limit/diagnostics", token).catch(() => ({ store: "unavailable" as const, checkedAt: new Date().toISOString() }))
      : Promise.resolve(null);
    Promise.all([twoFactorRequest, adminRequest, diagnosticsRequest])
      .then(([nextTwoFactorStatus, adminData, nextRateLimitDiagnostics]) => {
        if (!active) return;
        setTwoFactorStatus(nextTwoFactorStatus);
        setRateLimitDiagnostics(nextRateLimitDiagnostics);
        if (adminData) {
          const [nextCustomers, nextKeys, nextUsers, nextArchivedDevices] = adminData;
          setCustomers(nextCustomers);
          setAgentKeys(nextKeys);
          setManagedUsers(nextUsers);
          setArchivedDevices(nextArchivedDevices);
          setNewKeyCustomerId((current) => current || nextCustomers[0]?.id || "");
          setOnboardingCustomerId((current) => current || nextCustomers[0]?.id || "");
        }
      })
      .catch(() => {
        if (active) setStatusMessage("Nao foi possivel carregar a protecao da conta");
      });

    return () => {
      active = false;
    };
  }, [canManageKeys, canManageOwnSecurity, user?.id]);

  React.useEffect(() => {
    if (!user || !selectedDevice?.id) {
      setInventorySnapshots([]);
      setCommands([]);
      return;
    }

    setInventorySnapshots([]);
    setCommands([]);
    let active = true;

    const loadSelectedDeviceData = async () => {
      const [snapshots, nextCommands] = await Promise.all([
        getJson<InventorySnapshot[]>(`/devices/${selectedDevice.id}/inventory`, token),
        getJson<CommandExecution[]>(`/devices/${selectedDevice.id}/commands`, token)
      ]);
      if (!active) return nextCommands;
      setInventorySnapshots(snapshots);
      setCommands(nextCommands);
      return nextCommands;
    };

    void loadSelectedDeviceData().catch(() => {
      if (active) {
        setInventorySnapshots([]);
        setCommands([]);
      }
    });

    const commandRefreshTimer = window.setInterval(async () => {
      try {
        const nextCommands = await getJson<CommandExecution[]>(`/devices/${selectedDevice.id}/commands`, token);
        if (active) setCommands(nextCommands);
      } catch {
        // A transient refresh failure should not erase the last visible result.
      }
    }, 4000);

    return () => {
      active = false;
      window.clearInterval(commandRefreshTimer);
    };
  }, [selectedDevice?.id, token, user?.id]);

  async function sendHeartbeat(deviceId: string) {
    setStatusMessage("Enviando heartbeat...");
    await postJson<Device>(`/devices/${deviceId}/heartbeat`, token);
    await refresh();
  }

  function requestSession(device: Device) {
    setSelectedDeviceId(device.id);
    setConnectDevice(device);
    setConnectReason("Atendimento tecnico");
    setConnectMode("support");
  }

  async function confirmConnection() {
    if (!connectDevice || connectReason.trim().length < 4) {
      setStatusMessage("Informe o motivo do acesso antes de continuar");
      return;
    }
    if (connectMode === "game" && !gameModeEnabled) {
      setStatusMessage("O modo jogo esta desabilitado neste ambiente.");
      return;
    }

    setConnectionLoading(true);
    setStatusMessage("Registrando solicitacao de acesso...");
    try {
      const session = await postJson<RemoteSessionResponse>("/remote-sessions", token, {
        deviceId: connectDevice.id,
        reason: connectReason.trim(),
        mode: connectMode
      });
      setConnectDevice(null);
      setConnectReason("");
      await refresh();
      setStatusMessage("Solicitacao registrada. Aguardando aprovacao administrativa.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Nao foi possivel abrir a sessao");
    } finally {
      setConnectionLoading(false);
    }
  }

  async function approveRemoteSession(session: RemoteSession) {
    try {
      const approved = await postJson<RemoteSessionResponse>(`/remote-sessions/${session.id}/approve`, token);
      if (approved.connection?.desktopSession?.accessToken) {
        const freshInventory = await getJson<InventorySnapshot[]>(`/devices/${session.deviceId}/inventory`, token).catch(() => []);
        setGameSession({
          sessionId: approved.connection.desktopSession.sessionId,
          deviceId: approved.connection.desktopSession.deviceId,
          mode: approved.connection.desktopSession.mode,
          monitorIndex: approved.connection.desktopSession.monitorIndex ?? null,
          monitors: freshInventory[0]?.software.displays ?? [],
          role: "client",
          audio: approved.connection.desktopSession.audio ?? "off",
          accessToken: approved.connection.desktopSession.accessToken,
          expiresAt: approved.connection.desktopSession.expiresAt ?? new Date(Date.now() + 5 * 60_000).toISOString()
        });
        setGameSessionStarted(false);
        setStatusMessage("Sessao de jogo autorizada. Escolha onde abrir.");
      } else if (approved.connection?.uri) window.location.assign(approved.connection.uri);
      else if (approved.connection?.message) setStatusMessage(approved.connection.message);
      await refresh();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Nao foi possivel aprovar a sessao");
    }
  }

  async function denyRemoteSession(session: RemoteSession) {
    try {
      await postJson(`/remote-sessions/${session.id}/deny`, token);
      await refresh();
      setStatusMessage("Sessao negada");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Nao foi possivel negar a sessao");
    }
  }

  async function endRemoteSession(session: RemoteSession) {
    try {
      await postJson(`/remote-sessions/${session.id}/end`, token);
      await refresh();
      setStatusMessage("Sessao encerrada");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Nao foi possivel encerrar a sessao");
    }
  }

  async function closeGameSession() {
    if (!gameSession) return;
    try {
      await postJson(`/remote-sessions/${gameSession.sessionId}/end`, token);
      setGameSession(null);
      setGameSessionStarted(false);
      await refresh();
      setStatusMessage("Sessao de jogo encerrada");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Nao foi possivel encerrar a sessao de jogo");
    }
  }

  async function launchGameInBrowser() {
    if (!gameSession || gameSessionStarted) return;
    try {
      const consumed = await postJson<Omit<RemoteSessionDescriptor, "accessToken">>("/desktop-sessions/consume", token, {
        accessToken: gameSession.accessToken
      });
      setGameSession({ ...consumed, monitors: gameSession.monitors, accessToken: gameSession.accessToken });
      setGameSessionStarted(true);
      setStatusMessage("Sessao de jogo aberta no navegador.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Nao foi possivel abrir a sessao no navegador");
    }
  }

  async function requestCommand(device: Device, commandType: CommandExecution["commandType"]) {
    setStatusMessage(`Criando comando ${commandType}...`);
    await postJson(`/devices/${device.id}/commands`, token, { commandType });
    const nextCommands = await getJson<CommandExecution[]>(`/devices/${device.id}/commands`, token);
    setCommands(nextCommands);
    setStatusMessage("Comando criado");
  }

  async function createAgentKey() {
    if (!newKeyCustomerId || newKeyName.trim().length < 3) {
      setStatusMessage("Informe cliente e nome para a chave");
      return;
    }

    const created = await postJson<CreatedAgentKey>("/agent-keys", token, {
      customerId: newKeyCustomerId,
      name: newKeyName.trim()
    });
    setAgentKeys((current) => [created, ...current]);
    setNewKeyName("");
    setRevealedAgentKey(created.key);
    setStatusMessage("Chave criada. Copie o segredo agora; ele nao sera exibido novamente.");
  }

  async function createCustomer() {
    if (
      newCustomerName.trim().length < 2 ||
      newCustomerDocument.trim().length < 3 ||
      newCustomerContactName.trim().length < 2 ||
      !newCustomerContactEmail.includes("@")
    ) {
      setStatusMessage("Preencha os dados do cliente corretamente");
      return;
    }

    try {
      const created = await postJson<Customer>("/customers", token, {
        name: newCustomerName.trim(),
        document: newCustomerDocument.trim(),
        contactName: newCustomerContactName.trim(),
        contactEmail: newCustomerContactEmail.trim()
      });
      setCustomers((current) => [...current, created].sort((left, right) => left.name.localeCompare(right.name)));
      setNewCustomerName("");
      setNewCustomerDocument("");
      setNewCustomerContactName("");
      setNewCustomerContactEmail("");
      setEditingCustomerId(null);
      setNewKeyCustomerId((current) => current || created.id);
      setOnboardingCustomerId((current) => current || created.id);
      setStatusMessage("Cliente cadastrado");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Nao foi possivel cadastrar o cliente");
    }
  }

  function beginCustomerEdit(customer: Customer) {
    setEditingCustomerId(customer.id);
    setNewCustomerName(customer.name);
    setNewCustomerDocument(customer.document);
    setNewCustomerContactName(customer.contactName);
    setNewCustomerContactEmail(customer.contactEmail);
  }

  async function saveCustomer() {
    if (!editingCustomerId) {
      await createCustomer();
      return;
    }
    if (newCustomerName.trim().length < 2 || newCustomerDocument.trim().length < 3 || newCustomerContactName.trim().length < 2 || !newCustomerContactEmail.includes("@")) {
      setStatusMessage("Preencha os dados do cliente corretamente");
      return;
    }
    try {
      const updated = await patchJson<Customer>(`/customers/${editingCustomerId}`, token, {
        name: newCustomerName.trim(),
        document: newCustomerDocument.trim(),
        contactName: newCustomerContactName.trim(),
        contactEmail: newCustomerContactEmail.trim()
      });
      setCustomers((current) => current.map((customer) => customer.id === updated.id ? updated : customer).sort((left, right) => left.name.localeCompare(right.name)));
      setNewCustomerName("");
      setNewCustomerDocument("");
      setNewCustomerContactName("");
      setNewCustomerContactEmail("");
      setEditingCustomerId(null);
      setStatusMessage("Cliente atualizado");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Nao foi possivel atualizar o cliente");
    }
  }

  async function deleteCustomer(customer: Customer) {
    if (!window.confirm(`Excluir o cliente ${customer.name}?`)) return;

    try {
      await deleteJson<Customer>(`/customers/${customer.id}`, token);
      setCustomers((current) => current.filter((item) => item.id !== customer.id));
      setNewKeyCustomerId((current) => (current === customer.id ? "" : current));
      setOnboardingCustomerId((current) => (current === customer.id ? "" : current));
      setStatusMessage(`Cliente ${customer.name} excluido`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Nao foi possivel excluir o cliente");
    }
  }

  async function moveDevice(device: Device, customerId: string) {
    const target = customers.find((customer) => customer.id === customerId);
    if (!target || target.id === device.customerId) return;
    if (!window.confirm(`Mover ${device.displayName} de ${device.customerName} para ${target.name}? A chave ativa vinculada acompanha a transferencia e as sessoes abertas serao encerradas.`)) return;

    try {
      await patchJson<Device>(`/devices/${device.id}/customer`, token, { customerId: target.id });
      await refresh();
      setStatusMessage(`${device.displayName} movido para ${target.name}`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Nao foi possivel mover o dispositivo");
    }
  }

  async function updateDeviceTags(device: Device) {
    const tags = [...new Set(deviceTagsDraft.split(",").map((tag) => tag.trim()).filter(Boolean))];
    if (tags.length > 20 || tags.some((tag) => tag.length > 40)) {
      setStatusMessage("Use ate 20 etiquetas com no maximo 40 caracteres cada");
      return;
    }

    setDeviceTagsSaving(true);
    try {
      const updated = await patchJson<Device>(`/devices/${device.id}/tags`, token, { tags });
      setDevices((current) => current.map((item) => item.id === updated.id ? updated : item));
      setDeviceTagsDraft(updated.tags.join(", "));
      setStatusMessage("Etiquetas do dispositivo atualizadas");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Nao foi possivel atualizar as etiquetas");
    } finally {
      setDeviceTagsSaving(false);
    }
  }

  async function createManagedUser() {
    if (newUserName.trim().length < 2 || !newUserEmail.includes("@") || newUserPassword.length < 8) {
      setStatusMessage("Informe nome, email e senha com pelo menos 8 caracteres");
      return;
    }
    try {
      const created = await postJson<ManagedUser>("/users", token, { name: newUserName.trim(), email: newUserEmail.trim(), password: newUserPassword, role: newUserRole });
      setManagedUsers((current) => [...current, created].sort((left, right) => left.name.localeCompare(right.name)));
      setNewUserName("");
      setNewUserEmail("");
      setNewUserPassword("");
      setStatusMessage("Usuario criado");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Nao foi possivel criar o usuario");
    }
  }

  async function toggleManagedUser(userToUpdate: ManagedUser) {
    if (userToUpdate.id === user?.id && userToUpdate.active) return;
    try {
      const updated = await patchJson<ManagedUser>(`/users/${userToUpdate.id}`, token, {
        name: userToUpdate.name,
        email: userToUpdate.email,
        role: userToUpdate.role,
        active: !userToUpdate.active
      });
      setManagedUsers((current) => current.map((item) => item.id === updated.id ? updated : item));
      setStatusMessage(updated.active ? "Usuario ativado" : "Usuario desativado");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Nao foi possivel atualizar o usuario");
    }
  }

  async function changeManagedUserRole(userToUpdate: ManagedUser, role: ManagedUser["role"]) {
    if (role === userToUpdate.role) return;
    if (!window.confirm(`Alterar a funcao de ${userToUpdate.name} para ${role}? As sessoes remotas deste usuario serao revogadas.`)) return;
    try {
      const updated = await patchJson<ManagedUser>(`/users/${userToUpdate.id}`, token, {
        name: userToUpdate.name,
        email: userToUpdate.email,
        role,
        active: userToUpdate.active
      });
      setManagedUsers((current) => current.map((item) => item.id === updated.id ? updated : item));
      setStatusMessage("Funcao do usuario atualizada");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Nao foi possivel atualizar a funcao");
    }
  }

  function beginManagedUserEdit(userToUpdate: ManagedUser) {
    if (userToUpdate.id === user?.id) return;
    setEditingManagedUserId(userToUpdate.id);
    setManagedUserNameDraft(userToUpdate.name);
    setManagedUserEmailDraft(userToUpdate.email);
  }

  function cancelManagedUserEdit() {
    setEditingManagedUserId(null);
    setManagedUserNameDraft("");
    setManagedUserEmailDraft("");
  }

  async function saveManagedUserEdit(userToUpdate: ManagedUser) {
    const name = managedUserNameDraft.trim();
    const email = managedUserEmailDraft.trim().toLowerCase();
    if (name.length < 2 || !email.includes("@")) {
      setStatusMessage("Informe nome e email validos");
      return;
    }
    try {
      const updated = await patchJson<ManagedUser>(`/users/${userToUpdate.id}`, token, {
        name,
        email,
        role: userToUpdate.role,
        active: userToUpdate.active
      });
      setManagedUsers((current) => current.map((item) => item.id === updated.id ? updated : item));
      cancelManagedUserEdit();
      setStatusMessage("Dados do usuario atualizados");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Nao foi possivel atualizar os dados do usuario");
    }
  }

  async function resetManagedUserPassword(userToUpdate: ManagedUser) {
    const password = window.prompt(`Nova senha para ${userToUpdate.email} (minimo 8 caracteres):`);
    if (!password) return;
    try {
      await postJson<{ ok: boolean }>(`/users/${userToUpdate.id}/reset-password`, token, { password });
      setStatusMessage("Senha redefinida");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Nao foi possivel redefinir a senha");
    }
  }

  async function deleteDevice(device: Device) {
    if (!window.confirm(`Excluir ${device.displayName}? Se o agente continuar instalado com uma chave ativa, ele podera se cadastrar novamente.`)) return;

    try {
      await deleteJson<{ id: string; displayName: string }>(`/devices/${device.id}`, token);
      setSelectedDeviceId(null);
      await refresh();
      setStatusMessage(`${device.displayName} excluido`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Nao foi possivel excluir o dispositivo");
    }
  }

  async function archiveDevice(device: Device) {
    if (!window.confirm(`Arquivar ${device.displayName}? O agente deixara de atualizar este registro ate ele ser restaurado.`)) return;
    try {
      await postJson(`/devices/${device.id}/archive`, token);
      await refresh();
      setStatusMessage(`${device.displayName} arquivado`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Nao foi possivel arquivar o dispositivo");
    }
  }

  async function restoreDevice(device: Device) {
    try {
      await postJson<Device>(`/devices/${device.id}/restore`, token);
      const nextArchived = await getJson<Device[]>("/devices/archived", token);
      setArchivedDevices(nextArchived);
      await refresh();
      setStatusMessage(`${device.displayName} restaurado`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Nao foi possivel restaurar o dispositivo");
    }
  }

  function openOnboarding() {
    setOnboardingCustomerId((current) => current || customers[0]?.id || "");
    setOnboardingKeyName("Novo computador");
    setOnboardingKey(null);
    setOnboardingOpen(true);
  }

  async function createOnboardingKey() {
    if (!onboardingCustomerId || onboardingKeyName.trim().length < 3) {
      setStatusMessage("Informe cliente e nome para o computador");
      return;
    }

    setOnboardingLoading(true);
    try {
      const created = await postJson<CreatedAgentKey>("/agent-keys", token, {
        customerId: onboardingCustomerId,
        name: onboardingKeyName.trim()
      });
      setAgentKeys((current) => [created, ...current]);
      setOnboardingKey(created);
      setStatusMessage("Chave de cadastro criada");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Nao foi possivel criar a chave");
    } finally {
      setOnboardingLoading(false);
    }
  }

  async function copyOnboardingKey() {
    if (!onboardingKey?.key) return;
    await navigator.clipboard.writeText(onboardingKey.key);
    setStatusMessage("Chave de cadastro copiada");
  }

  function downloadAgentProfile() {
    if (!onboardingKey?.key) return;
    const apiUrl = API_URL.startsWith("/")
      ? new URL(API_URL, window.location.origin).toString().replace(/\/$/, "")
      : API_URL;
    const realtimeUrl = REALTIME_URL.startsWith("/")
      ? new URL(REALTIME_URL, window.location.origin).toString().replace(/^http:/, "ws:").replace(/^https:/, "wss:").replace(/\/$/, "")
      : REALTIME_URL;
    const profile = {
      format: "remoto-agent-profile",
      version: 1,
      apiUrl,
      realtimeUrl,
      agentKey: onboardingKey.key,
      customerName: onboardingKey.customerName,
      createdAt: new Date().toISOString()
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(profile, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "remoto-agent-profile.json";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setStatusMessage("Perfil de instalacao baixado");
  }

  function downloadAgentBundle() {
    downloadAgentProfile();
    if (!agentInstallerAvailable) return;

    const anchor = document.createElement("a");
    anchor.href = AGENT_INSTALLER_URL;
    anchor.download = "RemotoAgent-Setup.exe";
    anchor.target = "_blank";
    anchor.rel = "noreferrer";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setStatusMessage("Perfil e instalador baixados; abra o instalador na pasta Downloads");
  }

  async function revokeAgentKey(key: AgentKey) {
    const revoked = await postJson<AgentKey>(`/agent-keys/${key.id}/revoke`, token);
    setAgentKeys((current) => current.map((item) => (item.id === revoked.id ? revoked : item)));
    if (revealedAgentKey) setRevealedAgentKey(null);
    setStatusMessage(`Chave ${key.name} revogada`);
  }

  async function copyAgentKey() {
    if (!revealedAgentKey) return;
    await navigator.clipboard.writeText(revealedAgentKey);
    setStatusMessage("Chave copiada");
  }

  async function prepareTwoFactor() {
    const setup = await postJson<TwoFactorSetup>("/auth/2fa/setup", token);
    setTwoFactorSetup(setup);
    setTwoFactorCode("");
    setTwoFactorMessage("Escaneie a URI ou informe o segredo no seu autenticador e confirme com o codigo atual.");
  }

  async function enableTwoFactor() {
    if (!/^\d{6}$/.test(twoFactorCode)) {
      setTwoFactorMessage("Informe um codigo de 6 digitos.");
      return;
    }

    await postJson<{ enabled: boolean; sessionRevoked: boolean }>("/auth/2fa/enable", token, { code: twoFactorCode });
    setLoginNotice("2FA ativado. Entre novamente para continuar.");
    resetLocalSession();
  }

  async function disableTwoFactor() {
    if (!/^\d{6}$/.test(twoFactorCode)) {
      setTwoFactorMessage("Informe o codigo atual de 6 digitos para desativar.");
      return;
    }

    await postJson<{ enabled: boolean; sessionRevoked: boolean }>("/auth/2fa/disable", token, { code: twoFactorCode });
    setLoginNotice("2FA desativado. Entre novamente para continuar.");
    resetLocalSession();
  }

  if (!authReady) {
    return <main className="loginShell">Carregando sessao...</main>;
  }

  if (!user) {
    return <LoginScreen onLogin={saveSession} notice={loginNotice} />;
  }

  return <OperationsConsole
    user={user}
    summary={summary}
    devices={devices}
    filteredDevices={filteredDevices}
    selectedDevice={selectedDevice}
    selectedDeviceId={selectedDeviceId}
    activeSection={activeSection}
    deviceQuery={deviceQuery}
    deviceFilter={deviceFilter}
    auditEvents={auditEvents}
    sessions={sessions}
    latestInventory={latestInventory}
    commands={commands}
    customers={customers}
    newCustomerName={newCustomerName}
    newCustomerDocument={newCustomerDocument}
    newCustomerContactName={newCustomerContactName}
    newCustomerContactEmail={newCustomerContactEmail}
    agentKeys={agentKeys}
    newKeyName={newKeyName}
    newKeyCustomerId={newKeyCustomerId}
    revealedAgentKey={revealedAgentKey}
    twoFactorStatus={twoFactorStatus}
    twoFactorSetup={twoFactorSetup}
    twoFactorCode={twoFactorCode}
    twoFactorMessage={twoFactorMessage}
    canManageKeys={canManageKeys}
    canManageOwnSecurity={canManageOwnSecurity}
    rateLimitDiagnostics={rateLimitDiagnostics}
    rateLimitDiagnosticsLoading={rateLimitDiagnosticsLoading}
    onRefreshRateLimitDiagnostics={() => void refreshRateLimitDiagnostics()}
    connectDevice={connectDevice}
    connectReason={connectReason}
    gameModeEnabled={gameModeEnabled}
    connectionLoading={connectionLoading}
    onboardingOpen={onboardingOpen}
    onboardingCustomerId={onboardingCustomerId}
    onboardingKeyName={onboardingKeyName}
    onboardingKey={onboardingKey}
    onboardingLoading={onboardingLoading}
    agentInstallerAvailable={agentInstallerAvailable}
    loading={loading}
    statusMessage={statusMessage}
    onSectionChange={setActiveSection}
    onDeviceQueryChange={setDeviceQuery}
    onDeviceFilterChange={setDeviceFilter}
    onSelectDevice={setSelectedDeviceId}
    onRefresh={() => void refresh()}
    onLogout={logout}
    onHeartbeat={(deviceId) => void sendHeartbeat(deviceId)}
    onRequestSession={requestSession}
    onRequestCommand={(device, commandType) => void requestCommand(device, commandType)}
    onApproveRemoteSession={(session) => void approveRemoteSession(session)}
    onDenyRemoteSession={(session) => void denyRemoteSession(session)}
    onEndRemoteSession={(session) => void endRemoteSession(session)}
    onMoveDevice={(device, customerId) => void moveDevice(device, customerId)}
    deviceTagsDraft={deviceTagsDraft}
    deviceTagsSaving={deviceTagsSaving}
    onDeviceTagsDraftChange={setDeviceTagsDraft}
    onUpdateDeviceTags={(device) => void updateDeviceTags(device)}
    onDeleteDevice={(device) => void deleteDevice(device)}
    onArchiveDevice={(device) => void archiveDevice(device)}
    archivedDevices={archivedDevices}
    onRestoreDevice={(device) => void restoreDevice(device)}
    onNewCustomerNameChange={setNewCustomerName}
    onNewCustomerDocumentChange={setNewCustomerDocument}
    onNewCustomerContactNameChange={setNewCustomerContactName}
    onNewCustomerContactEmailChange={setNewCustomerContactEmail}
    onCreateCustomer={() => void createCustomer()}
    editingCustomerId={editingCustomerId}
    onBeginCustomerEdit={beginCustomerEdit}
    onCancelCustomerEdit={() => { setEditingCustomerId(null); setNewCustomerName(""); setNewCustomerDocument(""); setNewCustomerContactName(""); setNewCustomerContactEmail(""); }}
    onSaveCustomer={() => void saveCustomer()}
    onDeleteCustomer={(customer) => void deleteCustomer(customer)}
    managedUsers={managedUsers}
    newUserName={newUserName}
    newUserEmail={newUserEmail}
    newUserPassword={newUserPassword}
    newUserRole={newUserRole}
    onNewUserNameChange={setNewUserName}
    onNewUserEmailChange={setNewUserEmail}
    onNewUserPasswordChange={setNewUserPassword}
    onNewUserRoleChange={setNewUserRole}
    onCreateManagedUser={() => void createManagedUser()}
    onToggleManagedUser={(managedUser) => void toggleManagedUser(managedUser)}
    onChangeManagedUserRole={(managedUser, role) => void changeManagedUserRole(managedUser, role)}
    editingManagedUserId={editingManagedUserId}
    managedUserNameDraft={managedUserNameDraft}
    managedUserEmailDraft={managedUserEmailDraft}
    onBeginManagedUserEdit={beginManagedUserEdit}
    onCancelManagedUserEdit={cancelManagedUserEdit}
    onSaveManagedUserEdit={(managedUser) => void saveManagedUserEdit(managedUser)}
    onManagedUserNameChange={setManagedUserNameDraft}
    onManagedUserEmailChange={setManagedUserEmailDraft}
    onResetManagedUserPassword={(managedUser) => void resetManagedUserPassword(managedUser)}
    onKeyNameChange={setNewKeyName}
    onKeyCustomerChange={setNewKeyCustomerId}
    onCreateKey={() => void createAgentKey()}
    onCopyKey={() => void copyAgentKey()}
    onRevokeKey={(key) => void revokeAgentKey(key)}
    onTwoFactorCodeChange={setTwoFactorCode}
    onPrepareTwoFactor={() => void prepareTwoFactor()}
    onEnableTwoFactor={() => void enableTwoFactor()}
    onDisableTwoFactor={() => void disableTwoFactor()}
    onConnectReasonChange={setConnectReason}
    connectMode={connectMode}
    onConnectModeChange={setConnectMode}
    onCloseConnection={() => { setConnectDevice(null); setConnectReason(""); setConnectMode("support"); }}
    onConfirmConnection={() => void confirmConnection()}
    onOpenOnboarding={openOnboarding}
    onCloseOnboarding={() => { setOnboardingOpen(false); setOnboardingKey(null); }}
    onOnboardingCustomerChange={setOnboardingCustomerId}
    onOnboardingKeyNameChange={setOnboardingKeyName}
    onCreateOnboardingKey={() => void createOnboardingKey()}
    onCopyOnboardingKey={() => void copyOnboardingKey()}
    onDownloadAgentProfile={downloadAgentProfile}
    onDownloadAgentBundle={downloadAgentBundle}
    gameSession={gameSession}
    gameSessionStarted={gameSessionStarted}
    onLaunchGameInBrowser={() => void launchGameInBrowser()}
    onCloseGameSession={() => void closeGameSession()}
  />;
}

interface OperationsConsoleProps {
  user: AuthUser;
  summary: Summary | null;
  devices: Device[];
  filteredDevices: Device[];
  selectedDevice: Device | undefined;
  selectedDeviceId: string | null;
  activeSection: AppSection;
  deviceQuery: string;
  deviceFilter: DeviceFilter;
  auditEvents: AuditEvent[];
  sessions: RemoteSession[];
  latestInventory: InventorySnapshot | undefined;
  commands: CommandExecution[];
  customers: Customer[];
  newCustomerName: string;
  newCustomerDocument: string;
  newCustomerContactName: string;
  newCustomerContactEmail: string;
  agentKeys: AgentKey[];
  newKeyName: string;
  newKeyCustomerId: string;
  revealedAgentKey: string | null;
  twoFactorStatus: TwoFactorStatus;
  twoFactorSetup: TwoFactorSetup | null;
  twoFactorCode: string;
  twoFactorMessage: string;
  canManageKeys: boolean;
  canManageOwnSecurity: boolean;
  rateLimitDiagnostics: RateLimitDiagnostics | null;
  rateLimitDiagnosticsLoading: boolean;
  onRefreshRateLimitDiagnostics: () => void;
  connectDevice: Device | null;
  connectReason: string;
  connectMode: "support" | "game";
  gameModeEnabled: boolean;
  connectionLoading: boolean;
  onboardingOpen: boolean;
  onboardingCustomerId: string;
  onboardingKeyName: string;
  onboardingKey: CreatedAgentKey | null;
  onboardingLoading: boolean;
  agentInstallerAvailable: boolean;
  loading: boolean;
  statusMessage: string;
  onSectionChange: (section: AppSection) => void;
  onDeviceQueryChange: (value: string) => void;
  onDeviceFilterChange: (filter: DeviceFilter) => void;
  onSelectDevice: (deviceId: string) => void;
  onRefresh: () => void;
  onLogout: () => void;
  onHeartbeat: (deviceId: string) => void;
  onRequestSession: (device: Device) => void;
  onRequestCommand: (device: Device, commandType: CommandExecution["commandType"]) => void;
  onApproveRemoteSession: (session: RemoteSession) => void;
  onDenyRemoteSession: (session: RemoteSession) => void;
  onEndRemoteSession: (session: RemoteSession) => void;
  onMoveDevice: (device: Device, customerId: string) => void;
  deviceTagsDraft: string;
  deviceTagsSaving: boolean;
  onDeviceTagsDraftChange: (value: string) => void;
  onUpdateDeviceTags: (device: Device) => void;
  onDeleteDevice: (device: Device) => void;
  onArchiveDevice: (device: Device) => void;
  archivedDevices: Device[];
  onRestoreDevice: (device: Device) => void;
  onNewCustomerNameChange: (value: string) => void;
  onNewCustomerDocumentChange: (value: string) => void;
  onNewCustomerContactNameChange: (value: string) => void;
  onNewCustomerContactEmailChange: (value: string) => void;
  onCreateCustomer: () => void;
  editingCustomerId: string | null;
  onBeginCustomerEdit: (customer: Customer) => void;
  onCancelCustomerEdit: () => void;
  onSaveCustomer: () => void;
  onDeleteCustomer: (customer: Customer) => void;
  managedUsers: ManagedUser[];
  newUserName: string;
  newUserEmail: string;
  newUserPassword: string;
  newUserRole: ManagedUser["role"];
  onNewUserNameChange: (value: string) => void;
  onNewUserEmailChange: (value: string) => void;
  onNewUserPasswordChange: (value: string) => void;
  onNewUserRoleChange: (value: ManagedUser["role"]) => void;
  onCreateManagedUser: () => void;
  onToggleManagedUser: (user: ManagedUser) => void;
  onChangeManagedUserRole: (user: ManagedUser, role: ManagedUser["role"]) => void;
  editingManagedUserId: string | null;
  managedUserNameDraft: string;
  managedUserEmailDraft: string;
  onBeginManagedUserEdit: (user: ManagedUser) => void;
  onCancelManagedUserEdit: () => void;
  onSaveManagedUserEdit: (user: ManagedUser) => void;
  onManagedUserNameChange: (value: string) => void;
  onManagedUserEmailChange: (value: string) => void;
  onResetManagedUserPassword: (user: ManagedUser) => void;
  onKeyNameChange: (value: string) => void;
  onKeyCustomerChange: (value: string) => void;
  onCreateKey: () => void;
  onCopyKey: () => void;
  onRevokeKey: (key: AgentKey) => void;
  onTwoFactorCodeChange: (value: string) => void;
  onPrepareTwoFactor: () => void;
  onEnableTwoFactor: () => void;
  onDisableTwoFactor: () => void;
  onConnectReasonChange: (value: string) => void;
  onConnectModeChange: (value: "support" | "game") => void;
  onCloseConnection: () => void;
  onConfirmConnection: () => void;
  onOpenOnboarding: () => void;
  onCloseOnboarding: () => void;
  onOnboardingCustomerChange: (value: string) => void;
  onOnboardingKeyNameChange: (value: string) => void;
  onCreateOnboardingKey: () => void;
  onCopyOnboardingKey: () => void;
  onDownloadAgentProfile: () => void;
  onDownloadAgentBundle: () => void;
  gameSession: RemoteSessionDescriptor | null;
  gameSessionStarted: boolean;
  onLaunchGameInBrowser: () => void;
  onCloseGameSession: () => void;
}

function OperationsConsole(props: OperationsConsoleProps) {
  const {
    user,
    summary,
    devices,
    filteredDevices,
    selectedDevice,
    selectedDeviceId,
    activeSection,
    deviceQuery,
    deviceFilter,
    auditEvents,
    sessions,
    latestInventory,
    commands,
    customers,
    newCustomerName,
    newCustomerDocument,
    newCustomerContactName,
    newCustomerContactEmail,
    agentKeys,
    newKeyName,
    newKeyCustomerId,
    revealedAgentKey,
    twoFactorStatus,
    twoFactorSetup,
    twoFactorCode,
    twoFactorMessage,
    canManageKeys,
    canManageOwnSecurity,
    rateLimitDiagnostics,
    rateLimitDiagnosticsLoading,
    onRefreshRateLimitDiagnostics,
    loading,
    statusMessage,
    onSectionChange,
    onDeviceQueryChange,
    onDeviceFilterChange,
    onSelectDevice,
    onRefresh,
    onLogout,
    onHeartbeat,
    onRequestSession,
    onRequestCommand,
    onApproveRemoteSession,
    onDenyRemoteSession,
    onEndRemoteSession,
    onMoveDevice,
    deviceTagsDraft,
    deviceTagsSaving,
    onDeviceTagsDraftChange,
    onUpdateDeviceTags,
    onDeleteDevice,
    onArchiveDevice,
    archivedDevices,
    onRestoreDevice,
    onNewCustomerNameChange,
    onNewCustomerDocumentChange,
    onNewCustomerContactNameChange,
    onNewCustomerContactEmailChange,
    onCreateCustomer,
    editingCustomerId,
    onBeginCustomerEdit,
    onCancelCustomerEdit,
    onSaveCustomer,
    onDeleteCustomer,
    managedUsers,
    newUserName,
    newUserEmail,
    newUserPassword,
    newUserRole,
    onNewUserNameChange,
    onNewUserEmailChange,
    onNewUserPasswordChange,
    onNewUserRoleChange,
    onCreateManagedUser,
    onToggleManagedUser,
    onChangeManagedUserRole,
    editingManagedUserId,
    managedUserNameDraft,
    managedUserEmailDraft,
    onBeginManagedUserEdit,
    onCancelManagedUserEdit,
    onSaveManagedUserEdit,
    onManagedUserNameChange,
    onManagedUserEmailChange,
    onResetManagedUserPassword,
    onKeyNameChange,
    onKeyCustomerChange,
    onCreateKey,
    onCopyKey,
    onRevokeKey,
    onTwoFactorCodeChange,
    onPrepareTwoFactor,
    onEnableTwoFactor,
    onDisableTwoFactor,
    connectDevice,
    connectReason,
    connectMode,
    gameModeEnabled,
    connectionLoading,
    onboardingOpen,
    onboardingCustomerId,
    onboardingKeyName,
    onboardingKey,
    onboardingLoading,
    agentInstallerAvailable,
    onConnectReasonChange,
    onConnectModeChange,
    onCloseConnection,
    onConfirmConnection,
    onOpenOnboarding,
    onCloseOnboarding,
    onOnboardingCustomerChange,
    onOnboardingKeyNameChange,
    onCreateOnboardingKey,
    onCopyOnboardingKey,
    onDownloadAgentProfile,
    onDownloadAgentBundle,
    gameSession,
    gameSessionStarted,
    onLaunchGameInBrowser,
    onCloseGameSession
  } = props;

  const [moveCustomerId, setMoveCustomerId] = React.useState(selectedDevice?.customerId ?? "");
  const connectCapture = connectDevice?.id === selectedDevice?.id ? latestInventory?.software.capture : undefined;
  const connectSessions = connectDevice?.id === selectedDevice?.id ? latestInventory?.software.sessions : undefined;
  const connectGameReady = connectCapture?.gameModeReady === true && connectSessions?.interactiveSessionReady === true;
  const connectCaptureLabel = connectCapture
    ? `Captura pronta (${connectCapture.resolvedEncoder ?? connectCapture.encoder ?? "CPU"} / ${connectCapture.resolvedCaptureMethod ?? connectCapture.captureMethod ?? "auto"})${(connectCapture.resolvedEncoder ?? connectCapture.encoder) === "cpu" ? "; fallback CPU pode reduzir FPS e aumentar o uso do processador." : "."}`
    : "";
  const connectCapabilityMessage = !gameModeEnabled
    ? "O modo jogo esta desabilitado neste ambiente."
    : connectGameReady
      ? connectCaptureLabel
      : connectCapture?.gameModeReady === true && connectSessions?.interactiveSessionReady !== true
        ? "Captura pronta, mas a sessao interativa do Windows nao esta pronta. Repare a instalacao do agente e atualize o inventario."
      : latestInventory
        ? "Captura ainda nao esta pronta. Atualize o inventario depois de corrigir FFmpeg/encoder."
        : "Capacidade ainda nao foi avaliada; o inventario sera exigido na aprovacao.";
  const connectInputMessage = latestInventory?.software.input?.virtualGamepad
    ? "Controle: gamepad virtual disponivel."
    : latestInventory?.software.input?.gamepad === "keyboard-mouse-map"
      ? "Controle: mapa para teclado/mouse; jogos que exigem XInput/DirectInput nao sao compativeis."
      : "Controle: capacidade ainda nao avaliada.";
  React.useEffect(() => {
    setMoveCustomerId(selectedDevice?.customerId ?? "");
  }, [selectedDevice?.customerId, selectedDevice?.id]);

  const sectionTitle = activeSection === "security" ? "Seguranca" : activeSection === "activity" ? "Atividade" : "Dispositivos";
  const initials = user.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brandMark">R</span>
          <div>
            <strong>Remoto</strong>
            <small>Console de operacoes</small>
          </div>
        </div>

        <div className="sidebarLabel">Workspace</div>
        <nav className="nav" aria-label="Navegacao principal">
          <button className={activeSection === "overview" ? "active" : ""} type="button" onClick={() => onSectionChange("overview")}>
            <Monitor size={18} />
            Dispositivos
          </button>
          {canManageOwnSecurity ? (
            <button className={activeSection === "security" ? "active" : ""} type="button" onClick={() => onSectionChange("security")}>
              <ShieldCheck size={18} />
              Seguranca
            </button>
          ) : null}
          <button className={activeSection === "activity" ? "active" : ""} type="button" onClick={() => onSectionChange("activity")}>
            <Activity size={18} />
            Atividade
          </button>
        </nav>

        <div className="sidebarFoot">
          <span className="liveDot" />
          <div>
            <strong>Ambiente local</strong>
            <small>API conectada</small>
          </div>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Operacoes / {sectionTitle}</p>
            <h1>{sectionTitle}</h1>
            <p className="topbarIntro">
              {activeSection === "overview" ? "Acompanhe presenca e abra sessoes com contexto." : activeSection === "security" ? "Controle chaves de agentes e protecoes da conta." : "Veja as acoes recentes da sua equipe."}
            </p>
          </div>
          <div className="topActions">
            <div className="userBadge">
              <span className="avatar">{initials}</span>
              <span className="userName">{user.name}</span>
              <small>{user.role}</small>
            </div>
            <button className="iconButton" type="button" onClick={onRefresh} aria-label="Atualizar painel" title="Atualizar painel">
              <RefreshCcw size={18} />
            </button>
            <button className="iconButton" type="button" onClick={onLogout} aria-label="Sair" title="Sair">
              <LogOut size={18} />
            </button>
          </div>
        </header>

        {activeSection === "overview" ? (
          <>
            <section className="metrics" aria-label="Resumo da plataforma">
              <Metric label="Clientes" value={summary?.customers ?? 0} />
              <Metric label="Dispositivos" value={summary?.devices ?? 0} />
              <Metric label="Online agora" value={summary?.onlineDevices ?? 0} tone="good" />
              <Metric label="Offline" value={summary?.offlineDevices ?? 0} tone="muted" />
              <Metric label="Sessoes hoje" value={summary?.sessions ?? 0} />
            </section>

            <section className="workspaceToolbar">
              <div className="searchField">
                <Search size={17} />
                <input value={deviceQuery} onChange={(event) => onDeviceQueryChange(event.target.value)} placeholder="Buscar dispositivo, cliente ou IP" aria-label="Buscar dispositivos" />
              </div>
              {canManageKeys ? <button className="primary addDeviceButton" type="button" onClick={onOpenOnboarding}><Plus size={16} />Adicionar computador</button> : null}
              <div className="filterGroup" aria-label="Filtrar dispositivos">
                <SlidersHorizontal size={16} />
                {(["all", "online", "offline"] as DeviceFilter[]).map((filter) => (
                  <button key={filter} className={deviceFilter === filter ? "selected" : ""} type="button" onClick={() => onDeviceFilterChange(filter)}>
                    {filter === "all" ? `Todos ${devices.length}` : filter === "online" ? `Online ${summary?.onlineDevices ?? 0}` : `Offline ${summary?.offlineDevices ?? 0}`}
                  </button>
                ))}
              </div>
              <span className="syncState">{loading ? "Sincronizando" : statusMessage}</span>
            </section>

            <section className="contentGrid">
              <section className="panel deviceList">
                <div className="panelHeader">
                  <div>
                    <h2>Dispositivos</h2>
                    <p>{filteredDevices.length} resultado(s) no workspace</p>
                  </div>
                  <span className="panelHint">Selecione para ver detalhes</span>
                </div>

                <div className="deviceTable">
                  <div className="deviceTableHead">
                    <span>Dispositivo</span>
                    <span>Cliente</span>
                    <span>Estado</span>
                    <span>Ultimo sinal</span>
                    <span />
                  </div>
                  {filteredDevices.length === 0 ? (
                    <div className="emptyState">
                      <Search size={22} />
                      <strong>Nenhum dispositivo encontrado</strong>
                      <span>Ajuste a busca ou o filtro de estado.</span>
                    </div>
                  ) : filteredDevices.map((device) => (
                    <div className={`deviceRow ${selectedDeviceId === device.id ? "selected" : ""}`} key={device.id}>
                      <button className="deviceSelect" type="button" onClick={() => onSelectDevice(device.id)}>
                        <span className={`deviceIcon ${device.status}`}><Monitor size={17} /></span>
                        <span><strong>{device.displayName}</strong><small>{device.os} / {device.remoteId}</small></span>
                      </button>
                      <span className="deviceCustomer">{device.customerName}</span>
                      <span className={`status ${device.status}`}>
                        {device.status === "online" ? <Wifi size={15} /> : <WifiOff size={15} />}
                        {device.status === "online" ? "Online" : "Offline"}
                      </span>
                      <span className="lastSeen">{formatSeen(device.secondsSinceLastSeen)}</span>
                      <span className="rowActions">
                        <button className="iconButton compact" type="button" onClick={() => onHeartbeat(device.id)} aria-label={`Atualizar ${device.displayName}`} title="Enviar heartbeat"><RefreshCcw size={15} /></button>
                        <button className="primary compact" type="button" onClick={() => onRequestSession(device)}><Play size={15} />Abrir</button>
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              <aside className="panel detailPanel">
                {selectedDevice ? (
                  <>
                    <div className="detailHeading">
                      <div>
                        <p className="eyebrow">Dispositivo selecionado</p>
                        <h2>{selectedDevice.displayName}</h2>
                        <span>{selectedDevice.customerName} / ID {selectedDevice.remoteId}</span>
                      </div>
                      <span className={`status ${selectedDevice.status}`}>{selectedDevice.status === "online" ? <Wifi size={15} /> : <WifiOff size={15} />}{selectedDevice.status === "online" ? "Online" : "Offline"}</span>
                    </div>
                    <button className="primary detailConnect" type="button" onClick={() => onRequestSession(selectedDevice)}><Play size={16} />Abrir sessao remota<ArrowUpRight size={16} /></button>
                    {latestInventory && latestInventory.software.sessions?.interactiveSessionReady !== true && agentInstallerAvailable ? <a className="secondary installerDownload" href={AGENT_INSTALLER_URL} target="_blank" rel="noreferrer" download title="Baixar o instalador para reparar a sessao interativa"><Download size={16} />Atualizar agente <ArrowUpRight size={14} /></a> : null}
                    <dl className="details">
                      <div><dt>Usuario</dt><dd>{selectedDevice.userName}</dd></div>
                      <div><dt>IP local</dt><dd>{selectedDevice.localIp}</dd></div>
                      <div><dt>MAC principal</dt><dd>{selectedDevice.primaryMac ?? "n/a"}</dd></div>
                      <div><dt>Serial BIOS</dt><dd>{selectedDevice.biosSerial ?? "n/a"}</dd></div>
                      <div><dt>UUID sistema</dt><dd>{selectedDevice.systemUuid ?? "n/a"}</dd></div>
                      <div><dt>Sistema</dt><dd>{selectedDevice.os}</dd></div>
                    </dl>
                    <div className="tags">{selectedDevice.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>

                    {canManageKeys ? <section className="subsection deviceAdminBox">
                      <div className="subsectionHeader"><div><h3>Administrar dispositivo</h3><p>Mova ou remova este computador do workspace.</p></div><ArrowRightLeft size={17} /></div>
                      <div className="deviceAdminActions">
                        <label><span>Cliente responsavel</span><select value={moveCustomerId} onChange={(event) => setMoveCustomerId(event.target.value)}>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>
                        <button className="secondary compact" type="button" onClick={() => onMoveDevice(selectedDevice, moveCustomerId)} disabled={!moveCustomerId || moveCustomerId === selectedDevice.customerId}><ArrowRightLeft size={14} />Mover</button>
                        <button className="secondary compact" type="button" onClick={() => onArchiveDevice(selectedDevice)}><Archive size={14} />Arquivar</button>
                        <button className="danger compact" type="button" onClick={() => onDeleteDevice(selectedDevice)}><Trash2 size={14} />Excluir definitivo</button>
                      </div>
                      <div className="deviceTagsEditor">
                        <label><span>Etiquetas / grupos</span><input value={deviceTagsDraft} onChange={(event) => onDeviceTagsDraftChange(event.target.value)} placeholder="financeiro, prioridade, servidor" /></label>
                        <button className="secondary compact" type="button" onClick={() => onUpdateDeviceTags(selectedDevice)} disabled={deviceTagsSaving}>{deviceTagsSaving ? "Salvando..." : "Salvar etiquetas"}</button>
                      </div>
                    </section> : null}

                    <section className="subsection inventoryBox">
                      <div className="subsectionHeader"><div><h3>Inventario</h3><p>{latestInventory ? `Coletado em ${new Date(latestInventory.collectedAt).toLocaleString("pt-BR")}` : "Nenhum inventario coletado ainda."}</p></div><Monitor size={17} /></div>
                      {latestInventory ? <dl className="details compactDetails">
                        <div><dt>CPU</dt><dd>{latestInventory.hardware.cpu?.count ?? "n/a"}x {latestInventory.hardware.cpu?.model ?? "desconhecida"}</dd></div>
                        <div><dt>Memoria</dt><dd>{formatBytes(latestInventory.hardware.memory?.freeBytes)} livre de {formatBytes(latestInventory.hardware.memory?.totalBytes)}</dd></div>
                        <div><dt>Discos</dt><dd>{latestInventory.hardware.disks?.length ? latestInventory.hardware.disks.map((disk) => `${disk.name ?? disk.mountedAt ?? "disco"} ${formatBytes(disk.freeBytes)} livre`).join(", ") : "n/a"}</dd></div>
                        <div><dt>Video</dt><dd>{latestInventory.hardware.graphics?.adapters?.map((adapter) => adapter.name).join(", ") || "nao detectado"}</dd></div>
                        <div><dt>Codificacao</dt><dd>{latestInventory.hardware.graphics?.encoding === "cpu-fallback" ? "CPU permitido; qualidade pode variar" : latestInventory.hardware.graphics?.encoding === "hardware-preferred-with-cpu-fallback" ? "GPU preferencial com fallback de CPU" : "Nao avaliada"}</dd></div>
                        <div><dt>Modo jogo</dt><dd>{latestInventory.software.capture?.gameModeReady && latestInventory.software.sessions?.interactiveSessionReady ? `Pronto (${latestInventory.software.capture.resolvedEncoder ?? latestInventory.software.capture.encoder ?? "CPU"} / ${latestInventory.software.capture.resolvedCaptureMethod ?? latestInventory.software.capture.captureMethod ?? "auto"} / ${latestInventory.software.capture.quality ?? "auto"})` : latestInventory.software.capture?.gameModeReady ? "Captura pronta; repare a sessao interativa do agente" : latestInventory.software.capture?.audio === "system" && !latestInventory.software.capture.systemAudioAvailable ? "Audio do sistema indisponivel nesta build do FFmpeg" : latestInventory.software.capture?.ffmpegAvailable ? "FFmpeg sem encoder H.264 ou captura de desktop utilizavel" : "FFmpeg nao detectado"}</dd></div>
                        <div><dt>Sessao Windows</dt><dd>{latestInventory.software.sessions?.interactiveSessionReady ? "Pronta para interagir com a area de trabalho" : latestInventory.software.sessions?.interactiveTaskInstalled ? "Tarefa instalada; processo interativo ausente" : "Tarefa interativa nao instalada"}</dd></div>
                        <div><dt>Controle</dt><dd>{latestInventory.software.input?.virtualGamepad ? "Gamepad virtual" : latestInventory.software.input?.gamepad === "keyboard-mouse-map" ? "Mapa para teclado/mouse; sem XInput/DirectInput" : "Nao avaliado"}</dd></div>
                        <div><dt>Audio</dt><dd>{latestInventory.software.capture?.audio === "system" ? latestInventory.software.capture.systemAudioAvailable ? "WASAPI loopback disponivel" : "WASAPI loopback indisponivel" : "Desligado"}</dd></div>
                        <div><dt>Perfil captura</dt><dd>{latestInventory.software.capture ? `${latestInventory.software.capture.width && latestInventory.software.capture.height ? `${latestInventory.software.capture.width}x${latestInventory.software.capture.height}` : "desktop"} / ${latestInventory.software.capture.fps ?? "auto"} FPS / ${latestInventory.software.capture.bitrateKbps ?? "auto"} kbps` : "Nao avaliado"}</dd></div>
                        <div><dt>Runtime</dt><dd>{latestInventory.software.runtime?.node ?? "n/a"}</dd></div>
                      </dl> : null}
                    </section>

                    <section className="subsection commandsBox">
                      <div className="subsectionHeader"><div><h3>Comandos</h3><p>Acao enfileirada para o agente.</p></div><ChevronRight size={17} /></div>
                      <div className="commandButtons">
                        <button className="secondary compact" type="button" onClick={() => onRequestCommand(selectedDevice, "ping")}>ping</button>
                        <button className="secondary compact" type="button" onClick={() => onRequestCommand(selectedDevice, "system-info")}>system-info</button>
                        <button className="secondary compact" type="button" onClick={() => onRequestCommand(selectedDevice, "refresh-inventory")}>refresh</button>
                        <button className="secondary compact" type="button" onClick={() => onRequestCommand(selectedDevice, "list-processes")}>processos</button>
                        <button className="secondary compact" type="button" onClick={() => onRequestCommand(selectedDevice, "list-services")}>servicos</button>
                        <button className="secondary compact" type="button" onClick={() => onRequestCommand(selectedDevice, "collect-diagnostics")}>diagnostico</button>
                      </div>
                      {commands.length ? <ul className="commandList">{commands.slice(0, 6).map((item) => <li key={item.id}><div className="commandHeading"><strong>{commandLabel(item.commandType)}</strong><span className={`commandStatus ${item.status}`}>{item.status}</span></div><small>{new Date(item.requestedAt).toLocaleString("pt-BR")}</small>{item.status === "succeeded" || item.status === "failed" ? <details className="commandOutputDetails"><summary>{item.status === "failed" ? "Ver erro" : "Ver resultado"}</summary><pre className="commandOutput">{formatCommandOutput(item.status === "failed" ? item.error : item.output)}</pre></details> : null}</li>)}</ul> : <p className="empty">Nenhum comando recente.</p>}
                    </section>
                  </>
                ) : <div className="emptyState"><Monitor size={24} /><strong>Selecione um dispositivo</strong><span>Os detalhes aparecem aqui.</span></div>}
              </aside>
            </section>
          </>
        ) : null}

        {activeSection === "security" && canManageOwnSecurity ? (
          <section className="securityView">
            {canManageKeys ? <>
            <section className="panel customerPanel">
              <div className="panelHeader"><div><p className="eyebrow">Cadastro operacional</p><h2>Clientes</h2><p>Organize dispositivos e chaves por cliente.</p></div><UserRound size={20} /></div>
              <div className="customerForm">
                <label><span>Nome</span><input value={newCustomerName} onChange={(event) => onNewCustomerNameChange(event.target.value)} placeholder="Nome da empresa" /></label>
                <label><span>CNPJ / documento</span><input value={newCustomerDocument} onChange={(event) => onNewCustomerDocumentChange(event.target.value)} placeholder="00.000.000/0001-00" /></label>
                <label><span>Contato</span><input value={newCustomerContactName} onChange={(event) => onNewCustomerContactNameChange(event.target.value)} placeholder="Nome do responsável" /></label>
                <label><span>Email do contato</span><input value={newCustomerContactEmail} onChange={(event) => onNewCustomerContactEmailChange(event.target.value)} type="email" placeholder="contato@empresa.com" /></label>
                <span className="customerFormActions"><button className="primary compact" type="button" onClick={onSaveCustomer}>{editingCustomerId ? <Pencil size={15} /> : <Plus size={15} />}{editingCustomerId ? "Salvar cliente" : "Cadastrar cliente"}</button>{editingCustomerId ? <button className="secondary compact" type="button" onClick={onCancelCustomerEdit}>Cancelar</button> : null}</span>
              </div>
              <ul className="customerList">{customers.map((customer) => {
                const canDelete = customer.deviceCount === 0 && customer.agentKeyCount === 0;
                return <li key={customer.id}>
                  <span><strong>{customer.name}</strong><small>{customer.document} / {customer.contactName} / {customer.contactEmail}</small></span>
                  <span className="customerUsage">{customer.deviceCount} dispositivos · {customer.agentKeyCount} chaves</span>
                  <span className="customerActions"><button className="iconButton compact" type="button" onClick={() => onBeginCustomerEdit(customer)} aria-label={`Editar ${customer.name}`} title="Editar cliente"><Pencil size={15} /></button><button className="iconButton compact" type="button" onClick={() => onDeleteCustomer(customer)} disabled={!canDelete} aria-label={`Excluir ${customer.name}`} title={canDelete ? "Excluir cliente" : "Remova dispositivos e chaves antes de excluir"}><Trash2 size={15} /></button></span>
                </li>;
              })}</ul>
            </section>
            <section className="panel userPanel">
              <div className="panelHeader"><div><p className="eyebrow">Acesso ao console</p><h2>Usuarios e permissoes</h2><p>Crie contas, controle funcoes e bloqueie acessos.</p></div><ShieldCheck size={20} /></div>
              <div className="userForm">
                <label><span>Nome</span><input value={newUserName} onChange={(event) => onNewUserNameChange(event.target.value)} placeholder="Nome do operador" /></label>
                <label><span>Email</span><input value={newUserEmail} onChange={(event) => onNewUserEmailChange(event.target.value)} type="email" placeholder="operador@empresa.com" /></label>
                <label><span>Senha inicial</span><input value={newUserPassword} onChange={(event) => onNewUserPasswordChange(event.target.value)} type="password" placeholder="Minimo 8 caracteres" /></label>
                <label><span>Funcao</span><select value={newUserRole} onChange={(event) => onNewUserRoleChange(event.target.value as ManagedUser["role"])}><option value="admin">Administrador</option><option value="technician">Tecnico</option><option value="viewer">Visualizador</option>{user.role === "owner" ? <option value="owner">Owner</option> : null}</select></label>
                <button className="primary compact" type="button" onClick={onCreateManagedUser}><Plus size={15} />Criar usuario</button>
              </div>
              <ul className="userList">{managedUsers.map((managedUser) => <li key={managedUser.id}>
                {editingManagedUserId === managedUser.id ? <span className="userEditFields"><input value={managedUserNameDraft} onChange={(event) => onManagedUserNameChange(event.target.value)} aria-label="Nome do usuario" /><input value={managedUserEmailDraft} onChange={(event) => onManagedUserEmailChange(event.target.value)} type="email" aria-label="Email do usuario" /></span> : <span><strong>{managedUser.name}</strong><small>{managedUser.email} / {managedUser.role} / 2FA {managedUser.twoFactorEnabled ? "ativo" : "pendente"}</small></span>}
                <span className={`commandStatus ${managedUser.active ? "succeeded" : "failed"}`}>{managedUser.active ? "Ativo" : "Bloqueado"}</span>
                <span className="customerActions">{editingManagedUserId === managedUser.id ? <><button className="iconButton compact" type="button" onClick={() => onSaveManagedUserEdit(managedUser)} aria-label="Salvar dados do usuario" title="Salvar dados"><Check size={15} /></button><button className="iconButton compact" type="button" onClick={onCancelManagedUserEdit} aria-label="Cancelar edicao do usuario" title="Cancelar"><X size={15} /></button></> : <><button className="iconButton compact" type="button" onClick={() => onBeginManagedUserEdit(managedUser)} disabled={managedUser.id === user.id} aria-label={`Editar ${managedUser.name}`} title={managedUser.id === user.id ? "Edite o proprio perfil em uma sessao separada" : "Editar usuario"}><Pencil size={15} /></button><select className="roleSelect" value={managedUser.role} onChange={(event) => onChangeManagedUserRole(managedUser, event.target.value as ManagedUser["role"])} disabled={managedUser.id === user.id} aria-label={`Funcao de ${managedUser.name}`}><option value="admin">Administrador</option><option value="technician">Tecnico</option><option value="viewer">Visualizador</option>{user.role === "owner" ? <option value="owner">Owner</option> : null}</select><button className="secondary compact" type="button" onClick={() => onResetManagedUserPassword(managedUser)}>Redefinir senha</button><button className="iconButton compact" type="button" onClick={() => onToggleManagedUser(managedUser)} disabled={managedUser.id === user.id} aria-label={`${managedUser.active ? "Bloquear" : "Ativar"} ${managedUser.name}`} title={managedUser.active ? "Bloquear usuario" : "Ativar usuario"}>{managedUser.active ? <Ban size={15} /> : <ShieldCheck size={15} />}</button></>}</span>
              </li>)}</ul>
            </section>
            <section className="panel archivedPanel">
              <div className="panelHeader"><div><p className="eyebrow">Ciclo de vida</p><h2>Dispositivos arquivados</h2><p>Restaurar libera o agente para voltar a atualizar o computador.</p></div><Archive size={20} /></div>
              {archivedDevices.length === 0 ? <p className="empty">Nenhum dispositivo arquivado.</p> : <ul className="archivedList">{archivedDevices.map((device) => <li key={device.id}><span><strong>{device.displayName}</strong><small>{device.customerName} / ID {device.remoteId}</small></span><button className="secondary compact" type="button" onClick={() => onRestoreDevice(device)}><RotateCcw size={14} />Restaurar</button></li>)}</ul>}
            </section>
            <section className="panel keyPanel">
              <div className="panelHeader"><div><p className="eyebrow">Acesso de agentes</p><h2>Chaves por cliente</h2><p>Crie credenciais separadas e revogue acessos antigos.</p></div><KeyRound size={20} /></div>
              <div className="keyForm">
                <label><span>Cliente</span><select value={newKeyCustomerId} onChange={(event) => onKeyCustomerChange(event.target.value)}>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>
                <label><span>Nome da chave</span><input value={newKeyName} onChange={(event) => onKeyNameChange(event.target.value)} placeholder="Notebook suporte" /></label>
                <button className="primary compact" type="button" onClick={onCreateKey}><KeyRound size={15} />Criar chave</button>
              </div>
              {revealedAgentKey ? <div className="keyReveal" role="status"><div><strong>Copie esta chave agora</strong><span>O segredo nao sera exibido novamente.</span></div><code>{revealedAgentKey}</code><button className="iconButton compact" type="button" onClick={onCopyKey} aria-label="Copiar chave" title="Copiar chave"><Copy size={15} /></button></div> : null}
              <ul className="keyList">{agentKeys.map((key) => <li key={key.id}><span><strong>{key.name}</strong><small>{key.customerName} / {key.boundRemoteId ? "computador vinculado" : "aguardando primeiro cadastro"} / criada em {new Date(key.createdAt).toLocaleDateString("pt-BR")}</small></span><span className={`commandStatus ${key.active ? "succeeded" : "failed"}`}>{key.active ? "Ativa" : "Revogada"}</span>{key.active ? <button className="iconButton compact" type="button" onClick={() => onRevokeKey(key)} aria-label={`Revogar ${key.name}`} title="Revogar chave"><Ban size={15} /></button> : null}</li>)}</ul>
            </section>
            </> : null}
            <section className="panel twoFactorPanel">
              <div className="panelHeader"><div><p className="eyebrow">Protecao de conta</p><h2>Autenticacao em dois fatores</h2><p>{twoFactorStatus.enabled ? "Ativa para este usuario." : "Proteja a conta administrativa com TOTP."}</p></div><ShieldCheck size={20} /></div>
              {twoFactorSetup ? <div className="keyReveal twoFactorReveal" role="status"><strong>Segredo temporario</strong><code>{twoFactorSetup.secret}</code><small>{twoFactorSetup.otpauthUri}</small></div> : null}
              <div className="keyForm twoFactorForm"><label><span>Codigo do autenticador</span><input value={twoFactorCode} onChange={(event) => onTwoFactorCodeChange(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="000000" /></label>{!twoFactorStatus.enabled ? <><button className="secondary compact" type="button" onClick={onPrepareTwoFactor}><ShieldCheck size={15} />Preparar 2FA</button><button className="primary compact" type="button" onClick={onEnableTwoFactor} disabled={!twoFactorSetup}>Ativar 2FA</button></> : <button className="secondary compact" type="button" onClick={onDisableTwoFactor}><Ban size={15} />Desativar 2FA</button>}</div>
              {twoFactorMessage ? <small className="securityMessage">{twoFactorMessage}</small> : null}
            </section>
            {canManageKeys ? <section className="panel diagnosticsPanel">
              <div className="panelHeader"><div><p className="eyebrow">Operacao da plataforma</p><h2>Protecao do rate limit</h2><p>Estado do Redis usado para proteger login, agentes e sessoes.</p></div><RefreshCcw size={20} /></div>
              <div className="diagnosticsGrid">
                <div><span>Store</span><strong className={rateLimitDiagnostics?.store === "redis" ? "diagnosticGood" : rateLimitDiagnostics?.store === "unavailable" ? "diagnosticBad" : ""}>{rateLimitDiagnostics?.store === "redis" ? "Redis distribuido" : rateLimitDiagnostics?.store === "memory" ? "Memoria local" : "Indisponivel"}</strong></div>
                <div><span>Memoria usada</span><strong>{formatBytes(rateLimitDiagnostics?.redis?.usedMemoryBytes ?? undefined)}</strong></div>
                <div><span>Limite configurado</span><strong>{formatBytes(rateLimitDiagnostics?.redis?.maxMemoryBytes ?? undefined)}</strong></div>
                <div><span>Chaves no Redis</span><strong>{rateLimitDiagnostics?.redis?.keys ?? "n/a"}</strong></div>
              </div>
              <div className={`diagnosticNotice ${rateLimitDiagnostics?.store === "unavailable" ? "warning" : ""}`}>{rateLimitDiagnostics?.store === "unavailable" ? "O Redis nao respondeu. Em producao, o rate limit deve permanecer fechado ate a recuperacao." : rateLimitDiagnostics?.store === "memory" ? "Ambiente local usando memoria; a producao exige Redis compartilhado." : rateLimitDiagnostics ? `Leitura feita em ${new Date(rateLimitDiagnostics.checkedAt).toLocaleString("pt-BR")}.` : "Carregando diagnostico..."}</div>
              <button className="secondary compact diagnosticRefresh" type="button" onClick={onRefreshRateLimitDiagnostics} disabled={rateLimitDiagnosticsLoading}><RefreshCcw size={14} />{rateLimitDiagnosticsLoading ? "Atualizando..." : "Atualizar diagnostico"}</button>
            </section> : null}
          </section>
        ) : null}

        {activeSection === "activity" ? <section className="activityView">
          <section className="panel sessionPanel"><div className="panelHeader"><div><p className="eyebrow">Controle de acesso</p><h2>Sessoes remotas</h2><p>Suporte e jogo usam o relay seguro do Remoto no navegador.</p></div><Play size={20} /></div>{sessions.length === 0 ? <div className="emptyState"><Play size={24} /><strong>Sem sessoes registradas</strong><span>Os pedidos de acesso aparecerao aqui.</span></div> : <ul className="sessionList">{sessions.map((session) => <li key={session.id}><div><strong>{session.deviceName}</strong><span>{session.mode === "game" ? "Jogo" : "Suporte"} / {session.customerName} / {session.technicianName} / {session.reason}</span><small>{new Date(session.requestedAt).toLocaleString("pt-BR")}</small></div><span className={`commandStatus ${session.status === "approved" ? "succeeded" : session.status === "denied" ? "failed" : ""}`}>{session.status}</span><span className="sessionActions">{canManageKeys && session.status === "requested" ? <><button className="primary compact" type="button" onClick={() => onApproveRemoteSession(session)}><Play size={14} />Aprovar</button><button className="danger compact" type="button" onClick={() => onDenyRemoteSession(session)}><Ban size={14} />Negar</button></> : null}{session.status === "approved" ? <button className="secondary compact" type="button" onClick={() => onEndRemoteSession(session)}>Encerrar</button> : null}</span></li>)}</ul>}</section>
          <section className="panel auditPanel"><div className="panelHeader"><div><p className="eyebrow">Historico do workspace</p><h2>Atividade recente</h2><p>Acoes registradas pela API e pelos operadores.</p></div><Activity size={20} /></div>{auditEvents.length === 0 ? <div className="emptyState"><Activity size={24} /><strong>Sem eventos ainda</strong><span>Heartbeats e sessoes aparecerao aqui.</span></div> : <ul className="auditList">{auditEvents.map((event) => <li key={event.id}><span className="activityIcon"><Activity size={16} /></span><div><strong>{event.action}</strong><span>{event.actor} / alvo {event.targetId}</span></div><time>{new Date(event.createdAt).toLocaleString("pt-BR")}</time></li>)}</ul>}</section>
        </section> : null}

        {connectDevice ? (
          <div className="modalBackdrop" role="presentation" onMouseDown={onCloseConnection}>
            <section className="connectionModal" role="dialog" aria-modal="true" aria-labelledby="connection-title" onMouseDown={(event) => event.stopPropagation()}>
              <div className="modalHeader">
                <div><p className="eyebrow">Nova sessao</p><h2 id="connection-title">Abrir acesso remoto</h2></div>
                <button className="iconButton" type="button" onClick={onCloseConnection} aria-label="Fechar" title="Fechar"><X size={17} /></button>
              </div>
              <div className="connectionTarget"><span className={`deviceIcon ${connectDevice.status}`}><Monitor size={19} /></span><div><strong>{connectDevice.displayName}</strong><span>{connectDevice.customerName} / ID {connectDevice.remoteId}</span></div><span className={`status ${connectDevice.status}`}>{connectDevice.status === "online" ? "Online" : "Offline"}</span></div>
              <label className="reasonField"><span>Modo de acesso</span><select value={connectMode} onChange={(event) => onConnectModeChange(event.target.value as "support" | "game")}><option value="support">Suporte remoto (navegador)</option><option value="game" disabled={!gameModeEnabled || !connectGameReady}>Jogo (experimental{!gameModeEnabled ? " - desabilitado" : connectGameReady ? "" : " - inventario pendente"})</option></select></label>
              <label className="reasonField"><span>Motivo do acesso</span><textarea value={connectReason} onChange={(event) => onConnectReasonChange(event.target.value)} rows={3} placeholder="Ex.: validar falha no caixa" autoFocus /></label>
              <p className="modalNote">A solicitacao sera registrada na atividade. O suporte abre a area de trabalho no navegador; o modo jogo experimental exige relay e captura ativos. {connectCapabilityMessage} {connectInputMessage}</p>
              <div className="modalActions"><button className="secondary" type="button" onClick={onCloseConnection}>Cancelar</button><button className="primary" type="button" onClick={onConfirmConnection} disabled={connectionLoading || connectReason.trim().length < 4 || (connectMode === "game" && !connectGameReady)}><Play size={16} />{connectionLoading ? "Registrando..." : "Solicitar acesso"}</button></div>
            </section>
          </div>
        ) : null}

        {gameSession ? <GameSessionPanel session={gameSession} realtimeUrl={REALTIME_URL} started={gameSessionStarted} onStartWeb={onLaunchGameInBrowser} onClose={onCloseGameSession} /> : null}

        {onboardingOpen ? (
          <div className="modalBackdrop" role="presentation" onMouseDown={onCloseOnboarding}>
            <section className="onboardingModal" role="dialog" aria-modal="true" aria-labelledby="onboarding-title" onMouseDown={(event) => event.stopPropagation()}>
              <div className="modalHeader">
                <div><p className="eyebrow">Cadastro de equipamento</p><h2 id="onboarding-title">Adicionar computador</h2></div>
                <button className="iconButton" type="button" onClick={onCloseOnboarding} aria-label="Fechar" title="Fechar"><X size={17} /></button>
              </div>

              {!onboardingKey ? (
                <>
                  <p className="modalIntro">Gere uma chave exclusiva para vincular o próximo computador ao cliente correto.</p>
                  <div className="onboardingForm">
                    <label><span>Cliente</span><select value={onboardingCustomerId} onChange={(event) => onOnboardingCustomerChange(event.target.value)}>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>
                    <label><span>Nome da instalação</span><input value={onboardingKeyName} onChange={(event) => onOnboardingKeyNameChange(event.target.value)} placeholder="Ex.: Caixa 03" /></label>
                  </div>
                  <div className="modalInfo"><strong>Como vai funcionar</strong><span>Depois de gerar a chave, o agente instalado no computador fará o cadastro automaticamente e ele aparecerá nesta lista.</span></div>
                  <div className="modalActions"><button className="secondary" type="button" onClick={onCloseOnboarding}>Cancelar</button><button className="primary" type="button" onClick={onCreateOnboardingKey} disabled={onboardingLoading || !onboardingCustomerId || onboardingKeyName.trim().length < 3}><KeyRound size={16} />{onboardingLoading ? "Gerando..." : "Gerar chave"}</button></div>
                </>
              ) : (
                <>
                  <div className="onboardingSuccess"><span className="successMark">✓</span><div><strong>Chave criada para {onboardingKey.customerName}</strong><span>Copie agora. Por segurança, ela não será exibida novamente.</span></div></div>
                  <div className="onboardingKeyBox"><code>{onboardingKey.key}</code><button className="iconButton compact" type="button" onClick={onCopyOnboardingKey} aria-label="Copiar chave de cadastro" title="Copiar chave"><Copy size={15} /></button></div>
                  <div className="modalInfo"><strong>Próximo passo</strong><span>Baixe o perfil e o instalador para a mesma pasta no computador que será cadastrado. Ao abrir o instalador, API, relay e chave serão preenchidos automaticamente. Não é necessário usar o terminal.</span></div>
                  {agentInstallerAvailable ? <button className="primary installerDownload" type="button" onClick={onDownloadAgentBundle}><Download size={16} />Baixar pacote de instalação</button> : null}
                  <button className="secondary installerDownload" type="button" onClick={onDownloadAgentProfile}><Download size={16} />Baixar perfil de instalação</button>
                  {agentInstallerAvailable ? <a className="primary installerDownload" href={AGENT_INSTALLER_URL} target="_blank" rel="noreferrer" download><Download size={16} />Baixar instalador do agente <ArrowUpRight size={14} /></a> : <div className="installerUnavailable"><strong>Instalador ainda não publicado</strong><span>Configure `REMOTO_AGENT_INSTALLER_PATH` na API ou `VITE_AGENT_INSTALLER_URL` no painel para liberar o download desta implantação.</span></div>}
                  <details className="advancedSetup"><summary>Instalação avançada para desenvolvimento</summary><pre className="setupCommand">{[`$env:REMOTO_API_URL="${API_URL}"`, `$env:REMOTO_AGENT_KEY="${onboardingKey.key}"`, "npm run agent:register"].join("\n")}</pre><a className="agentSourceLink" href="https://github.com/AndreHigo/Remote/tree/main/apps/agent" target="_blank" rel="noreferrer">Abrir código do agente <ArrowUpRight size={14} /></a></details>
                  <div className="modalActions"><button className="primary" type="button" onClick={onCloseOnboarding}>Concluir</button></div>
                </>
              )}
            </section>
          </div>
        ) : null}

      </section>

    </main>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone?: "good" | "muted" }) {
  return (
    <div className={`metric ${tone ?? ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function percentile(values: number[], ratio: number) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return Math.round(sorted[index]);
}

type Mp4BoxRange = { payloadStart: number; end: number };

function readMp4Boxes(buffer: Uint8Array, type: string | undefined, start = 0, end = buffer.byteLength): Mp4BoxRange[] {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const boxes: Mp4BoxRange[] = [];
  let offset = start;
  while (offset + 8 <= end) {
    const declaredSize = view.getUint32(offset);
    const headerSize = declaredSize === 1 ? 16 : 8;
    if (offset + headerSize > end) break;
    const byteLength = declaredSize === 1 ? Number(view.getBigUint64(offset + 8)) : declaredSize;
    if (!Number.isSafeInteger(byteLength) || byteLength < headerSize || offset + byteLength > end) break;
    const boxType = String.fromCharCode(...buffer.subarray(offset + 4, offset + 8));
    if (type === undefined || boxType === type) boxes.push({ payloadStart: offset + headerSize, end: offset + byteLength });
    offset += byteLength;
  }
  return boxes;
}

function findMp4BoxDeep(buffer: Uint8Array, type: string, start: number, end: number): Mp4BoxRange | undefined {
  const direct = readMp4Boxes(buffer, type, start, end)[0];
  if (direct) return direct;
  for (const box of readMp4Boxes(buffer, undefined, start, end)) {
    const nested = findMp4BoxDeep(buffer, type, box.payloadStart, box.end);
    if (nested) return nested;
  }
}

function findVideoTrackId(segment: Uint8Array): number | undefined {
  const view = new DataView(segment.buffer, segment.byteOffset, segment.byteLength);
  for (const moov of readMp4Boxes(segment, "moov")) {
    for (const trak of readMp4Boxes(segment, "trak", moov.payloadStart, moov.end)) {
      const handler = findMp4BoxDeep(segment, "hdlr", trak.payloadStart, trak.end);
      if (!handler || String.fromCharCode(...segment.subarray(handler.payloadStart + 8, handler.payloadStart + 12)) !== "vide") continue;
      const tkhd = readMp4Boxes(segment, "tkhd", trak.payloadStart, trak.end)[0];
      if (!tkhd || tkhd.payloadStart + 16 > tkhd.end) continue;
      const trackIdOffset = view.getUint8(tkhd.payloadStart) === 1 ? tkhd.payloadStart + 20 : tkhd.payloadStart + 12;
      if (trackIdOffset + 4 <= tkhd.end) return view.getUint32(trackIdOffset);
    }
  }
  return undefined;
}

function countVideoSamples(segment: Uint8Array, expectedTrackId: number | undefined): number {
  const view = new DataView(segment.buffer, segment.byteOffset, segment.byteLength);
  const counts: number[] = [];
  for (const moof of readMp4Boxes(segment, "moof")) {
    for (const traf of readMp4Boxes(segment, "traf", moof.payloadStart, moof.end)) {
      const tfhd = readMp4Boxes(segment, "tfhd", traf.payloadStart, traf.end)[0];
      const trackId = tfhd && tfhd.payloadStart + 8 <= tfhd.end ? view.getUint32(tfhd.payloadStart + 4) : undefined;
      if (expectedTrackId !== undefined && trackId !== expectedTrackId) continue;
      for (const trun of readMp4Boxes(segment, "trun", traf.payloadStart, traf.end)) {
        if (trun.payloadStart + 8 <= trun.end) counts.push(view.getUint32(trun.payloadStart + 4));
      }
    }
  }
  return counts.length ? Math.max(...counts) : 0;
}

function GameSessionPanel({ session, realtimeUrl, started, onStartWeb, onClose }: { session: RemoteSessionDescriptor; realtimeUrl: string; started: boolean; onStartWeb: () => void; onClose: () => void }) {
  const monitors = session.monitors ?? [];
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const socketRef = React.useRef<WebSocket | null>(null);
  const sourceBufferRef = React.useRef<SourceBuffer | null>(null);
  const mediaQueueRef = React.useRef<Uint8Array[]>([]);
  const mediaQueueBytesRef = React.useRef(0);
  const pressedKeysRef = React.useRef(new Set<string>());
  const pressedButtonsRef = React.useRef(new Set<"left" | "middle" | "right">());
  const pressedGamepadKeysRef = React.useRef(new Set<string>());
  const pingTimerRef = React.useRef<number | null>(null);
  const videoFrameCountRef = React.useRef(0);
  const videoTrackIdRef = React.useRef<number | undefined>(undefined);
  const latencySamplesRef = React.useRef<number[]>([]);
  const qualityStartedAtRef = React.useRef<number | null>(null);
  const qualityLatencyHistoryRef = React.useRef<Array<{ elapsedMs: number; rttMs: number }>>([]);
  const qualityFpsHistoryRef = React.useRef<Array<{ elapsedMs: number; fps: number }>>([]);
  const reconnectCountRef = React.useRef(0);
  const firstFrameAtRef = React.useRef<number | null>(null);
  const droppedFramesRef = React.useRef(0);
  const fpsTimerRef = React.useRef<number | null>(null);
  const pendingMouseMotionRef = React.useRef({ dx: 0, dy: 0 });
  const mouseMotionFrameRef = React.useRef<number | null>(null);
  const lastMousePositionRef = React.useRef<{ x: number; y: number } | null>(null);
  const [status, setStatus] = React.useState("Conectando ao computador...");
  const [error, setError] = React.useState<string | null>(null);
  const [latencyMs, setLatencyMs] = React.useState<number | null>(null);
  const [latencyP95Ms, setLatencyP95Ms] = React.useState<number | null>(null);
  const [relayDroppedFrames, setRelayDroppedFrames] = React.useState(0);
  const [relayDroppedBytes, setRelayDroppedBytes] = React.useState(0);
  const [firstFrameMs, setFirstFrameMs] = React.useState<number | null>(null);
  const [fps, setFps] = React.useState<number | null>(null);
  const [droppedFrames, setDroppedFrames] = React.useState(0);
  const [nativeDownloaded, setNativeDownloaded] = React.useState(false);
  const [gamepadConnected, setGamepadConnected] = React.useState(false);
  const [controlActive, setControlActive] = React.useState(false);
  const [pointerLocked, setPointerLocked] = React.useState(false);
  const [activeMonitorIndex, setActiveMonitorIndex] = React.useState(() => session.monitorIndex ?? monitors.find((monitor) => monitor.primary)?.index ?? monitors[0]?.index ?? 0);

  React.useEffect(() => {
    const updatePointerLock = () => {
      const locked = document.pointerLockElement === videoRef.current;
      setPointerLocked(locked);
      setControlActive(locked);
      if (locked) setStatus("Controle ativo. Mova o mouse na sessao; Esc libera o controle.");
      else if (videoRef.current) setStatus("Controle liberado. Clique em Capturar controle para retomar.");
    };
    const handlePointerLockError = () => {
      setPointerLocked(false);
      setControlActive(false);
      setStatus("O navegador bloqueou a captura do mouse. Clique novamente em Capturar controle.");
    };
    document.addEventListener("pointerlockchange", updatePointerLock);
    document.addEventListener("pointerlockerror", handlePointerLockError);
    return () => {
      document.removeEventListener("pointerlockchange", updatePointerLock);
      document.removeEventListener("pointerlockerror", handlePointerLockError);
      if (document.pointerLockElement === videoRef.current) document.exitPointerLock();
    };
  }, []);

  React.useEffect(() => {
    if (started && qualityStartedAtRef.current === null) qualityStartedAtRef.current = performance.now();
    fpsTimerRef.current = window.setInterval(() => {
      const nextFps = videoFrameCountRef.current;
      setFps(nextFps);
      if (qualityStartedAtRef.current !== null) {
        qualityFpsHistoryRef.current = [
          ...qualityFpsHistoryRef.current,
          { elapsedMs: Math.max(0, Math.round(performance.now() - qualityStartedAtRef.current)), fps: nextFps }
        ].slice(-600);
      }
      videoFrameCountRef.current = 0;
    }, 1000);
    return () => {
      if (fpsTimerRef.current !== null) window.clearInterval(fpsTimerRef.current);
      fpsTimerRef.current = null;
    };
  }, [started]);

  React.useEffect(() => {
    if (!started) return;
    const video = videoRef.current;
    if (!video || !("MediaSource" in window)) {
      setError("Este navegador nao suporta a reproducao de video do modo jogo.");
      return;
    }

    const mediaSource = new MediaSource();
    video.src = URL.createObjectURL(mediaSource);
    const realtimeBase = realtimeUrl.startsWith("/")
      ? `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}${realtimeUrl}`
      : realtimeUrl;
    let disposed = false;
    const sessionStartedAt = performance.now();
    let reconnectTimer: number | null = null;
    let firstFrameTimer: number | null = null;
    let reconnectAttempt = 0;
    let reconnectAllowed = true;
    const socketUrl = `${realtimeBase.replace(/\/$/, "")}/sessions/${encodeURIComponent(session.sessionId)}`;

    const pump = () => {
      const sourceBuffer = sourceBufferRef.current;
      if (!sourceBuffer || sourceBuffer.updating || mediaQueueRef.current.length === 0) return;
      const next = mediaQueueRef.current.shift();
      if (!next) return;
      mediaQueueBytesRef.current -= next.byteLength;
      try {
        const appendable = new Uint8Array(next.byteLength);
        appendable.set(next);
        sourceBuffer.appendBuffer(appendable.buffer);
      } catch {
        mediaQueueRef.current.unshift(next);
        mediaQueueBytesRef.current += next.byteLength;
        window.setTimeout(pump, 50);
      }
    };

    const onSourceOpen = () => {
      try {
        const mime = [
          ...(session.audio === "system" ? [
            "video/mp4; codecs=\"avc1.4D002A,mp4a.40.2\"",
            "video/mp4; codecs=\"avc1.4D401F,mp4a.40.2\"",
            "video/mp4; codecs=\"avc1.64002A,mp4a.40.2\""
          ] : []),
          "video/mp4; codecs=\"avc1.4D002A\"",
          "video/mp4; codecs=\"avc1.4D401F\"",
          "video/mp4; codecs=\"avc1.64002A\""
        ].find((candidate) => MediaSource.isTypeSupported(candidate));
        if (!mime) throw new Error("Codec H.264 nao suportado neste navegador");
        const sourceBuffer = mediaSource.addSourceBuffer(mime);
        sourceBuffer.mode = "sequence";
        sourceBuffer.addEventListener("updateend", pump);
        sourceBufferRef.current = sourceBuffer;
        pump();
      } catch (sourceError) {
        setError(sourceError instanceof Error ? sourceError.message : "Nao foi possivel preparar o video");
      }
    };

    mediaSource.addEventListener("sourceopen", onSourceOpen, { once: true });

    const clearPing = () => {
      if (pingTimerRef.current !== null) window.clearInterval(pingTimerRef.current);
      pingTimerRef.current = null;
    };

    const clearFirstFrameTimer = () => {
      if (firstFrameTimer !== null) window.clearTimeout(firstFrameTimer);
      firstFrameTimer = null;
    };

    const armFirstFrameTimer = () => {
      clearFirstFrameTimer();
      firstFrameTimer = window.setTimeout(() => {
        if (!disposed) {
          setStatus("Video nao recebido em 20s.");
          setError("O computador remoto conectou, mas nao enviou video. Verifique o FFmpeg e atualize o inventario do dispositivo.");
        }
      }, 20_000);
    };

    const scheduleReconnect = () => {
      if (disposed || !reconnectAllowed || reconnectTimer !== null) return;
      if (reconnectAttempt >= 8) {
        setStatus("Nao foi possivel reconectar ao computador.");
        return;
      }
      const delay = Math.min(15_000, 500 * 2 ** reconnectAttempt);
      reconnectAttempt += 1;
      setStatus(`Reconectando ao computador em ${Math.ceil(delay / 1000)}s...`);
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, delay);
    };

    function connect() {
      if (disposed || !reconnectAllowed) return;
      const socket = new WebSocket(socketUrl);
      socket.binaryType = "arraybuffer";
      socketRef.current = socket;
      socket.addEventListener("open", () => {
        reconnectAttempt = 0;
        socket.send(JSON.stringify({ type: "hello", accessToken: session.accessToken }));
        setError(null);
        setStatus("Aguardando video do computador...");
        clearPing();
        pingTimerRef.current = window.setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "ping", sentAt: performance.now() }));
        }, 2000);
      });
      socket.addEventListener("message", (event) => {
        if (typeof event.data === "string") {
          let message: { type?: string; reason?: string; peerConnected?: boolean; sentAt?: number; relayDroppedFrames?: number; relayDroppedBytes?: number };
          try {
            message = JSON.parse(event.data) as typeof message;
          } catch {
            setError("O relay enviou um controle invalido.");
            return;
          }
          if (message.type === "ready") {
            if (message.peerConnected) armFirstFrameTimer();
            else clearFirstFrameTimer();
            setStatus(message.peerConnected ? "Conectado. Clique no video para capturar o mouse." : "Conectado. Aguardando o agente do computador...");
          }
          if (message.type === "closed") {
            if (message.reason === "session-expired" || message.reason === "session-ended") reconnectAllowed = false;
            setStatus(message.reason === "peer-disconnected" ? "O computador remoto desconectou. Reconectando..." : message.reason ?? "Sessao encerrada.");
          }
          if (message.type === "pong" && typeof message.sentAt === "number") {
            const sample = Math.max(0, Math.round(performance.now() - message.sentAt));
            latencySamplesRef.current = [...latencySamplesRef.current, sample].slice(-60);
            if (qualityStartedAtRef.current !== null) {
              qualityLatencyHistoryRef.current = [
                ...qualityLatencyHistoryRef.current,
                { elapsedMs: Math.max(0, Math.round(performance.now() - qualityStartedAtRef.current)), rttMs: sample }
              ].slice(-600);
            }
            setLatencyMs(sample);
            setLatencyP95Ms(percentile(latencySamplesRef.current, 0.95));
          }
          if (message.type === "quality") {
            if (typeof message.relayDroppedFrames === "number" && Number.isFinite(message.relayDroppedFrames)) setRelayDroppedFrames(Math.max(0, Math.floor(message.relayDroppedFrames)));
            if (typeof message.relayDroppedBytes === "number" && Number.isFinite(message.relayDroppedBytes)) setRelayDroppedBytes(Math.max(0, Math.floor(message.relayDroppedBytes)));
          }
          return;
        }
        const frame = new Uint8Array(event.data as ArrayBuffer);
        clearFirstFrameTimer();
        setError(null);
        setStatus((current) => current === "Trocando de monitor..."
          ? "Conectado. Clique no video para capturar o mouse."
          : current);
        if (frame.byteLength > 8 * 1024 * 1024) {
          setError("O frame recebido excede o limite permitido.");
          return;
        }
        videoTrackIdRef.current ??= findVideoTrackId(frame);
        videoFrameCountRef.current += countVideoSamples(frame, videoTrackIdRef.current);
        if (firstFrameAtRef.current === null) {
          firstFrameAtRef.current = performance.now();
          setFirstFrameMs(Math.max(0, Math.round(firstFrameAtRef.current - sessionStartedAt)));
        }
        mediaQueueRef.current.push(frame);
        mediaQueueBytesRef.current += frame.byteLength;
        while (mediaQueueBytesRef.current > 16 * 1024 * 1024 && mediaQueueRef.current.length > 1) {
          const dropped = mediaQueueRef.current.shift();
          mediaQueueBytesRef.current -= dropped?.byteLength ?? 0;
          droppedFramesRef.current += 1;
          setDroppedFrames(droppedFramesRef.current);
        }
        pump();
      });
      socket.addEventListener("error", () => setError("Nao foi possivel conectar ao relay realtime."));
      socket.addEventListener("close", (event) => {
        clearPing();
        clearFirstFrameTimer();
        if (socketRef.current === socket) socketRef.current = null;
        if (event.code === 1008) reconnectAllowed = false;
        if (!disposed && reconnectAllowed) {
          reconnectCountRef.current += 1;
          scheduleReconnect();
        }
        else if (!disposed) setStatus("Sessao realtime encerrada.");
      });
    }

    connect();

    return () => {
      disposed = true;
      reconnectAllowed = false;
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      reconnectTimer = null;
      clearPing();
      clearFirstFrameTimer();
      socketRef.current?.close();
      socketRef.current = null;
      sourceBufferRef.current = null;
      mediaQueueRef.current = [];
      mediaQueueBytesRef.current = 0;
      videoFrameCountRef.current = 0;
      videoTrackIdRef.current = undefined;
      latencySamplesRef.current = [];
      qualityLatencyHistoryRef.current = [];
      qualityFpsHistoryRef.current = [];
      reconnectCountRef.current = 0;
      qualityStartedAtRef.current = null;
      firstFrameAtRef.current = null;
      droppedFramesRef.current = 0;
      if (mouseMotionFrameRef.current !== null) window.cancelAnimationFrame(mouseMotionFrameRef.current);
      mouseMotionFrameRef.current = null;
      pendingMouseMotionRef.current = { dx: 0, dy: 0 };
      lastMousePositionRef.current = null;
      setLatencyMs(null);
      setLatencyP95Ms(null);
      setRelayDroppedFrames(0);
      setRelayDroppedBytes(0);
      setFirstFrameMs(null);
      setDroppedFrames(0);
      setFps(null);
      URL.revokeObjectURL(video.src);
    };
  }, [realtimeUrl, session.accessToken, session.sessionId, started]);

  React.useEffect(() => {
    if (!started || typeof navigator.getGamepads !== "function") {
      setGamepadConnected(false);
      return;
    }

    const releaseGamepad = () => {
      for (const code of pressedGamepadKeysRef.current) {
        if (pressedKeysRef.current.has(code)) continue;
        const scanCode = scanCodes[code];
        if (scanCode) sendInput({ type: "key", scanCode, action: "up", ...(extendedScanCodes.has(code) ? { extended: true } : {}) });
      }
      pressedGamepadKeysRef.current.clear();
    };
    const setGamepadKey = (code: string, down: boolean) => {
      const scanCode = scanCodes[code];
      if (!scanCode) return;
      if (down) {
        if (pressedGamepadKeysRef.current.has(code)) return;
        pressedGamepadKeysRef.current.add(code);
        if (!pressedKeysRef.current.has(code)) sendInput({ type: "key", scanCode, action: "down", ...(extendedScanCodes.has(code) ? { extended: true } : {}) });
      } else if (pressedGamepadKeysRef.current.delete(code) && !pressedKeysRef.current.has(code)) {
        sendInput({ type: "key", scanCode, action: "up", ...(extendedScanCodes.has(code) ? { extended: true } : {}) });
      }
    };
    const pollGamepad = () => {
      const pad = Array.from(navigator.getGamepads()).find((candidate) => candidate?.connected);
      if (!pad) {
        setGamepadConnected((current) => current ? false : current);
        releaseGamepad();
        return;
      }
      setGamepadConnected((current) => current ? current : true);
      const deadZone = 0.24;
      const leftX = pad.axes[0] ?? 0;
      const leftY = pad.axes[1] ?? 0;
      setGamepadKey("KeyA", leftX < -deadZone);
      setGamepadKey("KeyD", leftX > deadZone);
      setGamepadKey("KeyW", leftY < -deadZone);
      setGamepadKey("KeyS", leftY > deadZone);
      const rightX = pad.axes[2] ?? 0;
      const rightY = pad.axes[3] ?? 0;
      if (Math.abs(rightX) > deadZone || Math.abs(rightY) > deadZone) {
        queueMouseMotion(rightX * 18, rightY * 18);
      }
      for (const [index, code] of gamepadButtonScanCodes) setGamepadKey(code, pad.buttons[index]?.pressed === true);
    };

    const timer = window.setInterval(pollGamepad, 33);
    pollGamepad();
    return () => {
      window.clearInterval(timer);
      releaseGamepad();
      setGamepadConnected(false);
    };
  }, [started, session.sessionId]);

  React.useEffect(() => {
    if (!started || !controlActive) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Escape" && document.pointerLockElement === videoRef.current) {
        event.preventDefault();
        document.exitPointerLock();
        return;
      }
      if (isLocalInteractiveTarget(event.target)) return;
      sendKey(event, "down");
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (isLocalInteractiveTarget(event.target)) return;
      sendKey(event, "up");
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [started, controlActive, session.sessionId]);

  React.useEffect(() => {
    const releasePressedInputs = () => {
      if (mouseMotionFrameRef.current !== null) window.cancelAnimationFrame(mouseMotionFrameRef.current);
      mouseMotionFrameRef.current = null;
      pendingMouseMotionRef.current = { dx: 0, dy: 0 };
      lastMousePositionRef.current = null;
      for (const button of pressedButtonsRef.current) {
        sendInput({ type: "mouse.button", button, action: "up" });
      }
      pressedButtonsRef.current.clear();
      for (const code of new Set([...pressedKeysRef.current, ...pressedGamepadKeysRef.current])) {
        const scanCode = scanCodes[code];
        if (!scanCode) continue;
        const extended = extendedScanCodes.has(code);
        sendInput({ type: "key", scanCode, action: "up", ...(extended ? { extended: true } : {}) });
      }
      pressedKeysRef.current.clear();
      pressedGamepadKeysRef.current.clear();
    };
    const releaseOnPointerLockChange = () => {
      if (document.pointerLockElement !== videoRef.current) releasePressedInputs();
    };

    window.addEventListener("blur", releasePressedInputs);
    document.addEventListener("visibilitychange", releasePressedInputs);
    document.addEventListener("pointerlockchange", releaseOnPointerLockChange);
    return () => {
      window.removeEventListener("blur", releasePressedInputs);
      document.removeEventListener("visibilitychange", releasePressedInputs);
      document.removeEventListener("pointerlockchange", releaseOnPointerLockChange);
      releasePressedInputs();
    };
  }, [session.sessionId]);

  function sendInput(event: Record<string, unknown>) {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "input", event }));
  }

  function queueMouseMotion(dx: number, dy: number) {
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
    pendingMouseMotionRef.current.dx += dx;
    pendingMouseMotionRef.current.dy += dy;
    if (mouseMotionFrameRef.current !== null) return;
    mouseMotionFrameRef.current = window.requestAnimationFrame(() => {
      mouseMotionFrameRef.current = null;
      const motion = pendingMouseMotionRef.current;
      pendingMouseMotionRef.current = { dx: 0, dy: 0 };
      const nextDx = Math.round(motion.dx);
      const nextDy = Math.round(motion.dy);
      if (nextDx !== 0 || nextDy !== 0) sendInput({ type: "mouse.relative", dx: nextDx, dy: nextDy });
    });
  }

  function downloadNativeDescriptor() {
    const apiUrl = API_URL.startsWith("/") ? `${window.location.origin}${API_URL}` : API_URL;
    const absoluteRealtimeUrl = realtimeUrl.startsWith("/")
      ? `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}${realtimeUrl}`
      : realtimeUrl;
    const payload = {
      ...session,
      apiUrl,
      realtimeUrl: absoluteRealtimeUrl
    };
    const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `remoto-${session.deviceId}.remoto-session`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setNativeDownloaded(true);
    setStatus("Descritor baixado. Abra-o no Remoto Operator para iniciar a sessao.");
  }

  function downloadQualityReport() {
    const startedAt = qualityStartedAtRef.current;
    const durationMs = startedAt === null ? 0 : Math.max(0, Math.round(performance.now() - startedAt));
    const safeDeviceId = session.deviceId.replace(/[^a-z0-9_-]/gi, "-");
    const report = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      sessionId: session.sessionId,
      deviceId: session.deviceId,
      mode: session.mode,
      durationMs,
      metrics: {
        firstFrameMs,
        latestRttMs: latencyMs,
        latencyP95Ms,
        relayDroppedFrames,
        relayDroppedBytes,
        currentFps: fps,
        droppedFrames,
        reconnects: reconnectCountRef.current,
        latencySamples: qualityLatencyHistoryRef.current,
        fpsSamples: qualityFpsHistoryRef.current
      }
    };
    const url = URL.createObjectURL(new Blob([`${JSON.stringify(report, null, 2)}\n`], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `remoto-remote-quality-${safeDeviceId}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setStatus("Relatorio de qualidade baixado.");
  }

  function sendKey(event: Pick<KeyboardEvent, "code" | "preventDefault">, action: "down" | "up") {
    const scanCode = scanCodes[event.code];
    if (!scanCode) return;
    event.preventDefault();
    if (action === "down") {
      pressedKeysRef.current.add(event.code);
      if (!pressedGamepadKeysRef.current.has(event.code)) sendInput({ type: "key", scanCode, action, ...(extendedScanCodes.has(event.code) ? { extended: true } : {}) });
    } else {
      pressedKeysRef.current.delete(event.code);
      if (!pressedGamepadKeysRef.current.has(event.code)) sendInput({ type: "key", scanCode, action, ...(extendedScanCodes.has(event.code) ? { extended: true } : {}) });
    }
  }

  function toggleControl() {
    const video = videoRef.current;
    if (!video) return;
    if (document.pointerLockElement === video) {
      document.exitPointerLock();
      return;
    }
    setControlActive(true);
    setStatus("Capturando o mouse na sessao...");
    video.focus();
    const request = video.requestPointerLock();
    if (request) void request.catch(() => {
      setControlActive(false);
      setStatus("O navegador recusou a captura. Clique novamente em Capturar controle.");
    });
  }

  function captureVideoPointer(video: HTMLVideoElement) {
    video.focus();
    lastMousePositionRef.current = null;
    setControlActive(true);
    const request = video.requestPointerLock();
    if (request) void request.catch(() => {
      setControlActive(false);
      setStatus("O navegador recusou a captura. Clique novamente em Capturar controle.");
    });
  }

  function handleVideoMouseMove(event: React.MouseEvent<HTMLVideoElement>) {
    if (!controlActive) return;
    const pointerLocked = document.pointerLockElement === event.currentTarget;
    const previous = lastMousePositionRef.current;
    const dx = pointerLocked || !previous ? event.movementX : event.clientX - previous.x;
    const dy = pointerLocked || !previous ? event.movementY : event.clientY - previous.y;
    lastMousePositionRef.current = { x: event.clientX, y: event.clientY };
    queueMouseMotion(dx, dy);
  }

  function switchMonitor(monitorIndex: number) {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN || monitorIndex === activeMonitorIndex) return;
    socket.send(JSON.stringify({ type: "monitor", index: monitorIndex }));
    setActiveMonitorIndex(monitorIndex);
    setStatus("Trocando de monitor...");
  }

  return (
    <div className="gameSessionBackdrop" role="presentation">
      <section className="gameSessionPanel" role="dialog" aria-modal="true" aria-labelledby="game-session-title">
        <header className="gameSessionHeader">
          <div><p className="eyebrow">{session.mode === "game" ? <Gamepad2 size={14} /> : <Monitor size={14} />} {session.mode === "game" ? "Modo jogo experimental" : "Suporte remoto"}</p><h2 id="game-session-title">Sessao remota</h2><span>{status}</span></div>
          <span className="gameSessionHeaderActions">{started ? <button className="secondary compact" type="button" onClick={toggleControl} title={pointerLocked ? "Liberar teclado e mouse" : "Capturar teclado e mouse"}><MousePointer2 size={14} />{pointerLocked ? "Liberar controle" : controlActive ? "Capturando..." : "Capturar controle"}</button> : null}<button className="iconButton" type="button" onClick={onClose} aria-label="Encerrar sessao" title="Encerrar sessao"><X size={17} /></button></span>
        </header>
        {started && monitors.length > 0 ? <nav className="monitorTabs" aria-label="Monitores" role="tablist">{monitors.map((monitor) => <button key={monitor.index} className={monitor.index === activeMonitorIndex ? "monitorTab active" : "monitorTab"} type="button" role="tab" aria-selected={monitor.index === activeMonitorIndex} onClick={() => switchMonitor(monitor.index)}><Monitor size={15} />{monitor.primary ? "Principal" : `Monitor ${monitor.index + 1}`}<span>{monitor.name}</span></button>)}</nav> : null}
        {error ? <div className="gameSessionError">{error}</div> : null}
        {!started ? (
          <div className="gameLaunchChoice">
            {session.mode === "game" ? <Gamepad2 size={34} aria-hidden="true" /> : <Monitor size={34} aria-hidden="true" />}
            <h3>{session.mode === "game" ? "Escolha como abrir esta sessao" : "Abrir suporte remoto"}</h3>
            <p>{session.mode === "game" ? "O token ainda nao foi usado. Abra a sessao no navegador ou baixe o descritor para usar um cliente nativo." : "O suporte remoto abre diretamente no navegador com teclado e mouse."}</p>
            <div className="gameLaunchActions">
              <button className="primary" type="button" onClick={onStartWeb} disabled={nativeDownloaded}><Play size={16} />Abrir no navegador</button>
              {session.mode === "game" ? <button className="secondary" type="button" onClick={downloadNativeDescriptor} disabled={nativeDownloaded}><Download size={16} />{nativeDownloaded ? "Descritor baixado" : "Cliente nativo"}</button> : null}
            </div>
          </div>
        ) : (
          <video
            ref={videoRef}
            className={pointerLocked ? "gameSessionVideo pointerLocked" : "gameSessionVideo"}
            autoPlay
            playsInline
            muted={session.audio !== "system"}
            tabIndex={0}
            onClick={(event) => captureVideoPointer(event.currentTarget)}
            onPointerDown={(event) => { event.preventDefault(); captureVideoPointer(event.currentTarget); }}
            onContextMenu={(event) => event.preventDefault()}
            onMouseMove={handleVideoMouseMove}
            onMouseDown={(event) => { if (!controlActive) return; event.preventDefault(); const button = mouseButtons[event.button] ?? "left"; pressedButtonsRef.current.add(button); sendInput({ type: "mouse.button", button, action: "down" }); }}
            onMouseUp={(event) => { if (!controlActive) return; const button = mouseButtons[event.button] ?? "left"; pressedButtonsRef.current.delete(button); sendInput({ type: "mouse.button", button, action: "up" }); }}
            onWheel={(event) => { if (controlActive) sendInput({ type: "mouse.wheel", delta: Math.round(event.deltaY * -1) }); }}
          />
        )}
        <footer className="gameSessionFooter"><span>{started ? <>Video H.264 / relay autenticado / Entrada: teclado + mouse{session.mode === "game" ? ` / Gamepad: ${gamepadConnected ? "mapa experimental" : "conecte um controle"}` : " / Controle: desktop"}{latencyMs === null ? "" : ` / RTT ${latencyMs} ms`}{latencyP95Ms === null ? "" : ` / p95 ${latencyP95Ms} ms`}{firstFrameMs === null ? "" : ` / 1o frame ${firstFrameMs} ms`}{fps === null ? "" : ` / FPS ${fps}`}{droppedFrames > 0 ? ` / fila descartada ${droppedFrames}` : ""}{relayDroppedFrames > 0 ? ` / relay descartou ${relayDroppedFrames}` : ""}</> : "Sessao aprovada e aguardando sua escolha"}</span><div className="gameSessionFooterActions"><button className="secondary compact" type="button" onClick={downloadQualityReport} disabled={!started} title="Baixar relatorio JSON da sessao"><Download size={14} />Relatorio</button><button className="danger" type="button" onClick={onClose}>Encerrar sessao</button></div></footer>
      </section>
    </div>
  );
}

const mouseButtons = ["left", "middle", "right"] as const;

function isLocalInteractiveTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && Boolean(target.closest("button, input, textarea, select, a, [contenteditable='true']"));
}

const gamepadButtonScanCodes = new Map<number, string>([
  [0, "Space"], [1, "Escape"], [2, "KeyR"], [3, "KeyE"], [4, "KeyQ"], [5, "KeyF"],
  [6, "ShiftLeft"], [7, "ControlLeft"], [8, "Backspace"], [9, "Enter"], [10, "AltLeft"], [11, "Tab"],
  [12, "ArrowUp"], [13, "ArrowDown"], [14, "ArrowLeft"], [15, "ArrowRight"]
]);
const scanCodes: Record<string, number> = {
  Escape: 1, Digit1: 2, Digit2: 3, Digit3: 4, Digit4: 5, Digit5: 6, Digit6: 7, Digit7: 8, Digit8: 9, Digit9: 10, Digit0: 11,
  Minus: 12, Equal: 13, Backspace: 14, Tab: 15, KeyQ: 16, KeyW: 17, KeyE: 18, KeyR: 19, KeyT: 20, KeyY: 21,
  KeyU: 22, KeyI: 23, KeyO: 24, KeyP: 25, BracketLeft: 26, BracketRight: 27, Enter: 28, ControlLeft: 29,
  KeyA: 30, KeyS: 31, KeyD: 32, KeyF: 33, KeyG: 34, KeyH: 35, KeyJ: 36, KeyK: 37, KeyL: 38, Semicolon: 39,
  Quote: 40, Backquote: 41, ShiftLeft: 42, Backslash: 43, KeyZ: 44, KeyX: 45, KeyC: 46, KeyV: 47, KeyB: 48,
  KeyN: 49, KeyM: 50, Comma: 51, Period: 52, Slash: 53, ShiftRight: 54, NumpadMultiply: 55, AltLeft: 56,
  Space: 57, CapsLock: 58, F1: 59, F2: 60, F3: 61, F4: 62, F5: 63, F6: 64, F7: 65, F8: 66, F9: 67,
  F10: 68, NumLock: 69, ScrollLock: 70, Numpad7: 71, Numpad8: 72, Numpad9: 73, NumpadSubtract: 74,
  Numpad4: 75, Numpad5: 76, Numpad6: 77, NumpadAdd: 78, Numpad1: 79, Numpad2: 80, Numpad3: 81,
  Numpad0: 82, NumpadDecimal: 83, F11: 87, F12: 88, ControlRight: 157, AltRight: 184,
  ArrowUp: 72, ArrowDown: 80, ArrowLeft: 75, ArrowRight: 77, Home: 71, End: 79, PageUp: 73,
  PageDown: 81, Insert: 82, Delete: 83, NumpadEnter: 28, NumpadDivide: 53, ContextMenu: 93, PrintScreen: 55
};
const extendedScanCodes = new Set([
  "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Insert", "Delete", "Home", "End", "PageUp", "PageDown",
  "NumpadEnter", "NumpadDivide", "ContextMenu", "PrintScreen"
]);

function LoginScreen({ onLogin, notice }: { onLogin: (response: LoginResponse) => void; notice?: string }) {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [message, setMessage] = React.useState(notice || "Use suas credenciais para acessar o workspace.");
  const [loading, setLoading] = React.useState(false);
  const [twoFactorRequired, setTwoFactorRequired] = React.useState(false);
  const [twoFactorCode, setTwoFactorCode] = React.useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("Validando credenciais...");

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, ...(twoFactorRequired ? { totpCode: twoFactorCode } : {}) })
      });

      const payload = (await response.json().catch(() => ({}))) as LoginResponse & { message?: string };
      if (!response.ok) {
        setMessage(payload.message ?? "Credenciais ou codigo invalidos.");
        return;
      }

      if (payload.requiresTwoFactor) {
        setTwoFactorRequired(true);
        setMessage("Digite o codigo de 6 digitos do seu autenticador.");
        return;
      }

      onLogin(payload);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao conectar na API.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="loginShell">
      <section className="loginPanel">
        <div className="loginAside">
          <div className="brand loginBrand">
            <span className="brandMark">R</span>
            <div>
              <strong>Remoto</strong>
              <small>Console de operacoes</small>
            </div>
          </div>

          <div className="loginBrandCopy">
            <p>CONTROLE REMOTO</p>
            <h2>Acesse seus dispositivos com contexto.</h2>
            <span>Presenca, inventario e sessoes em um unico workspace.</span>
          </div>
        </div>

        <form className="loginForm" onSubmit={(event) => void submit(event)}>
          <div>
            <p className="eyebrow">Acesso protegido</p>
            <h1>Entrar</h1>
            <p>{message}</p>
          </div>

          <label>
            <span>Email</span>
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" />
          </label>

          <label>
            <span>Senha</span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              autoComplete="current-password"
            />
          </label>

          {twoFactorRequired ? (
            <label>
              <span>Codigo 2FA</span>
              <input
                value={twoFactorCode}
                onChange={(event) => setTwoFactorCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                autoFocus
              />
            </label>
          ) : null}

          <button className="primary loginButton" type="submit" disabled={loading}>
            <LockKeyhole size={16} />
            {loading ? "Validando" : twoFactorRequired ? "Validar codigo" : "Entrar"}
          </button>

          <small className="loginFootnote">Acesso protegido por sessao segura e autenticacao opcional em dois fatores.</small>
        </form>
      </section>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
