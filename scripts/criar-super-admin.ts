/**
 * Cria (ou troca a senha de) um SUPER_ADMIN de produção.
 *
 *   npm run criar-super-admin -- --email voce@empresa.com.br --nome "Seu Nome"
 *
 * A senha é pedida no terminal sem aparecer na tela (ou lida de
 * SUPER_ADMIN_SENHA, para automação). Nunca use o seed em produção.
 */
import { createInterface } from "node:readline";
import { parseArgs } from "node:util";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { z } from "zod";

const SENHA_MINIMA = 12;

function perguntarSenha(pergunta: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  const saida = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WriteStream };
  let mostrandoPergunta = true;
  saida._writeToOutput = (s: string) => {
    if (mostrandoPergunta) saida.output.write(s);
  };
  return new Promise((resolve) => {
    rl.question(pergunta, (resposta) => {
      rl.close();
      process.stdout.write("\n");
      resolve(resposta);
    });
    mostrandoPergunta = false;
  });
}

async function main() {
  const { values } = parseArgs({ options: { email: { type: "string" }, nome: { type: "string" } } });
  const email = z.string().trim().toLowerCase().pipe(z.email()).safeParse(values.email);
  if (!email.success) throw new Error("Informe --email com um e-mail válido.");
  const nome = values.nome?.trim() || "Super Admin";

  let senha = process.env.SUPER_ADMIN_SENHA;
  if (!senha) {
    senha = await perguntarSenha("Senha: ");
    if (senha !== (await perguntarSenha("Repita a senha: "))) throw new Error("As senhas não conferem.");
  }
  if (senha.length < SENHA_MINIMA) throw new Error(`A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`);

  const prisma = new PrismaClient();
  try {
    const senhaHash = await bcrypt.hash(senha, 12);
    const existente = await prisma.usuario.findFirst({ where: { tenantId: null, email: email.data } });
    if (existente) {
      await prisma.usuario.update({ where: { id: existente.id }, data: { senhaHash, nome, ativo: true } });
      console.log(`Senha do Super Admin ${email.data} atualizada.`);
    } else {
      await prisma.usuario.create({ data: { nome, email: email.data, senhaHash, role: "SUPER_ADMIN" } });
      console.log(`Super Admin ${email.data} criado.`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((erro) => {
  console.error(erro instanceof Error ? erro.message : erro);
  process.exit(1);
});
