import React from "react";
import ReactDOM from "react-dom/client";
import {
  Activity,
  ArrowUpRight,
  Ban,
  ChevronRight,
  Copy,
  KeyRound,
  LockKeyhole,
  LogOut,
  Monitor,
  Play,
  Plus,
  RefreshCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
  Wifi,
  WifiOff,
  X
} from "lucide-react";
import "./styles.css";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4100";
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

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "technician" | "viewer";
}

interface Customer {
  id: string;
  name: string;
}

interface LoginResponse {
  token?: string;
  user: AuthUser;
  requiresTwoFactor?: boolean;
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
}

interface AuditEvent {
  id: string;
  action: string;
  actor: string;
  targetId: string;
  createdAt: string;
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
  };
  software: {
    runtime?: {
      node?: string;
      agent?: string;
      agentVersion?: string;
    };
  };
}

interface CommandExecution {
  id: string;
  commandType: "ping" | "system-info" | "refresh-inventory";
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
  connection?: {
    protocol: string;
    uri: string;
    command: string;
  };
}

interface AgentKey {
  id: string;
  name: string;
  customerId: string;
  customerName: string;
  active: boolean;
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

async function getJson<T>(path: string, token: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined
  });
  if (!response.ok) throw new Error(`Falha na API: ${response.status}`);
  return response.json() as Promise<T>;
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

  if (!response.ok) throw new Error(`Falha na API: ${response.status}`);
  return response.json() as Promise<T>;
}

