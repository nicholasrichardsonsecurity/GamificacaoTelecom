import { describe, expect, it, vi } from "vitest";
import { cifrar } from "../crypto";
import { conectorDaIntegracao, criarConector } from "./index";
import { classificarAssunto } from "./ixc";
import { normalizarUrlBase } from "./http";
import { ErroConectorERP } from "./types";

const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status });

describe("conectores de ERP", () => {
  it("normaliza e valida a URL base", () => {
    expect(normalizarUrlBase("https://ixc.exemplo.com.br/")).toBe("https://ixc.exemplo.com.br");
    expect(() => normalizarUrlBase("ftp://x")).toThrow(ErroConectorERP);
    expect(() => normalizarUrlBase("https://u:p@x.com")).toThrow(ErroConectorERP);
    expect(() => normalizarUrlBase("nao é url")).toThrow(ErroConectorERP);
    for (const interno of ["http://localhost:3000", "http://127.0.0.1", "http://10.0.0.5", "http://192.168.1.1", "http://169.254.169.254", "http://172.20.0.1", "http://[::1]"]) {
      expect(() => normalizarUrlBase(interno), interno).toThrow(ErroConectorERP);
    }
    expect(normalizarUrlBase("https://172.32.0.1")).toBe("https://172.32.0.1");
  });

  it("classifica o tipo pelo texto do assunto", () => {
    expect(classificarAssunto("Instalação de fibra")).toBe("INSTALACAO");
    expect(classificarAssunto("Renegociação")).toBe("RENEGOCIACAO");
    expect(classificarAssunto(null)).toBe("SUPORTE");
  });

  it("IXC: autentica por Basic, pagina e normaliza colaboradores e O.S.", async () => {
    const fetchFalso = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url);
      const corpo = JSON.parse(String(init?.body));
      expect((init?.headers as Record<string, string>).Authorization).toBe(
        "Basic " + Buffer.from("7:segredo").toString("base64"),
      );
      if (u.endsWith("/funcionarios")) {
        return json({
          registros: [
            { id: "1", funcionario: "Ana Técnica", email: "ANA@x.com", ativo: "S" },
            { id: "2", funcionario: "Saiu", email: "", ativo: "N" },
            { id: "3", funcionario: "Demitido", email: "d@x.com", ativo: "S", data_demissao: "2026-09-01" },
            { id: "4", funcionario: "Ativo", email: "", ativo: "S", data_demissao: "0000-00-00" },
          ],
        });
      }
      if (u.endsWith("/su_oss_assunto")) return json({ registros: [{ id: "3", assunto: "Instalação de fibra" }] });
      if (u.endsWith("/su_oss_chamado")) {
        return json({
          registros: [
            { id: "10", status: "F", id_cliente: "55", id_tecnico: "1", data_fechamento: "2026-10-20 14:00:00", id_assunto: "3" },
            { id: "11", status: "A", id_cliente: "55", id_tecnico: "1", data_fechamento: "0000-00-00 00:00:00" },
          ],
        });
      }
      expect(corpo.query).toBe("55");
      return json({ registros: [{ id: "55", razao: "Maria", telefone_celular: "81999", email: "M@x.com" }] });
    });
    const c = criarConector("IXC", { urlBase: "https://ixc.x.com", fetch: fetchFalso as unknown as typeof fetch }, {
      token: "7:segredo",
    });
    const colabs = await c.listarColaboradores();
    expect(colabs).toEqual([
      { idExterno: "1", nome: "Ana Técnica", email: "ana@x.com", ativo: true, equipe: null },
      { idExterno: "2", nome: "Saiu", email: null, ativo: false, equipe: null },
      { idExterno: "3", nome: "Demitido", email: "d@x.com", ativo: false, equipe: null },
      { idExterno: "4", nome: "Ativo", email: null, ativo: true, equipe: null },
    ]);
    const os = await c.listarAtendimentosConcluidos(new Date("2026-10-01T00:00:00Z"));
    expect(os).toHaveLength(1);
    expect(os[0]).toMatchObject({
      idExterno: "10",
      tipo: "INSTALACAO",
      colaboradorIdExterno: "1",
      cliente: { idExterno: "55", nome: "Maria", email: "m@x.com" },
    });
  });

  it("erros não vazam credenciais e são do tipo ErroConectorERP", async () => {
    const recusa = (async () => json({}, 401)) as unknown as typeof fetch;
    const c = criarConector("IXC", { urlBase: "https://ixc.x.com", fetch: recusa }, { token: "7:segredo" });
    const erro = await c.testarConexao().catch((e) => e);
    expect(erro).toBeInstanceOf(ErroConectorERP);
    expect(erro.message).not.toContain("segredo");
    const rede = (async () => {
      throw new Error("ECONNREFUSED segredo");
    }) as unknown as typeof fetch;
    const c2 = criarConector("SGP", { urlBase: "https://sgp.x.com", fetch: rede }, { token: "segredo", app: "a" });
    expect((await c2.testarConexao().catch((e) => e)).message).not.toContain("segredo");
  });

  it("SGP: lista técnicos, liga a O.S. ao técnico e busca o contato pelo contrato", async () => {
    const chamadas: string[] = [];
    const f = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url).replace("https://sgp.x.com", "");
      chamadas.push(u);
      const corpo = new URLSearchParams(String(init?.body));
      expect(corpo.get("token")).toBe("t");
      expect(corpo.get("app")).toBe("a");
      expect((init?.headers as Record<string, string>)["Content-Type"]).toBe("application/x-www-form-urlencoded");
      if (u === "/api/ura/tecnicos/") {
        return json([
          { id: 3, username: "joao.s", nome: "João Silva" },
          { id: 4, username: "maria", nome: "Maria Souza" },
        ]);
      }
      if (u === "/api/ura/clientes/") {
        expect(corpo.get("contrato")).toBe("900");
        return json({ clientes: [{ contatos: { celulares: ["81999990000"], emails: ["C@X.com"], telefones: [] } }] });
      }
      expect(u).toBe("/api/ura/ordemservico/list/");
      expect(corpo.get("status")).toBe("1");
      return json({
        paginacao: { offset: 0, limit: 1000, total: 4 },
        ordens_servicos: [
          { id: 5, contrato: 900, cliente: "Cliente Um", responsavel: "João Silva", data_finalizacao: "2026-10-20", hora_finalizacao: "10:00:00", motivo: "Instalação de KIT", servico_password: "NAO-COPIAR" },
          { id: 6, contrato: 900, cliente: "Cliente Um", responsavel: "", usuario_finalizacao: "maria", data_finalizacao: "2026-10-20", hora_finalizacao: "11:00:00", motivo: "Corretiva" },
          { id: 7, contrato: 901, cliente: "Sem Técnico", responsavel: "Ninguém", data_finalizacao: "2026-10-20", hora_finalizacao: "12:00:00", motivo: "Corretiva" },
          { id: 8, contrato: 900, cliente: "Antiga", responsavel: "João Silva", data_finalizacao: "2020-01-01", hora_finalizacao: "12:00:00" },
        ],
      });
    });
    const c = criarConector("SGP", { urlBase: "https://sgp.x.com", fetch: f as unknown as typeof fetch }, { token: "t", app: "a" });
    expect(await c.listarColaboradores()).toEqual([
      { idExterno: "3", nome: "João Silva", email: null, ativo: true, equipe: null },
      { idExterno: "4", nome: "Maria Souza", email: null, ativo: true, equipe: null },
    ]);
    const os = await c.listarAtendimentosConcluidos(new Date("2026-10-01T00:00:00Z"));
    expect(os.map((o) => [o.idExterno, o.colaboradorIdExterno, o.tipo])).toEqual([
      ["5", "3", "INSTALACAO"],
      ["6", "4", "SUPORTE"],
      ["7", null, "SUPORTE"],
    ]);
    expect(os[0].concluidoEm.toISOString()).toBe("2026-10-20T13:00:00.000Z");
    expect(os[0].cliente).toEqual({ idExterno: "contrato-900", nome: "Cliente Um", telefone: "81999990000", email: "c@x.com" });
    expect(JSON.stringify(os)).not.toContain("NAO-COPIAR");
    expect(chamadas.filter((u) => u === "/api/ura/clientes/")).toHaveLength(2); // um por contrato (900 e 901)
  });

  it("conectorDaIntegracao decifra as credenciais e recusa lixo", () => {
    const chave = Buffer.alloc(32, 1).toString("base64");
    vi.stubEnv("CREDENCIAIS_CHAVE", chave);
    const cifrado = cifrar(JSON.stringify({ token: "1:t" }), chave);
    expect(conectorDaIntegracao({ sistema: "IXC", urlBase: "https://x.com", credenciais: cifrado }).sistema).toBe("IXC");
    expect(() =>
      conectorDaIntegracao({ sistema: "IXC", urlBase: "https://x.com", credenciais: "lixo" }),
    ).toThrow(ErroConectorERP);
    vi.unstubAllEnvs();
  });
});
