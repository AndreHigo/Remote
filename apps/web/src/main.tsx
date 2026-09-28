import React from "react";
import ReactDOM from "react-dom/client";
import {
  Activity,
  Ban,
  Copy,
  KeyRound,
  LockKeyhole,
  LogOut,
  Monitor,
  Play,
  RefreshCcw,
  ShieldCheck,
  UserRound,
  Wifi,
  WifiOff
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
  const [statusMessage, setStatusMessage] = React.useState("Carregando painel...");
  const [loading, setLoading] = React.useState(true);

  const selectedDevice = devices.find((device) => device.id === selectedDeviceId) ?? devices[0];
  const latestInventory = inventorySnapshots[0];

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
    if (!token || !canManageKeys) {
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
      })
      .catch(() => {
        if (active) setStatusMessage("Nao foi possivel carregar as chaves do agente");
      });

    return () => {
      active = false;
    };
  }, [canManageKeys, token]);

  React.useEffect(() => {
    if (!token || !selectedDevice?.id) {
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
  }, [selectedDevice?.id, token]);

  async function sendHeartbeat(deviceId: string) {
    setStatusMessage("Enviando heartbeat...");
    await postJson<Device>(`/devices/${deviceId}/heartbeat`, token);
    await refresh();
  }

  async function requestSession(device: Device) {
    setStatusMessage("Registrando solicitacao de acesso...");
    const session = await postJson<RemoteSessionResponse>("/remote-sessions", token, {
      deviceId: device.id,
      reason: "Validacao do MVP"
    });
    if (session.connection?.uri) {
      setStatusMessage("Sessao registrada. Abrindo RustDesk...");
      window.location.assign(session.connection.uri);
      return;
    }
    await refresh();
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

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brandMark">R</span>
          <div>
            <strong>Remoto</strong>
            <small>Console tecnico</small>
          </div>
        </div>

        <nav className="nav">
          <a className="active" href="#dispositivos">
            <Monitor size={18} />
            Dispositivos
          </a>
          <a href="#seguranca">
            <ShieldCheck size={18} />
            Auditoria
          </a>
          <a href="#atividade">
            <Activity size={18} />
            Atividade
          </a>
        </nav>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">MVP 1</p>
            <h1>Dispositivos e presenca</h1>
          </div>
          <div className="topActions">
            <div className="userBadge">
              <UserRound size={16} />
              <span>{user.name}</span>
              <small>{user.role}</small>
            </div>
            <button className="iconButton" type="button" onClick={() => void refresh()} aria-label="Atualizar painel">
              <RefreshCcw size={18} />
            </button>
            <button className="iconButton" type="button" onClick={logout} aria-label="Sair">
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <section className="metrics" aria-label="Resumo da plataforma">
          <Metric label="Clientes" value={summary?.customers ?? 0} />
          <Metric label="Dispositivos" value={summary?.devices ?? 0} />
          <Metric label="Online" value={summary?.onlineDevices ?? 0} tone="good" />
          <Metric label="Offline" value={summary?.offlineDevices ?? 0} tone="muted" />
          <Metric label="Sessoes" value={summary?.sessions ?? 0} />
        </section>

        <section className="contentGrid">
          <section className="panel deviceList" id="dispositivos">
            <div className="panelHeader">
              <div>
                <h2>Maquinas cadastradas</h2>
                <p>{statusMessage}</p>
              </div>
              <span className="syncState">{loading ? "Sincronizando" : "Pronto"}</span>
            </div>

            <div className="table">
              <div className="tableHead">
                <span>Dispositivo</span>
                <span>Cliente</span>
                <span>Status</span>
                <span>Ultimo sinal</span>
                <span>Acoes</span>
              </div>

              {devices.map((device) => (
                <div
                  className={`tableRow ${selectedDevice?.id === device.id ? "selected" : ""}`}
                  key={device.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedDeviceId(device.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") setSelectedDeviceId(device.id);
                  }}
                >
                  <span>
                    <strong>{device.displayName}</strong>
                    <small>{device.os}</small>
                  </span>
                  <span>{device.customerName}</span>
                  <span className={`status ${device.status}`}>
                    {device.status === "online" ? <Wifi size={15} /> : <WifiOff size={15} />}
                    {device.status}
                  </span>
                  <span>{formatSeen(device.secondsSinceLastSeen)}</span>
                  <span className="rowActions">
                    <button
                      className="iconButton compact"
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        void sendHeartbeat(device.id);
                      }}
                      aria-label={`Enviar heartbeat para ${device.displayName}`}
                    >
                      <RefreshCcw size={15} />
                    </button>
                    <button
                      className="primary compact"
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        void requestSession(device);
                      }}
                    >
                      <Play size={15} />
                      Conectar
                    </button>
                  </span>
                </div>
              ))}
            </div>
          </section>

          <aside className="panel detailPanel">
            {selectedDevice ? (
              <>
                <div className="panelHeader">
                  <div>
                    <h2>{selectedDevice.displayName}</h2>
                    <p>ID remoto {selectedDevice.remoteId}</p>
                  </div>
                  <span className={`status ${selectedDevice.status}`}>
                    {selectedDevice.status === "online" ? <Wifi size={15} /> : <WifiOff size={15} />}
                    {selectedDevice.status}
                  </span>
                </div>

                <dl className="details">
                  <div>
                    <dt>Cliente</dt>
                    <dd>{selectedDevice.customerName}</dd>
                  </div>
                  <div>
                    <dt>Usuario</dt>
                    <dd>{selectedDevice.userName}</dd>
                  </div>
                  <div>
                    <dt>IP local</dt>
                    <dd>{selectedDevice.localIp}</dd>
                  </div>
                  <div>
                    <dt>MAC principal</dt>
                    <dd>{selectedDevice.primaryMac ?? "n/a"}</dd>
                  </div>
                  <div>
                    <dt>Serial BIOS</dt>
                    <dd>{selectedDevice.biosSerial ?? "n/a"}</dd>
                  </div>
                  <div>
                    <dt>UUID sistema</dt>
                    <dd>{selectedDevice.systemUuid ?? "n/a"}</dd>
                  </div>
                  <div>
                    <dt>Sistema</dt>
                    <dd>{selectedDevice.os}</dd>
                  </div>
                </dl>

                <div className="tags">
                  {selectedDevice.tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>

                <section className="inventoryBox">
                  <div>
                    <h3>Inventario</h3>
                    <p>
                      {latestInventory
                        ? `Coletado em ${new Date(latestInventory.collectedAt).toLocaleString("pt-BR")}`
                        : "Nenhum inventario coletado ainda."}
                    </p>
                  </div>

                  {latestInventory ? (
                    <dl className="details compactDetails">
                      <div>
                        <dt>CPU</dt>
                        <dd>
                          {latestInventory.hardware.cpu?.count ?? "n/a"}x{" "}
                          {latestInventory.hardware.cpu?.model ?? "desconhecida"}
                        </dd>
                      </div>
                      <div>
                        <dt>Memoria</dt>
                        <dd>
                          {formatBytes(latestInventory.hardware.memory?.freeBytes)} livre de{" "}
                          {formatBytes(latestInventory.hardware.memory?.totalBytes)}
                        </dd>
                      </div>
                      <div>
                        <dt>Discos</dt>
                        <dd>
                          {latestInventory.hardware.disks?.length
                            ? latestInventory.hardware.disks
                                .map(
                                  (disk) =>
                                    `${disk.name ?? disk.mountedAt ?? "disco"} ${formatBytes(disk.freeBytes)} livre`
                                )
                                .join(", ")
                            : "n/a"}
                        </dd>
                      </div>
                      <div>
                        <dt>Runtime</dt>
                        <dd>{latestInventory.software.runtime?.node ?? "n/a"}</dd>
                      </div>
                    </dl>
                  ) : null}
                </section>

                <section className="commandsBox">
                  <div>
                    <h3>Comandos remotos</h3>
                    <p>Fila segura para o agent consultar e executar.</p>
                  </div>

                  <div className="commandButtons">
                    <button className="primary compact" type="button" onClick={() => void requestCommand(selectedDevice, "ping")}>
                      ping
                    </button>
                    <button
                      className="primary compact"
                      type="button"
                      onClick={() => void requestCommand(selectedDevice, "system-info")}
                    >
                      system-info
                    </button>
                    <button
                      className="primary compact"
                      type="button"
                      onClick={() => void requestCommand(selectedDevice, "refresh-inventory")}
                    >
                      refresh
                    </button>
                  </div>

                  {commands.length === 0 ? (
                    <p className="empty">Nenhum comando para este dispositivo.</p>
                  ) : (
                    <ul className="commandList">
                      {commands.slice(0, 5).map((item) => (
                        <li key={item.id}>
                          <strong>{item.commandType}</strong>
                          <span className={`commandStatus ${item.status}`}>{item.status}</span>
                          <small>{new Date(item.requestedAt).toLocaleString("pt-BR")}</small>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </>
            ) : (
              <p>Nenhum dispositivo cadastrado.</p>
            )}
          </aside>
        </section>

        {canManageKeys ? (
          <section className="panel keyPanel" id="seguranca">
            <div className="panelHeader">
              <div>
                <h2>Chaves dos agentes</h2>
                <p>Crie uma chave por cliente e revogue acessos antigos.</p>
              </div>
              <KeyRound size={20} />
            </div>

            <div className="keyForm">
              <label>
                <span>Cliente</span>
                <select value={newKeyCustomerId} onChange={(event) => setNewKeyCustomerId(event.target.value)}>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Nome da chave</span>
                <input value={newKeyName} onChange={(event) => setNewKeyName(event.target.value)} placeholder="Notebook suporte" />
              </label>
              <button className="primary compact" type="button" onClick={() => void createAgentKey()}>
                <KeyRound size={15} />
                Criar chave
              </button>
            </div>

            {revealedAgentKey ? (
              <div className="keyReveal" role="status">
                <strong>Copie esta chave agora</strong>
                <code>{revealedAgentKey}</code>
                <button className="iconButton compact" type="button" onClick={() => void copyAgentKey()} aria-label="Copiar chave">
                  <Copy size={15} />
                </button>
              </div>
            ) : null}

            <ul className="keyList">
              {agentKeys.map((key) => (
                <li key={key.id}>
                  <span>
                    <strong>{key.name}</strong>
                    <small>{key.customerName}</small>
                  </span>
                  <span className={`commandStatus ${key.active ? "succeeded" : "failed"}`}>
                    {key.active ? "ativa" : "revogada"}
                  </span>
                  {key.active ? (
                    <button className="iconButton compact" type="button" onClick={() => void revokeAgentKey(key)} aria-label={`Revogar ${key.name}`}>
                      <Ban size={15} />
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>

            <div className="securityDivider">
              <div className="panelHeader compactHeader">
                <div>
                  <h2>Autenticacao em dois fatores</h2>
                  <p>{twoFactorStatus.enabled ? "Ativa para este usuario." : "Proteja a conta administrativa com TOTP."}</p>
                </div>
                <ShieldCheck size={20} />
              </div>

              {twoFactorSetup ? (
                <div className="keyReveal twoFactorReveal" role="status">
                  <strong>Segredo temporario</strong>
                  <code>{twoFactorSetup.secret}</code>
                  <small>{twoFactorSetup.otpauthUri}</small>
                </div>
              ) : null}

              <div className="keyForm twoFactorForm">
                <label>
                  <span>Codigo do autenticador</span>
                  <input
                    value={twoFactorCode}
                    onChange={(event) => setTwoFactorCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="000000"
                  />
                </label>
                {!twoFactorStatus.enabled ? (
                  <>
                    <button className="secondary compact" type="button" onClick={() => void prepareTwoFactor()}>
                      <ShieldCheck size={15} />
                      Preparar 2FA
                    </button>
                    <button className="primary compact" type="button" onClick={() => void enableTwoFactor()} disabled={!twoFactorSetup}>
                      Ativar 2FA
                    </button>
                  </>
                ) : (
                  <button className="secondary compact" type="button" onClick={() => void disableTwoFactor()}>
                    <Ban size={15} />
                    Desativar 2FA
                  </button>
                )}
              </div>
              {twoFactorMessage ? <small className="securityMessage">{twoFactorMessage}</small> : null}
            </div>
          </section>
        ) : null}

        <section className="panel auditPanel" id="atividade">
          <div className="panelHeader">
            <div>
              <h2>Atividade recente</h2>
              <p>Eventos gerados pela API do MVP.</p>
            </div>
          </div>

          {auditEvents.length === 0 ? (
            <p className="empty">Sem eventos ainda. Envie um heartbeat ou solicite uma conexao.</p>
          ) : (
            <ul className="auditList">
              {auditEvents.map((event) => (
                <li key={event.id}>
                  <strong>{event.action}</strong>
                  <span>{event.actor}</span>
                  <time>{new Date(event.createdAt).toLocaleString("pt-BR")}</time>
                </li>
              ))}
            </ul>
          )}
        </section>
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
  const [email, setEmail] = React.useState("admin@remoto.local");
  const [password, setPassword] = React.useState("remoto123");
  const [message, setMessage] = React.useState("Entre com o usuario seed para acessar o console.");
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
        <div className="brand loginBrand">
          <span className="brandMark">R</span>
          <div>
            <strong>Remoto</strong>
            <small>Console tecnico</small>
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

          <div className="demoUsers">
            <strong>Seed local</strong>
            <span>admin@remoto.local / remoto123</span>
            <span>tecnico@remoto.local / tecnico123</span>
            <span>viewer@remoto.local / viewer123</span>
          </div>
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