function App() {
  const [token, setToken] = React.useState(() => localStorage.getItem(TOKEN_KEY) ?? "");
  const [user, setUser] = React.useState<AuthUser | null>(() => {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  });
  const [authReady, setAuthReady] = React.useState(false);
  const [summary, setSummary] = React.useState<Summary | null>(null);
  const [devices, setDevices] = React.useState<Device[]>([]);
  const [auditEvents, setAuditEvents] = React.useState<AuditEvent[]>([]);
  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [agentKeys, setAgentKeys] = React.useState<AgentKey[]>([]);
  const [newKeyName, setNewKeyName] = React.useState("");
  const [newKeyCustomerId, setNewKeyCustomerId] = React.useState("");
  const [revealedAgentKey, setRevealedAgentKey] = React.useState<string | null>(null);
  const [twoFactorStatus, setTwoFactorStatus] = React.useState<TwoFactorStatus>({ enabled: false });
  const [twoFactorSetup, setTwoFactorSetup] = React.useState<TwoFactorSetup | null>(null);
  const [twoFactorCode, setTwoFactorCode] = React.useState("");
  const [twoFactorMessage, setTwoFactorMessage] = React.useState("");
  const [inventorySnapshots, setInventorySnapshots] = React.useState<InventorySnapshot[]>([]);
  const [commands, setCommands] = React.useState<CommandExecution[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = React.useState<string | null>(null);
  const [activeSection, setActiveSection] = React.useState<AppSection>("overview");
  const [deviceQuery, setDeviceQuery] = React.useState("");
  const [deviceFilter, setDeviceFilter] = React.useState<DeviceFilter>("all");
  const [connectDevice, setConnectDevice] = React.useState<Device | null>(null);
  const [connectReason, setConnectReason] = React.useState("");
  const [connectionLoading, setConnectionLoading] = React.useState(false);
  const [onboardingOpen, setOnboardingOpen] = React.useState(false);
  const [onboardingCustomerId, setOnboardingCustomerId] = React.useState("");
  const [onboardingKeyName, setOnboardingKeyName] = React.useState("Novo computador");
  const [onboardingKey, setOnboardingKey] = React.useState<CreatedAgentKey | null>(null);
  const [onboardingLoading, setOnboardingLoading] = React.useState(false);
  const [statusMessage, setStatusMessage] = React.useState("Carregando painel...");
  const [loading, setLoading] = React.useState(true);

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
        device.os
      ].some((value) => value.toLowerCase().includes(normalizedQuery));
      return matchesFilter && matchesQuery;
    });
  }, [deviceFilter, deviceQuery, devices]);

  React.useEffect(() => {
    if (filteredDevices.length > 0 && !filteredDevices.some((device) => device.id === selectedDeviceId)) {
      setSelectedDeviceId(filteredDevices[0].id);
    }
  }, [filteredDevices, selectedDeviceId]);

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
    setAuthReady(true);
    setStatusMessage("Login realizado");
  }

  function logout() {
    void postJson<{ ok: boolean }>("/auth/logout", token).catch(() => undefined);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken("");
    setUser(null);
    setSummary(null);
    setDevices([]);
    setAuditEvents([]);
    setCustomers([]);
    setAgentKeys([]);
    setRevealedAgentKey(null);
    setTwoFactorStatus({ enabled: false });
    setTwoFactorSetup(null);
    setTwoFactorCode("");
    setTwoFactorMessage("");
    setSelectedDeviceId(null);
    setActiveSection("overview");
    setDeviceQuery("");
    setDeviceFilter("all");
    setConnectDevice(null);
    setConnectReason("");
    setOnboardingOpen(false);
    setOnboardingKey(null);
  }

  const refresh = React.useCallback(async () => {
    if (!token && !user) return;

    setLoading(true);
    try {
      const [nextSummary, nextDevices, nextAuditEvents] = await Promise.all([
        getJson<Summary>("/summary", token),
        getJson<Device[]>("/devices", token),
        getJson<AuditEvent[]>("/audit-events", token)
      ]);

      setSummary(nextSummary);
      setDevices(nextDevices);
      setAuditEvents(nextAuditEvents);
      setSelectedDeviceId((current) => current ?? nextDevices[0]?.id ?? null);
      setStatusMessage("Painel atualizado");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Erro ao carregar painel");
      if (error instanceof Error && error.message.includes("401")) logout();
    } finally {
      setLoading(false);
    }
  }, [token, user]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const canManageKeys = user?.role === "owner" || user?.role === "admin";

  React.useEffect(() => {
    if (!user || !canManageKeys) {
      setCustomers([]);
      setAgentKeys([]);
      return;
    }

    let active = true;
    Promise.all([
      getJson<Customer[]>("/customers", token),
      getJson<AgentKey[]>("/agent-keys", token),
      getJson<TwoFactorStatus>("/auth/2fa/status", token)
    ])
      .then(([nextCustomers, nextKeys, nextTwoFactorStatus]) => {
        if (!active) return;
        setCustomers(nextCustomers);
        setAgentKeys(nextKeys);
        setTwoFactorStatus(nextTwoFactorStatus);
        setNewKeyCustomerId((current) => current || nextCustomers[0]?.id || "");
        setOnboardingCustomerId((current) => current || nextCustomers[0]?.id || "");
      })
      .catch(() => {
        if (active) setStatusMessage("Nao foi possivel carregar as chaves do agente");
      });

    return () => {
      active = false;
    };
  }, [canManageKeys, user?.id]);

  React.useEffect(() => {
    if (!user || !selectedDevice?.id) {
      setInventorySnapshots([]);
      return;
    }

    let active = true;

    Promise.all([
      getJson<InventorySnapshot[]>(`/devices/${selectedDevice.id}/inventory`, token),
      getJson<CommandExecution[]>(`/devices/${selectedDevice.id}/commands`, token)
    ])
      .then(([snapshots, nextCommands]) => {
        if (active) {
          setInventorySnapshots(snapshots);
          setCommands(nextCommands);
        }
      })
      .catch(() => {
        if (active) {
          setInventorySnapshots([]);
          setCommands([]);
        }
      });

    return () => {
      active = false;
    };
  }, [selectedDevice?.id, token, user?.id]);

  async function sendHeartbeat(deviceId: string) {
    setStatusMessage("Enviando heartbeat...");
    await postJson<Device>(`/devices/${deviceId}/heartbeat`, token);
    await refresh();
  }

  function requestSession(device: Device) {
    setConnectDevice(device);
    setConnectReason("Atendimento tecnico");
  }

  async function confirmConnection() {
    if (!connectDevice || connectReason.trim().length < 4) {
      setStatusMessage("Informe o motivo do acesso antes de continuar");
      return;
    }

    setConnectionLoading(true);
    setStatusMessage("Registrando solicitacao de acesso...");
    try {
      const session = await postJson<RemoteSessionResponse>("/remote-sessions", token, {
        deviceId: connectDevice.id,
        reason: connectReason.trim()
      });
      setConnectDevice(null);
      setConnectReason("");
      if (session.connection?.uri) {
        setStatusMessage("Sessao registrada. Abrindo RustDesk...");
        window.location.assign(session.connection.uri);
        return;
      }
      await refresh();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Nao foi possivel abrir a sessao");
    } finally {
      setConnectionLoading(false);
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

    await postJson("/auth/2fa/enable", token, { code: twoFactorCode });
    setTwoFactorStatus({ enabled: true });
    setTwoFactorSetup(null);
    setTwoFactorCode("");
    setTwoFactorMessage("2FA ativado para este usuario.");
  }

  async function disableTwoFactor() {
    if (!/^\d{6}$/.test(twoFactorCode)) {
      setTwoFactorMessage("Informe o codigo atual de 6 digitos para desativar.");
      return;
    }

    await postJson("/auth/2fa/disable", token, { code: twoFactorCode });
    setTwoFactorStatus({ enabled: false });
    setTwoFactorCode("");
    setTwoFactorMessage("2FA desativado.");
  }

  if (!authReady) {
    return <main className="loginShell">Carregando sessao...</main>;
  }

  if (!user) {
    return <LoginScreen onLogin={saveSession} />;
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
    latestInventory={latestInventory}
    commands={commands}
    customers={customers}
    agentKeys={agentKeys}
    newKeyName={newKeyName}
    newKeyCustomerId={newKeyCustomerId}
    revealedAgentKey={revealedAgentKey}
    twoFactorStatus={twoFactorStatus}
    twoFactorSetup={twoFactorSetup}
    twoFactorCode={twoFactorCode}
    twoFactorMessage={twoFactorMessage}
    canManageKeys={canManageKeys}
    connectDevice={connectDevice}
    connectReason={connectReason}
    connectionLoading={connectionLoading}
    onboardingOpen={onboardingOpen}
    onboardingCustomerId={onboardingCustomerId}
    onboardingKeyName={onboardingKeyName}
    onboardingKey={onboardingKey}
    onboardingLoading={onboardingLoading}
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
    onCloseConnection={() => { setConnectDevice(null); setConnectReason(""); }}
    onConfirmConnection={() => void confirmConnection()}
    onOpenOnboarding={openOnboarding}
    onCloseOnboarding={() => { setOnboardingOpen(false); setOnboardingKey(null); }}
    onOnboardingCustomerChange={setOnboardingCustomerId}
    onOnboardingKeyNameChange={setOnboardingKeyName}
    onCreateOnboardingKey={() => void createOnboardingKey()}
    onCopyOnboardingKey={() => void copyOnboardingKey()}
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
  latestInventory: InventorySnapshot | undefined;
  commands: CommandExecution[];
  customers: Customer[];
  agentKeys: AgentKey[];
  newKeyName: string;
  newKeyCustomerId: string;
  revealedAgentKey: string | null;
  twoFactorStatus: TwoFactorStatus;
  twoFactorSetup: TwoFactorSetup | null;
  twoFactorCode: string;
  twoFactorMessage: string;
  canManageKeys: boolean;
  connectDevice: Device | null;
  connectReason: string;
  connectionLoading: boolean;
  onboardingOpen: boolean;
  onboardingCustomerId: string;
  onboardingKeyName: string;
  onboardingKey: CreatedAgentKey | null;
  onboardingLoading: boolean;
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
  onCloseConnection: () => void;
  onConfirmConnection: () => void;
  onOpenOnboarding: () => void;
  onCloseOnboarding: () => void;
  onOnboardingCustomerChange: (value: string) => void;
  onOnboardingKeyNameChange: (value: string) => void;
  onCreateOnboardingKey: () => void;
  onCopyOnboardingKey: () => void;
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
    latestInventory,
    commands,
    customers,
    agentKeys,
    newKeyName,
    newKeyCustomerId,
    revealedAgentKey,
    twoFactorStatus,
    twoFactorSetup,
    twoFactorCode,
    twoFactorMessage,
    canManageKeys,
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
    connectionLoading,
    onboardingOpen,
    onboardingCustomerId,
    onboardingKeyName,
    onboardingKey,
    onboardingLoading,
    onConnectReasonChange,
    onCloseConnection,
    onConfirmConnection,
    onOpenOnboarding,
    onCloseOnboarding,
    onOnboardingCustomerChange,
    onOnboardingKeyNameChange,
    onCreateOnboardingKey,
    onCopyOnboardingKey
  } = props;

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
          {canManageKeys ? (
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
                    <dl className="details">
                      <div><dt>Usuario</dt><dd>{selectedDevice.userName}</dd></div>
                      <div><dt>IP local</dt><dd>{selectedDevice.localIp}</dd></div>
                      <div><dt>MAC principal</dt><dd>{selectedDevice.primaryMac ?? "n/a"}</dd></div>
                      <div><dt>Serial BIOS</dt><dd>{selectedDevice.biosSerial ?? "n/a"}</dd></div>
                      <div><dt>UUID sistema</dt><dd>{selectedDevice.systemUuid ?? "n/a"}</dd></div>
                      <div><dt>Sistema</dt><dd>{selectedDevice.os}</dd></div>
                    </dl>
                    <div className="tags">{selectedDevice.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>

                    <section className="subsection inventoryBox">
                      <div className="subsectionHeader"><div><h3>Inventario</h3><p>{latestInventory ? `Coletado em ${new Date(latestInventory.collectedAt).toLocaleString("pt-BR")}` : "Nenhum inventario coletado ainda."}</p></div><Monitor size={17} /></div>
                      {latestInventory ? <dl className="details compactDetails">
                        <div><dt>CPU</dt><dd>{latestInventory.hardware.cpu?.count ?? "n/a"}x {latestInventory.hardware.cpu?.model ?? "desconhecida"}</dd></div>
                        <div><dt>Memoria</dt><dd>{formatBytes(latestInventory.hardware.memory?.freeBytes)} livre de {formatBytes(latestInventory.hardware.memory?.totalBytes)}</dd></div>
                        <div><dt>Discos</dt><dd>{latestInventory.hardware.disks?.length ? latestInventory.hardware.disks.map((disk) => `${disk.name ?? disk.mountedAt ?? "disco"} ${formatBytes(disk.freeBytes)} livre`).join(", ") : "n/a"}</dd></div>
                        <div><dt>Runtime</dt><dd>{latestInventory.software.runtime?.node ?? "n/a"}</dd></div>
                      </dl> : null}
                    </section>

                    <section className="subsection commandsBox">
                      <div className="subsectionHeader"><div><h3>Comandos</h3><p>Acao enfileirada para o agente.</p></div><ChevronRight size={17} /></div>
                      <div className="commandButtons">
                        <button className="secondary compact" type="button" onClick={() => onRequestCommand(selectedDevice, "ping")}>ping</button>
                        <button className="secondary compact" type="button" onClick={() => onRequestCommand(selectedDevice, "system-info")}>system-info</button>
                        <button className="secondary compact" type="button" onClick={() => onRequestCommand(selectedDevice, "refresh-inventory")}>refresh</button>
                      </div>
                      {commands.length ? <ul className="commandList">{commands.slice(0, 4).map((item) => <li key={item.id}><strong>{item.commandType}</strong><span className={`commandStatus ${item.status}`}>{item.status}</span><small>{new Date(item.requestedAt).toLocaleString("pt-BR")}</small></li>)}</ul> : <p className="empty">Nenhum comando recente.</p>}
                    </section>
                  </>
                ) : <div className="emptyState"><Monitor size={24} /><strong>Selecione um dispositivo</strong><span>Os detalhes aparecem aqui.</span></div>}
              </aside>
            </section>
          </>
        ) : null}

        {activeSection === "security" && canManageKeys ? (
          <section className="securityView">
            <section className="panel keyPanel">
              <div className="panelHeader"><div><p className="eyebrow">Acesso de agentes</p><h2>Chaves por cliente</h2><p>Crie credenciais separadas e revogue acessos antigos.</p></div><KeyRound size={20} /></div>
              <div className="keyForm">
                <label><span>Cliente</span><select value={newKeyCustomerId} onChange={(event) => onKeyCustomerChange(event.target.value)}>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>
                <label><span>Nome da chave</span><input value={newKeyName} onChange={(event) => onKeyNameChange(event.target.value)} placeholder="Notebook suporte" /></label>
                <button className="primary compact" type="button" onClick={onCreateKey}><KeyRound size={15} />Criar chave</button>
              </div>
              {revealedAgentKey ? <div className="keyReveal" role="status"><div><strong>Copie esta chave agora</strong><span>O segredo nao sera exibido novamente.</span></div><code>{revealedAgentKey}</code><button className="iconButton compact" type="button" onClick={onCopyKey} aria-label="Copiar chave" title="Copiar chave"><Copy size={15} /></button></div> : null}
              <ul className="keyList">{agentKeys.map((key) => <li key={key.id}><span><strong>{key.name}</strong><small>{key.customerName} / criada em {new Date(key.createdAt).toLocaleDateString("pt-BR")}</small></span><span className={`commandStatus ${key.active ? "succeeded" : "failed"}`}>{key.active ? "Ativa" : "Revogada"}</span>{key.active ? <button className="iconButton compact" type="button" onClick={() => onRevokeKey(key)} aria-label={`Revogar ${key.name}`} title="Revogar chave"><Ban size={15} /></button> : null}</li>)}</ul>
            </section>
            <section className="panel twoFactorPanel">
              <div className="panelHeader"><div><p className="eyebrow">Protecao de conta</p><h2>Autenticacao em dois fatores</h2><p>{twoFactorStatus.enabled ? "Ativa para este usuario." : "Proteja a conta administrativa com TOTP."}</p></div><ShieldCheck size={20} /></div>
              {twoFactorSetup ? <div className="keyReveal twoFactorReveal" role="status"><strong>Segredo temporario</strong><code>{twoFactorSetup.secret}</code><small>{twoFactorSetup.otpauthUri}</small></div> : null}
              <div className="keyForm twoFactorForm"><label><span>Codigo do autenticador</span><input value={twoFactorCode} onChange={(event) => onTwoFactorCodeChange(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="000000" /></label>{!twoFactorStatus.enabled ? <><button className="secondary compact" type="button" onClick={onPrepareTwoFactor}><ShieldCheck size={15} />Preparar 2FA</button><button className="primary compact" type="button" onClick={onEnableTwoFactor} disabled={!twoFactorSetup}>Ativar 2FA</button></> : <button className="secondary compact" type="button" onClick={onDisableTwoFactor}><Ban size={15} />Desativar 2FA</button>}</div>
              {twoFactorMessage ? <small className="securityMessage">{twoFactorMessage}</small> : null}
            </section>
          </section>
        ) : null}

        {activeSection === "activity" ? <section className="panel auditPanel activityView"><div className="panelHeader"><div><p className="eyebrow">Historico do workspace</p><h2>Atividade recente</h2><p>Acoes registradas pela API e pelos operadores.</p></div><Activity size={20} /></div>{auditEvents.length === 0 ? <div className="emptyState"><Activity size={24} /><strong>Sem eventos ainda</strong><span>Heartbeats e sessoes aparecerao aqui.</span></div> : <ul className="auditList">{auditEvents.map((event) => <li key={event.id}><span className="activityIcon"><Activity size={16} /></span><div><strong>{event.action}</strong><span>{event.actor} / alvo {event.targetId}</span></div><time>{new Date(event.createdAt).toLocaleString("pt-BR")}</time></li>)}</ul>}</section> : null}

        {connectDevice ? (
          <div className="modalBackdrop" role="presentation" onMouseDown={onCloseConnection}>
            <section className="connectionModal" role="dialog" aria-modal="true" aria-labelledby="connection-title" onMouseDown={(event) => event.stopPropagation()}>
              <div className="modalHeader">
                <div><p className="eyebrow">Nova sessao</p><h2 id="connection-title">Abrir acesso remoto</h2></div>
                <button className="iconButton" type="button" onClick={onCloseConnection} aria-label="Fechar" title="Fechar"><X size={17} /></button>
              </div>
              <div className="connectionTarget"><span className={`deviceIcon ${connectDevice.status}`}><Monitor size={19} /></span><div><strong>{connectDevice.displayName}</strong><span>{connectDevice.customerName} / ID {connectDevice.remoteId}</span></div><span className={`status ${connectDevice.status}`}>{connectDevice.status === "online" ? "Online" : "Offline"}</span></div>
              <label className="reasonField"><span>Motivo do acesso</span><textarea value={connectReason} onChange={(event) => onConnectReasonChange(event.target.value)} rows={3} placeholder="Ex.: validar falha no caixa" autoFocus /></label>
              <p className="modalNote">A solicitacao sera registrada na atividade e abrira o cliente RustDesk quando autorizada.</p>
              <div className="modalActions"><button className="secondary" type="button" onClick={onCloseConnection}>Cancelar</button><button className="primary" type="button" onClick={onConfirmConnection} disabled={connectionLoading || connectReason.trim().length < 4}><Play size={16} />{connectionLoading ? "Registrando..." : "Registrar e abrir"}</button></div>
            </section>
          </div>
        ) : null}

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
                  <div className="modalInfo warning"><strong>Próximo passo</strong><span>O instalador Windows ainda está sendo preparado. Por enquanto, o agente de desenvolvimento precisa ser executado no computador remoto.</span></div>
                  <pre className="setupCommand">{[`$env:REMOTO_API_URL="${API_URL}"`, `$env:REMOTO_AGENT_KEY="${onboardingKey.key}"`, "npm run agent:register"].join("\n")}</pre>
                  <a className="agentSourceLink" href="https://github.com/AndreHigo/Remote/tree/main/apps/agent" target="_blank" rel="noreferrer">Abrir código do agente de desenvolvimento <ArrowUpRight size={14} /></a>
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

function LoginScreen({ onLogin }: { onLogin: (response: LoginResponse) => void }) {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [message, setMessage] = React.useState("Use suas credenciais para acessar o workspace.");
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
