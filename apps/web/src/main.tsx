import React from "react";
import ReactDOM from "react-dom/client";
import {
  Activity,
  Archive,
  ArrowRightLeft,
  ArrowUpRight,
  Ban,
  ChevronRight,
  Copy,
  KeyRound,
  LockKeyhole,
  LogOut,
  Monitor,
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

interface RemoteSession {
  id: string;
  deviceId: string;
  deviceName: string;
  customerName: string;
  remoteId: string;
  technicianName: string;
  reason: string;
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
  const payload = (await response.json().catch(() => ({}))) as { message?: string };
  if (!response.ok) throw new Error(payload.message ?? `Falha na API: ${response.status}`);
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

  const payload = (await response.json().catch(() => ({}))) as { message?: string } & T;
  if (!response.ok) throw new Error(payload.message ?? `Falha na API: ${response.status}`);
  return payload as T;
}

async function patchJson<T>(path: string, token: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body)
  });

  const payload = (await response.json().catch(() => ({}))) as { message?: string } & T;
  if (!response.ok) throw new Error(payload.message ?? `Falha na API: ${response.status}`);
  return payload as T;
}

async function deleteJson<T>(path: string, token: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: "DELETE",
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined
  });

  const payload = (await response.json().catch(() => ({}))) as { message?: string } & T;
  if (!response.ok) throw new Error(payload.message ?? `Falha na API: ${response.status}`);
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
    setSessions([]);
    setArchivedDevices([]);
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
      getJson<ManagedUser[]>("/users", token),
      getJson<Device[]>("/devices/archived", token),
      getJson<TwoFactorStatus>("/auth/2fa/status", token)
    ])
      .then(([nextCustomers, nextKeys, nextUsers, nextArchivedDevices, nextTwoFactorStatus]) => {
        if (!active) return;
        setCustomers(nextCustomers);
        setAgentKeys(nextKeys);
        setManagedUsers(nextUsers);
        setArchivedDevices(nextArchivedDevices);
        setTwoFactorStatus(nextTwoFactorStatus);
        setNewKeyCustomerId((current) => current || nextCustomers[0]?.id || "");
        setOnboardingCustomerId((current) => current || nextCustomers[0]?.id || "");
      })
      .catch(() => {
        if (active) setStatusMessage("Nao foi possivel carregar a administracao");
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
      await refresh();
      if (approved.connection?.uri) window.location.assign(approved.connection.uri);
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
    if (!window.confirm(`Mover ${device.displayName} de ${device.customerName} para ${target.name}? O agente precisara usar uma chave do novo cliente.`)) return;

    try {
      await patchJson<Device>(`/devices/${device.id}/customer`, token, { customerId: target.id });
      await refresh();
      setStatusMessage(`${device.displayName} movido para ${target.name}`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Nao foi possivel mover o dispositivo");
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
    onApproveRemoteSession={(session) => void approveRemoteSession(session)}
    onDenyRemoteSession={(session) => void denyRemoteSession(session)}
    onEndRemoteSession={(session) => void endRemoteSession(session)}
    onMoveDevice={(device, customerId) => void moveDevice(device, customerId)}
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
  onApproveRemoteSession: (session: RemoteSession) => void;
  onDenyRemoteSession: (session: RemoteSession) => void;
  onEndRemoteSession: (session: RemoteSession) => void;
  onMoveDevice: (device: Device, customerId: string) => void;
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

  const [moveCustomerId, setMoveCustomerId] = React.useState(selectedDevice?.customerId ?? "");
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

                    {canManageKeys ? <section className="subsection deviceAdminBox">
                      <div className="subsectionHeader"><div><h3>Administrar dispositivo</h3><p>Mova ou remova este computador do workspace.</p></div><ArrowRightLeft size={17} /></div>
                      <div className="deviceAdminActions">
                        <label><span>Cliente responsavel</span><select value={moveCustomerId} onChange={(event) => setMoveCustomerId(event.target.value)}>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>
                        <button className="secondary compact" type="button" onClick={() => onMoveDevice(selectedDevice, moveCustomerId)} disabled={!moveCustomerId || moveCustomerId === selectedDevice.customerId}><ArrowRightLeft size={14} />Mover</button>
                        <button className="secondary compact" type="button" onClick={() => onArchiveDevice(selectedDevice)}><Archive size={14} />Arquivar</button>
                        <button className="danger compact" type="button" onClick={() => onDeleteDevice(selectedDevice)}><Trash2 size={14} />Excluir definitivo</button>
                      </div>
                    </section> : null}

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
                <span><strong>{managedUser.name}</strong><small>{managedUser.email} / {managedUser.role} / 2FA {managedUser.twoFactorEnabled ? "ativo" : "pendente"}</small></span>
                <span className={`commandStatus ${managedUser.active ? "succeeded" : "failed"}`}>{managedUser.active ? "Ativo" : "Bloqueado"}</span>
                <span className="customerActions"><button className="secondary compact" type="button" onClick={() => onResetManagedUserPassword(managedUser)}>Redefinir senha</button><button className="iconButton compact" type="button" onClick={() => onToggleManagedUser(managedUser)} disabled={managedUser.id === user.id} aria-label={`${managedUser.active ? "Bloquear" : "Ativar"} ${managedUser.name}`} title={managedUser.active ? "Bloquear usuario" : "Ativar usuario"}>{managedUser.active ? <Ban size={15} /> : <ShieldCheck size={15} />}</button></span>
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

        {activeSection === "activity" ? <section className="activityView">
          <section className="panel sessionPanel"><div className="panelHeader"><div><p className="eyebrow">Controle de acesso</p><h2>Sessoes remotas</h2><p>Solicitacoes precisam de aprovacao antes de abrir o RustDesk.</p></div><Play size={20} /></div>{sessions.length === 0 ? <div className="emptyState"><Play size={24} /><strong>Sem sessoes registradas</strong><span>Os pedidos de acesso aparecerao aqui.</span></div> : <ul className="sessionList">{sessions.map((session) => <li key={session.id}><div><strong>{session.deviceName}</strong><span>{session.customerName} / {session.technicianName} / {session.reason}</span><small>{new Date(session.requestedAt).toLocaleString("pt-BR")}</small></div><span className={`commandStatus ${session.status === "approved" ? "succeeded" : session.status === "denied" ? "failed" : ""}`}>{session.status}</span><span className="sessionActions">{canManageKeys && session.status === "requested" ? <><button className="primary compact" type="button" onClick={() => onApproveRemoteSession(session)}><Play size={14} />Aprovar</button><button className="danger compact" type="button" onClick={() => onDenyRemoteSession(session)}><Ban size={14} />Negar</button></> : null}{session.status === "approved" ? <button className="secondary compact" type="button" onClick={() => onEndRemoteSession(session)}>Encerrar</button> : null}</span></li>)}</ul>}</section>
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
              <label className="reasonField"><span>Motivo do acesso</span><textarea value={connectReason} onChange={(event) => onConnectReasonChange(event.target.value)} rows={3} placeholder="Ex.: validar falha no caixa" autoFocus /></label>
              <p className="modalNote">A solicitacao sera registrada na atividade e abrira o cliente RustDesk quando autorizada.</p>
              <div className="modalActions"><button className="secondary" type="button" onClick={onCloseConnection}>Cancelar</button><button className="primary" type="button" onClick={onConfirmConnection} disabled={connectionLoading || connectReason.trim().length < 4}><Play size={16} />{connectionLoading ? "Registrando..." : "Solicitar acesso"}</button></div>
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
