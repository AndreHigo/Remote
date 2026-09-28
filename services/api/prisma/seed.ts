import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { hashAgentKey } from "../src/agent-auth.js";
import { hashPassword } from "../src/password.js";

const connectionString =
  process.env.DATABASE_URL ?? "postgresql://remoto:remoto@localhost:55432/remoto?schema=public";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString })
});

async function main() {
  await prisma.auditEvent.deleteMany();
  await prisma.remoteSession.deleteMany();
  await prisma.commandExecution.deleteMany();
  await prisma.inventorySnapshot.deleteMany();
  await prisma.device.deleteMany();
  await prisma.agentEnrollmentKey.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.user.deleteMany();

  const [ownerPassword, technicianPassword, viewerPassword] = await Promise.all([
    hashPassword("remoto123"),
    hashPassword("tecnico123"),
    hashPassword("viewer123")
  ]);

  const owner = await prisma.user.create({
    data: {
      id: "usr_owner_demo",
      name: "Andre Admin",
      email: "admin@remoto.local",
      passwordHash: ownerPassword,
      role: "OWNER"
    }
  });

  await prisma.user.createMany({
    data: [
      {
        id: "usr_tecnico_demo",
        name: "Tecnico Demo",
        email: "tecnico@remoto.local",
        passwordHash: technicianPassword,
        role: "TECHNICIAN"
      },
      {
        id: "usr_viewer_demo",
        name: "Viewer Demo",
        email: "viewer@remoto.local",
        passwordHash: viewerPassword,
        role: "VIEWER"
      }
    ]
  });

  const pequizeiro = await prisma.customer.create({
    data: {
      id: "cus_pequizeiro",
      name: "Pequizeiro Tecnologia",
      document: "00.000.000/0001-00",
      contactName: "Andre Higo",
      contactEmail: "ti@cliente.local"
    }
  });

  const colmeia = await prisma.customer.create({
    data: {
      id: "cus_colmeia",
      name: "Colmeia Operacoes",
      document: "11.111.111/0001-11",
      contactName: "Suporte Local",
      contactEmail: "suporte@cliente.local"
    }
  });

  await prisma.agentEnrollmentKey.create({
    data: {
      id: "agent_key_pequizeiro_demo",
      customerId: pequizeiro.id,
      name: "Pequizeiro Agent Demo",
      keyHash: hashAgentKey("REMOTO-DEMO-AGENT-KEY")
    }
  });

  const financeiro = await prisma.device.create({
    data: {
      id: "dev_financeiro_01",
      customerId: pequizeiro.id,
      displayName: "FINANCEIRO-01",
      remoteId: "782 441 900",
      os: "Windows 11 Pro",
      userName: "financeiro",
      localIp: "192.168.0.24",
      biosSerial: "PEQ-FIN-0001",
      systemUuid: "11111111-1111-4111-8111-111111111111",
      primaryMac: "00:11:22:33:44:55",
      identityHash: "seed-peq-financeiro-01",
      tags: ["financeiro", "critico"],
      lastSeenAt: new Date()
    }
  });

  await prisma.device.createMany({
    data: [
      {
        id: "dev_recepcao_02",
        customerId: pequizeiro.id,
        displayName: "RECEPCAO-02",
        remoteId: "651 339 210",
        os: "Windows 10 Pro",
        userName: "recepcao",
        localIp: "192.168.0.35",
        biosSerial: "PEQ-REC-0002",
        systemUuid: "22222222-2222-4222-8222-222222222222",
        primaryMac: "00:11:22:33:44:66",
        identityHash: "seed-peq-recepcao-02",
        tags: ["atendimento"],
        lastSeenAt: null
      },
      {
        id: "dev_servidor_01",
        customerId: colmeia.id,
        displayName: "SRV-ARQUIVOS-01",
        remoteId: "944 101 118",
        os: "Windows Server 2022",
        userName: "administrator",
        localIp: "10.10.1.8",
        biosSerial: "COL-SRV-0001",
        systemUuid: "33333333-3333-4333-8333-333333333333",
        primaryMac: "00:11:22:33:44:77",
        identityHash: "seed-col-servidor-01",
        tags: ["servidor", "arquivos"],
        lastSeenAt: new Date()
      }
    ]
  });

  await prisma.auditEvent.create({
    data: {
      action: "seed.created",
      actor: owner.name,
      targetId: financeiro.id,
      deviceId: financeiro.id,
      userId: owner.id,
      metadata: { customers: 2, devices: 3 }
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log("Seed concluido.");
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
