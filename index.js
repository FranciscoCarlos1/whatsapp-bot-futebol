import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;

import qrcode from "qrcode-terminal";
import fs from "fs-extra";

/**
 * ================================
 *  Configurações
 * ================================
 */

// onde vamos salvar sessões e dados
const DATA_DIR = "./data";
const PAY_FILE = `${DATA_DIR}/payments.json`;

// garante pastas/arquivos
await fs.ensureDir(DATA_DIR);
if (!(await fs.pathExists(PAY_FILE))) {
  await fs.writeJson(PAY_FILE, {}, { spaces: 2 });
}

/**
 * payments schema (por chatId):
 * {
 *   [chatId]: {
 *     updatedAt: "2025-09-05T12:00:00Z",
 *     payments: {
 *       mensalidade: { [participantName]: true },
 *       churrasco:   { [participantName]: true },
 *       diaria:      { [participantName]: true }
 *     }
 *   }
 * }
 */
const db = await fs.readJson(PAY_FILE);

// salva debounced
let saveTimer = null;
const saveDb = () => {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    await fs.writeJson(PAY_FILE, db, { spaces: 2 });
  }, 300);
};

// normaliza texto: minúsculo + sem acento
const normalize = (str = "") =>
  str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

// cria estrutura do grupo se não existir
const ensureChat = (chatId) => {
  if (!db[chatId]) {
    db[chatId] = {
      updatedAt: new Date().toISOString(),
      payments: { mensalidade: {}, churrasco: {}, diaria: {} }
    };
  }
  return db[chatId];
};

// registra pagamento
const markPaid = (chatId, tipo, nome) => {
  const entry = ensureChat(chatId);
  entry.payments[tipo][nome] = true;
  entry.updatedAt = new Date().toISOString();
  saveDb();
};

// zera um tipo
const clearType = (chatId, tipo) => {
  const entry = ensureChat(chatId);
  entry.payments[tipo] = {};
  entry.updatedAt = new Date().toISOString();
  saveDb();
};

// monta lista com todos os participantes do grupo
const buildList = async (client, chat, tipo) => {
  const entry = ensureChat(chat.id._serialized);
  const pagos = entry.payments[tipo] || {};

  // pega participantes atuais do grupo
  const lines = [];
  let idx = 1;
  for (const p of chat.participants) {
    const c = await client.getContactById(p.id._serialized);
    const nome =
      c.pushname ||
      c.name ||
      c.shortName ||
      (c.number ? `+${c.number}` : p.id.user) ||
      "Sem Nome";

    const status = pagos[nome] ? "✅" : "❌";
    lines.push(`${idx}. ${nome} ${status}`);
    idx++;
  }

  const titulo =
    tipo === "mensalidade"
      ? "Mensalidade (R$45,00)"
      : tipo === "churrasco"
      ? "Racha do Churrasco"
      : "Diária (R$20,00)";

  return [
    `📋 Lista ${titulo}`,
    `(Atualizado: ${new Date(entry.updatedAt).toLocaleString()})`,
    "",
    ...lines
  ].join("\n");
};

// situação individual de quem falou
const myStatus = (chatId, nome) => {
  const entry = ensureChat(chatId);
  const { mensalidade, churrasco, diaria } = entry.payments;
  const m = mensalidade[nome] ? "✅" : "❌";
  const c = churrasco[nome] ? "✅" : "❌";
  const d = diaria[nome] ? "✅" : "❌";
  return `👤 ${nome}\nMensalidade: ${m}\nChurrasco: ${c}\nDiária: ${d}`;
};

// ajuda
const helpText = `⚽ Bot do Racha — comandos disponíveis:

• "paguei mensalidade" → registra sua mensalidade ✅
• "paguei churrasco"   → registra seu churrasco ✅
• "paguei diaria"      → registra sua diária ✅

• "lista mensal"       → mostra lista de mensalidade
• "lista churrasco"    → mostra lista do churrasco
• "lista diaria"       → mostra lista da diária

• "minha situacao"     → mostra seus pagamentos
• "limpar mensal" | "limpar churrasco" | "limpar diaria"
  (somente administradores do grupo)

Dica: escreva exatamente as palavras acima.`;

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: "./.wwebjs_auth" }),
  puppeteer: {
    headless: true, // mude para false se quiser ver o navegador
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  }
});

client.on("qr", (qr) => {
  console.log("📱 Escaneie o QR no seu WhatsApp:");
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  console.log("✅ Bot pronto! Já pode adicionar ao grupo.");
});

client.on("message", async (msg) => {
  try {
    const chat = await msg.getChat();

    // só responde em grupo
    if (!chat.isGroup) return;

    const raw = msg.body || "";
    const text = normalize(raw);

    // quem enviou
    const contact = await msg.getContact();
    const nome =
      contact.pushname ||
      contact.name ||
      contact.shortName ||
      (contact.number ? `+${contact.number}` : contact.id.user) ||
      "Sem Nome";

    // checa admin (para comandos de limpar)
    let isAdmin = false;
    try {
      const me = chat.participants.find((p) => p.id._serialized === client.info.wid._serialized);
      isAdmin = me ? me.isAdmin || me.isSuperAdmin : false;
    } catch (_) {}

    // processa comandos
    if (text.includes("paguei mensalidade")) {
      markPaid(chat.id._serialized, "mensalidade", nome);
      await msg.reply(`✅ Registrado: ${nome} pagou MENSALIDADE`);
      return;
    }

    if (text.includes("paguei churrasco")) {
      markPaid(chat.id._serialized, "churrasco", nome);
      await msg.reply(`✅ Registrado: ${nome} pagou CHURRASCO`);
      return;
    }

    if (text.includes("paguei diaria")) {
      markPaid(chat.id._serialized, "diaria", nome);
      await msg.reply(`✅ Registrado: ${nome} pagou DIÁRIA`);
      return;
    }

    if (text.includes("lista mensal")) {
      const out = await buildList(client, chat, "mensalidade");
      await msg.reply(out);
      return;
    }

    if (text.includes("lista churrasco")) {
      const out = await buildList(client, chat, "churrasco");
      await msg.reply(out);
      return;
    }

    if (text.includes("lista diaria")) {
      const out = await buildList(client, chat, "diaria");
      await msg.reply(out);
      return;
    }

    if (text.includes("minha situacao") || text.includes("minha situação")) {
      const out = myStatus(chat.id._serialized, nome);
      await msg.reply(out);
      return;
    }

    if (text.startsWith("limpar ")) {
      if (!isAdmin) {
        await msg.reply("⚠️ Apenas administradores do grupo podem limpar listas.");
        return;
      }
      const qual = text.replace("limpar", "").trim();
      if (qual.includes("mensal")) {
        clearType(chat.id._serialized, "mensalidade");
        await msg.reply("🧹 Lista de MENSALIDADE zerada.");
        return;
      }
      if (qual.includes("churras")) {
        clearType(chat.id._serialized, "churrasco");
        await msg.reply("🧹 Lista de CHURRASCO zerada.");
        return;
      }
      if (qual.includes("diaria")) {
        clearType(chat.id._serialized, "diaria");
        await msg.reply("🧹 Lista de DIÁRIA zerada.");
        return;
      }
      await msg.reply("Use: limpar mensal | limpar churrasco | limpar diaria");
      return;
    }

    // ajuda
    if (text === "ajuda" || text === "help" || text === "menu") {
      await msg.reply(helpText);
      return;
    }
  } catch (err) {
    console.error("Erro ao processar mensagem:", err);
  }
});

client.initialize();

