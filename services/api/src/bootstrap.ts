import "dotenv/config";
import { prisma } from "./db.js";
import { hashPassword } from "./password.js";

const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
const name = process.env.BOOTSTRAP_ADMIN_NAME?.trim();

if (!email || !password || !name) {
  throw new Error("BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_PASSWORD e BOOTSTRAP_ADMIN_NAME sao obrigatorios");
}

if (password.length < 12) {
  throw new Error("BOOTSTRAP_ADMIN_PASSWORD deve ter pelo menos 12 caracteres");
}

try {
  const current = await prisma.user.findUnique({ where: { email } });
  if (current) {
    if (current.role !== "OWNER" || !current.active) {
      throw new Error("O usuario de bootstrap existe, mas nao e um owner ativo");
    }
    console.log(`Usuario owner ja existe: ${email}`);
  } else {
    await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: await hashPassword(password),
        role: "OWNER"
      }
    });
    console.log(`Usuario owner criado: ${email}`);
  }
} finally {
  await prisma.$disconnect();
}
