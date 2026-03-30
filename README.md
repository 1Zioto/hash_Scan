# HashScan — Distributed Range Processor

Monitor visual de agentes distribuídos processando o intervalo hexadecimal
`0x4000000000000000 → 0x7FFFFFFFFFFFFFFF` em blocos de 50.000.000 valores.

---

## 🚀 Deploy na Vercel (passo a passo)

### 1. Criar repositório no GitHub

```bash
cd hashscan
git init
git add .
git commit -m "initial"
gh repo create hashscan --public --push --source=.
```

### 2. Criar projeto na Vercel

1. Acesse https://vercel.com/new
2. Importe o repositório `hashscan`
3. Framework: **Next.js** (detectado automaticamente)
4. Clique em **Deploy**

### 3. Adicionar Vercel KV (Redis)

1. No painel do projeto Vercel → aba **Storage**
2. Clique **Create Database** → escolha **KV**
3. Nome: `hashscan-kv` → Create
4. Clique em **Connect to Project** → selecione seu projeto
5. As variáveis de ambiente são adicionadas automaticamente:
   - `KV_URL`
   - `KV_REST_API_URL`
   - `KV_REST_API_TOKEN`
   - `KV_REST_API_READ_ONLY_TOKEN`

6. Redeploy o projeto para aplicar as variáveis:
   ```
   Vercel Dashboard → Deployments → ⋯ → Redeploy
   ```

### 4. Pronto! 🎉

Acesse `https://seu-projeto.vercel.app` para ver o dashboard.

---

## 🤖 Rodando um Agente

### Requisitos
```bash
pip install requests
```

### Iniciar agente
```bash
# Básico (usa o hostname do PC como nome)
python agent.py --server https://seu-projeto.vercel.app

# Com velocidade declarada (em hashes/segundo)
python agent.py --server https://seu-projeto.vercel.app --speed 2000000

# Com nome customizado
python agent.py --server https://seu-projeto.vercel.app --name "maquina-02" --speed 5000000
```

---

## 📡 API

### `POST /api/agent`

| action | descrição |
|--------|-----------|
| `connect` | Registra agente e recebe primeiro bloco |
| `heartbeat` | Atualiza status e velocidade |
| `submit` | Envia bloco concluído e recebe próximo |
| `disconnect` | Desconecta e libera bloco atual |

**Payload connect/heartbeat/submit:**
```json
{
  "action": "connect",
  "agentName": "minha-maquina",
  "speed": 1000000,
  "completedBlock": 42
}
```

**Resposta:**
```json
{
  "block": 43,
  "totalBlocks": 1844
}
```

### `GET /api/agent`

Retorna dados completos do dashboard:
```json
{
  "agents": [...],
  "completed": [0, 1, 2, ...],
  "inProgress": [43],
  "recentCompletions": [...],
  "totalBlocks": 1844,
  "progress": 0.023
}
```

---

## 🔢 Lógica dos Blocos

```
Total de blocos = (0x7FFFFFFFFFFFFFFF - 0x4000000000000000+ 1) / 50_000_000
               = 1844 blocos

Bloco #i representa o intervalo:
  início = 0x4000000000000000 + (i × 50_000_000)
  fim    = início + 50_000_000 - 1

Ex: Bloco #0 → 0x4000000000000000 ... 0x40000002FAF07FFF
    Bloco #1 → 0x40000002FAF08000 ... 0x40000005F5E0FFFF
```

---

## 🛠 Desenvolvimento local

```bash
npm install

# Precisa de um KV local — use Upstash ou configure um .env.local:
# KV_REST_API_URL=https://...
# KV_REST_API_TOKEN=...

npm run dev
```
