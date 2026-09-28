# Arquitetura

## Decisao de arquitetura inicial

Criar uma plataforma online propria e usar um motor remoto como componente acoplado. No MVP, RustDesk pode ser usado como motor de conexao, ID server e relay. A plataforma propria cuida de usuario, cliente, permissao, inventario, auditoria, comandos e experiencia comercial.

## Componentes

- Web App: painel online para tecnicos, administradores e clientes.
- API: regra de negocio, autenticacao, dispositivos, permissoes e logs.
- Realtime: heartbeats, presenca e eventos de dispositivos.
- Agent: componente instalado no dispositivo remoto.
- Remote Engine: motor de acesso remoto, inicialmente RustDesk ou integracao equivalente.
- Relay/ID Server: sinalizacao e relay de conexao remota.
- Database: dados transacionais.
- Object Storage: gravações, anexos e relatorios exportados.
- Observability: metricas, logs e auditoria interna.

## Fluxo simplificado

```mermaid
flowchart LR
    Tecnico["Tecnico"] --> Web["Painel Web"]
    Web --> API["API Plataforma"]
    API --> DB["PostgreSQL"]
    API --> Realtime["Realtime / WebSocket"]
    Agent["Agente Remoto"] --> Realtime
    Agent --> API
    Web --> Launcher["Launcher / Cliente Remoto"]
    Launcher --> Engine["Motor Remoto"]
    Engine --> ID["ID Server"]
    Engine --> Relay["Relay Server"]
    Agent --> ID
    Agent --> Relay
```

## UML: casos de uso

```mermaid
flowchart TB
    Admin["Administrador"]
    Tecnico["Tecnico"]
    Cliente["Cliente final"]

    UC1(("Cadastrar empresa"))
    UC2(("Convidar tecnico"))
    UC3(("Cadastrar dispositivo"))
    UC4(("Ver dispositivos online"))
    UC5(("Iniciar acesso remoto"))
    UC6(("Executar comando rapido"))
    UC7(("Consultar inventario"))
    UC8(("Auditar acessos"))
    UC9(("Abrir chamado"))
    UC10(("Autorizar acesso assistido"))

    Admin --> UC1
    Admin --> UC2
    Admin --> UC8
    Tecnico --> UC4
    Tecnico --> UC5
    Tecnico --> UC6
    Tecnico --> UC7
    Tecnico --> UC9
    Cliente --> UC10
    Cliente --> UC9
```

## UML: modelo de dominio

```mermaid
classDiagram
    class Organization {
        +uuid id
        +string name
        +string document
        +Plan plan
        +datetime createdAt
    }

    class User {
        +uuid id
        +string name
        +string email
        +UserRole role
        +bool mfaEnabled
    }

    class Customer {
        +uuid id
        +string name
        +string contactName
        +string contactEmail
    }

    class Device {
        +uuid id
        +string displayName
        +string remoteId
        +DeviceStatus status
        +string os
        +datetime lastSeenAt
    }

    class DeviceGroup {
        +uuid id
        +string name
    }

    class RemoteSession {
        +uuid id
        +SessionStatus status
        +datetime startedAt
        +datetime endedAt
        +string reason
    }

    class AuditEvent {
        +uuid id
        +string action
        +string actorIp
        +datetime createdAt
        +json metadata
    }

    class CommandExecution {
        +uuid id
        +string commandType
        +CommandStatus status
        +datetime requestedAt
    }

    class InventorySnapshot {
        +uuid id
        +json hardware
        +json software
        +datetime collectedAt
    }

    Organization "1" --> "*" User
    Organization "1" --> "*" Customer
    Customer "1" --> "*" Device
    DeviceGroup "1" --> "*" Device
    User "1" --> "*" RemoteSession
    Device "1" --> "*" RemoteSession
    Device "1" --> "*" InventorySnapshot
    Device "1" --> "*" CommandExecution
    User "1" --> "*" CommandExecution
    RemoteSession "1" --> "*" AuditEvent
    User "1" --> "*" AuditEvent
```

## UML: sequencia de acesso remoto

```mermaid
sequenceDiagram
    participant T as Tecnico
    participant W as Painel Web
    participant A as API
    participant R as Realtime
    participant E as Motor Remoto
    participant D as Dispositivo

    T->>W: Seleciona dispositivo e solicita acesso
    W->>A: POST /remote-sessions
    A->>A: Valida permissao e politica
    A->>R: Notifica dispositivo
    R->>D: Pedido de acesso
    alt Acesso assistido
        D->>D: Exibe solicitacao ao usuario local
        D->>R: Usuario aceitou
    else Acesso nao assistido
        D->>R: Politica permite acesso
    end
    R->>A: Confirmacao
    A->>W: Retorna token/parametros de conexao
    W->>E: Abre cliente remoto
    E->>D: Estabelece sessao P2P ou relay
    A->>A: Registra auditoria
```

## UML: deployment

```mermaid
flowchart TB
    subgraph Cloud["Cloud Remoto"]
        LB["Load Balancer"]
        Web["Web App"]
        API["API"]
        RT["Realtime"]
        DB[("PostgreSQL")]
        OBJ[("Object Storage")]
        ID["ID Server"]
        RELAY["Relay Server"]
        OBS["Logs e metricas"]
    end

    subgraph Tecnico["Maquina do tecnico"]
        Browser["Browser"]
        Client["Cliente remoto"]
    end

    subgraph Cliente["Dispositivo do cliente"]
        Agent["Agent"]
        Engine["Motor remoto"]
    end

    Browser --> LB
    LB --> Web
    Web --> API
    API --> DB
    API --> OBJ
    API --> RT
    API --> OBS
    Agent --> RT
    Agent --> API
    Client --> ID
    Client --> RELAY
    Engine --> ID
    Engine --> RELAY
```

## APIs iniciais

```text
POST   /auth/login
POST   /auth/mfa/verify
GET    /organizations/current
GET    /customers
POST   /customers
GET    /devices
POST   /devices/register
POST   /devices/:id/heartbeat
GET    /devices/:id
POST   /devices/:id/commands
GET    /devices/:id/inventory
POST   /remote-sessions
GET    /remote-sessions
GET    /audit-events
```

## Decisao RustDesk

Usar RustDesk no MVP nao significa depender dele para sempre.

Opcoes:

1. Integracao externa: usar cliente e servidor RustDesk quase sem modificacao.
2. Fork aberto: modificar com compliance AGPL e publicar alteracoes exigidas.
3. Motor proprio gradual: manter painel proprio e substituir partes do motor remoto com o tempo.

Para produto comercial, a opcao 1 e melhor para validar. A opcao 3 e melhor para independencia no longo prazo.

