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
          ],
        });
      }
      if (u.endsWith("/su_oss_chamado")) {
        return json({
          registros: [
            { id: "10", status: "F", id_cliente: "55", id_tecnico: "1", data_fechamento: "2026-10-20 14:00:00", id_assunto: "Suporte" },
            { id: "11", status: "A", id_cliente: "55", id_tecnico: "1", data_fechamento: "0000-00-00 00:00:00" },
          ],
        });
      }
      expect(corpo.query).toBe("55");
      return json({ registros: [{ id: "55", razao: "Maria", telefone_celular: "81999", email: "M@x.com" }] });
    });
    const c = criarConector("IXC", { urlBase: "https://ixc.x.com", fetch: fetchFalso as unknown as typeof fetch }, {
      usuarioId: "7",
      token: "segredo",
    });
    const colabs = await c.listarColaboradores();
    expect(colabs).toEqual([
      { idExterno: "1", nome: "Ana Técnica", email: "ana@x.com", ativo: true, equipe: null },
      { idExterno: "2", nome: "Saiu", email: null, ativo: false, equipe: null },
    ]);
    const os = await c.listarAtendimentosConcluidos(new Date("2026-10-01T00:00:00Z"));
    expect(os).toHaveLength(1);
    expect(os[0]).toMatchObject({
      idExterno: "10",
      colaboradorIdExterno: "1",
      cliente: { idExterno: "55", nome: "Maria", email: "m@x.com" },
    });
  });

  it("erros não vazam credenciais e são do tipo ErroConectorERP", async () => {
    const recusa = (async () => json({}, 401)) as unknown as typeof fetch;
    const c = criarConector("IXC", { urlBase: "https://ixc.x.com", fetch: recusa }, { usuarioId: "7", token: "segredo" });
    const erro = await c.testarConexao().catch((e) => e);
    expect(erro).toBeInstanceOf(ErroConectorERP);
    expect(erro.message).not.toContain("segredo");
    const rede = (async () => {
      throw new Error("ECONNREFUSED segredo");
    }) as unknown as typeof fetch;
    const c2 = criarConector("SGP", { urlBase: "https://sgp.x.com", fetch: rede }, { token: "segredo", app: "a" });
    expect((await c2.testarConexao().catch((e) => e)).message).not.toContain("segredo");
  });

  it("SGP: lê O.S. concluídas e não expõe colaboradores", async () => {
    const f = (async () =>
      json({
        ordens: [
          { id: 5, cliente_id: 9, cliente_nome: "João", tecnico_id: 3, data_fechamento: "2026-10-20T10:00:00Z", motivo: "Instalação" },
          { id: 6, cliente_id: 9, data_fechamento: "2020-01-01T10:00:00Z" },
        ],
      })) as unknown as typeof fetch;
    const c = criarConector("SGP", { urlBase: "https://sgp.x.com", fetch: f }, { token: "t", app: "a" });
    expect(await c.listarColaboradores()).toBeNull();
    const os = await c.listarAtendimentosConcluidos(new Date("2026-10-01T00:00:00Z"));
    expect(os).toHaveLength(1);
    expect(os[0]).toMatchObject({ idExterno: "5", tipo: "INSTALACAO", colaboradorIdExterno: "3" });
  });

  it("conectorDaIntegracao decifra as credenciais e recusa lixo", () => {
    const chave = Buffer.alloc(32, 1).toString("base64");
    vi.stubEnv("CREDENCIAIS_CHAVE", chave);
    const cifrado = cifrar(JSON.stringify({ usuarioId: "1", token: "t" }), chave);
    expect(conectorDaIntegracao({ sistema: "IXC", urlBase: "https://x.com", credenciais: cifrado }).sistema).toBe("IXC");
    expect(() =>
      conectorDaIntegracao({ sistema: "IXC", urlBase: "https://x.com", credenciais: "lixo" }),
    ).toThrow(ErroConectorERP);
    vi.unstubAllEnvs();
  });
});
