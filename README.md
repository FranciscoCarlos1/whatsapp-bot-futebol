# Bot de WhatsApp – Racha do Futebol

Organiza **mensalidade (R$45)**, **churrasco** e **diária (R$20)** direto no **grupo do WhatsApp**, marcando ✅ quando alguém confirma pagamento e gerando listas.

## Recursos

- Comandos dos usuários:
  - `paguei mensalidade`
  - `paguei churrasco`
  - `paguei diaria`
  - `lista mensal`
  - `lista churrasco`
  - `lista diaria`
  - `minha situacao`
  - `ajuda`

- Comandos para administradores do grupo:
  - `limpar mensal`
  - `limpar churrasco`
  - `limpar diaria`

- Persiste dados por **grupo** em `data/payments.json`.
- Puxa automaticamente os **participantes do grupo** para montar as listas ✅/❌.

## Requisitos

- Node.js 18+  
- WhatsApp instalado no seu celular (mesmo número que fará login no bot)

## Como rodar

```bash
git clone https://github.com/SEU_USUARIO/whatsapp-bot-futebol.git
cd whatsapp-bot-futebol
npm install
npm start
