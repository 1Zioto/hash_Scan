'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

const TOTAL_BLOCKS = 92_233_720_368
const MULTIPLIER   = 50_000_000
const BASE_HEX     = BigInt('0x4000000000000000')

type Agent = {
  name: string
  speed: number
  status: 'working' | 'idle' | 'offline'
  currentBlock: number
  lastSeen: number
}

type DashboardData = {
  agents: Agent[]
  usedCount: number
  totalBlocks: number
  progress: number
  recentCompletions: { block: number; agent: string }[]
}

function blockToHex(i: number): string {
  const val = BASE_HEX + BigInt(i) * BigInt(MULTIPLIER)
  return '0x' + val.toString(16).toUpperCase().padStart(16, '0')
}

function formatSpeed(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M/s`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K/s`
  return `${n}/s`
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60)   return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m`
  return `${Math.floor(s / 3600)}h`
}

function formatBig(n: number): string {
  return n.toLocaleString('pt-BR')
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [now, setNow] = useState(Date.now())
  const intervalRef = useRef<NodeJS.Timeout>()

  const fetchData = useCallback(async () => {
    try {
      const r = await fetch('/api/agent')
      const d = await r.json()
      setData(d)
      setNow(Date.now())
    } catch {}
  }, [])

  useEffect(() => {
    fetchData()
    intervalRef.current = setInterval(fetchData, 2000)
    return () => clearInterval(intervalRef.current)
  }, [fetchData])

  const online  = (data?.agents ?? []).filter(a => a.status !== 'offline')
  const offline = (data?.agents ?? []).filter(a => a.status === 'offline')
  const totalSpeed = online.reduce((s, a) => s + a.speed, 0)
  const used = data?.usedCount ?? 0
  const pct  = data ? (data.progress * 100).toFixed(6) : '0.000000'

  return (
    <div className="root">
      <header>
        <div className="brand">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <polygon points="14,2 26,8 26,20 14,26 2,20 2,8" stroke="#00e5ff" strokeWidth="1.5" fill="none" opacity="0.8"/>
            <polygon points="14,7 21,11 21,17 14,21 7,17 7,11" fill="#00e5ff" opacity="0.15"/>
            <circle cx="14" cy="14" r="3" fill="#00e5ff"/>
          </svg>
          <div>
            <div className="brand-name">HASHSCAN</div>
            <div className="brand-sub">distributed block processor</div>
          </div>
        </div>
        <div className="header-stats">
          <div className="hs">
            <div className="hs-val">{online.length}</div>
            <div className="hs-lbl">agentes</div>
          </div>
          <div className="hs">
            <div className="hs-val">{formatSpeed(totalSpeed)}</div>
            <div className="hs-lbl">velocidade total</div>
          </div>
          <div className="hs">
            <div className="hs-val accent">{pct}%</div>
            <div className="hs-lbl">progresso</div>
          </div>
          <div className="hs">
            <div className="hs-val">{formatBig(used)}</div>
            <div className="hs-lbl">blocos usados</div>
          </div>
          <div className="hs">
            <div className="hs-val dim">{formatBig(TOTAL_BLOCKS)}</div>
            <div className="hs-lbl">total de blocos</div>
          </div>
        </div>
      </header>

      {/* Progress bar */}
      <div className="prog-wrap">
        <div className="prog-track">
          <div className="prog-fill" style={{ width: `${Math.min(data?.progress ?? 0, 1) * 100}%` }} />
        </div>
        <div className="prog-labels">
          <span className="mono dim">0x4000000000000000</span>
          <span className="mono dim">0x7FFFFFFFFFFFFFFF</span>
        </div>
      </div>

      <div className="layout">
        {/* Agents */}
        <section className="panel agents-panel">
          <div className="panel-title">AGENTES ONLINE <span className="badge">{online.length}</span></div>
          <div className="agents-list">
            {online.length === 0 && <div className="empty">nenhum agente conectado</div>}
            {online.map(agent => (
              <div key={agent.name} className={`agent-card ${agent.status}`}>
                <div className="agent-row1">
                  <div className="agent-left">
                    <span className={`dot dot-${agent.status}`} />
                    <span className="agent-name">{agent.name}</span>
                  </div>
                  <span className={`tag tag-${agent.status}`}>{agent.status}</span>
                </div>
                <div className="agent-row2">
                  <div className="meta-item">
                    <div className="meta-lbl">velocidade</div>
                    <div className="meta-val">{formatSpeed(agent.speed)}</div>
                  </div>
                  <div className="meta-item">
                    <div className="meta-lbl">bloco atual</div>
                    <div className="meta-val mono">#{agent.currentBlock.toLocaleString('pt-BR')}</div>
                  </div>
                  <div className="meta-item">
                    <div className="meta-lbl">visto</div>
                    <div className="meta-val">{timeAgo(agent.lastSeen)}</div>
                  </div>
                </div>
                <div className="agent-hex mono">{blockToHex(agent.currentBlock)}</div>
              </div>
            ))}
          </div>

          {offline.length > 0 && (
            <>
              <div className="panel-title mt">OFFLINE <span className="badge dim">{offline.length}</span></div>
              <div className="agents-list">
                {offline.map(agent => (
                  <div key={agent.name} className="agent-card offline">
                    <div className="agent-row1">
                      <div className="agent-left">
                        <span className="dot dot-offline" />
                        <span className="agent-name dim">{agent.name}</span>
                      </div>
                      <span className="tag tag-offline">{timeAgo(agent.lastSeen)} atrás</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        {/* Recent completions */}
        <section className="panel recent-panel">
          <div className="panel-title">BLOCOS RECENTES</div>
          <div className="recent-list">
            {(data?.recentCompletions ?? []).length === 0 && (
              <div className="empty">nenhum bloco concluído ainda</div>
            )}
            {(data?.recentCompletions ?? []).map((r, i) => (
              <div key={i} className="recent-row">
                <div className="recent-num">#{r.block.toLocaleString('pt-BR')}</div>
                <div className="recent-hex mono">{blockToHex(r.block)}</div>
                <div className="recent-agent">{r.agent}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Stats */}
        <section className="panel stats-panel">
          <div className="panel-title">ESTATÍSTICAS</div>
          <div className="stats-grid">
            <div className="stat-box">
              <div className="stat-val">{formatBig(used)}</div>
              <div className="stat-lbl">blocos processados</div>
            </div>
            <div className="stat-box">
              <div className="stat-val">{formatBig(TOTAL_BLOCKS - used)}</div>
              <div className="stat-lbl">blocos restantes</div>
            </div>
            <div className="stat-box">
              <div className="stat-val accent">{pct}%</div>
              <div className="stat-lbl">cobertura do espaço</div>
            </div>
            <div className="stat-box">
              <div className="stat-val">{formatSpeed(totalSpeed)}</div>
              <div className="stat-lbl">throughput combinado</div>
            </div>
          </div>

          <div className="range-info">
            <div className="range-row">
              <span className="range-lbl">início</span>
              <span className="mono range-val">0x4000000000000000</span>
            </div>
            <div className="range-row">
              <span className="range-lbl">fim</span>
              <span className="mono range-val">0x7FFFFFFFFFFFFFFF</span>
            </div>
            <div className="range-row">
              <span className="range-lbl">tamanho do bloco</span>
              <span className="mono range-val">× 50.000.000</span>
            </div>
            <div className="range-row">
              <span className="range-lbl">total de blocos</span>
              <span className="mono range-val">{formatBig(TOTAL_BLOCKS)}</span>
            </div>
          </div>
        </section>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Syne:wght@400;600;700;800&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .root {
          min-height: 100vh;
          background: #050810;
          color: #8ba4b8;
          font-family: 'Syne', sans-serif;
          font-size: 14px;
        }

        header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 28px;
          border-bottom: 1px solid rgba(0,229,255,0.08);
          background: rgba(5,8,16,0.9);
          backdrop-filter: blur(12px);
          position: sticky; top: 0; z-index: 10;
        }

        .brand { display: flex; align-items: center; gap: 12px; }
        .brand-name {
          font-size: 18px; font-weight: 800; letter-spacing: 5px;
          color: #fff; line-height: 1;
        }
        .brand-sub { font-size: 10px; letter-spacing: 2px; color: #2a4455; margin-top: 2px; }

        .header-stats { display: flex; gap: 28px; }
        .hs { text-align: right; }
        .hs-val {
          font-size: 18px; font-weight: 700; color: #c8dce8;
          font-family: 'IBM Plex Mono', monospace; line-height: 1.1;
        }
        .hs-val.accent { color: #00e5ff; }
        .hs-val.dim { color: #2a4455; }
        .hs-lbl { font-size: 10px; letter-spacing: 1.5px; color: #2a4455; text-transform: uppercase; }

        .prog-wrap { padding: 12px 28px 0; }
        .prog-track {
          height: 3px; background: rgba(255,255,255,0.05); border-radius: 2px; overflow: hidden;
          margin-bottom: 5px;
        }
        .prog-fill {
          height: 100%;
          background: linear-gradient(90deg, #0040ff, #00e5ff);
          border-radius: 2px;
          transition: width 1s ease;
          box-shadow: 0 0 10px rgba(0,229,255,0.4);
          min-width: 2px;
        }
        .prog-labels {
          display: flex; justify-content: space-between;
          font-size: 10px;
        }

        .layout {
          display: grid;
          grid-template-columns: 1fr 1fr;
          grid-template-rows: auto auto;
          gap: 16px;
          padding: 16px 28px;
        }

        .panel {
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 8px;
          padding: 16px;
        }

        .agents-panel { grid-row: 1 / 3; }
        .stats-panel  { grid-column: 2; }

        .panel-title {
          font-size: 10px; font-weight: 700; letter-spacing: 3px;
          color: #2a4455; text-transform: uppercase;
          border-left: 2px solid #00e5ff; padding-left: 8px;
          margin-bottom: 12px; display: flex; align-items: center; gap: 8px;
        }
        .panel-title.mt { margin-top: 20px; }

        .badge {
          background: rgba(0,229,255,0.1); color: #00e5ff;
          font-size: 10px; padding: 1px 6px; border-radius: 3px;
          border: 1px solid rgba(0,229,255,0.2);
        }
        .badge.dim { background: rgba(255,255,255,0.04); color: #2a4455; border-color: rgba(255,255,255,0.06); }

        .agents-list { display: flex; flex-direction: column; gap: 8px; }

        .agent-card {
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 6px; padding: 10px 12px;
          background: rgba(255,255,255,0.02);
        }
        .agent-card.working { border-color: rgba(0,229,255,0.2); }
        .agent-card.offline { opacity: 0.4; }

        .agent-row1 {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 8px;
        }
        .agent-left { display: flex; align-items: center; gap: 8px; }

        .dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
        .dot-working { background: #00e5ff; box-shadow: 0 0 8px #00e5ff; animation: pulse 1.5s ease-in-out infinite; }
        .dot-idle    { background: #446688; }
        .dot-offline { background: #1a2a38; }

        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }

        .agent-name { font-size: 13px; color: #c8dce8; font-family: 'IBM Plex Mono', monospace; }
        .agent-name.dim { color: #2a4455; }

        .tag {
          font-size: 9px; font-weight: 600; letter-spacing: 1.5px;
          text-transform: uppercase; padding: 2px 7px; border-radius: 3px;
        }
        .tag-working { background: rgba(0,229,255,0.08); color: #00e5ff; border: 1px solid rgba(0,229,255,0.2); }
        .tag-idle    { background: rgba(255,255,255,0.04); color: #4a6070; border: 1px solid rgba(255,255,255,0.06); }
        .tag-offline { background: transparent; color: #2a3a48; border: none; font-size: 10px; letter-spacing: 0; }

        .agent-row2 {
          display: grid; grid-template-columns: 1fr 1fr 1fr;
          gap: 4px; margin-bottom: 7px;
        }
        .meta-item { display: flex; flex-direction: column; }
        .meta-lbl { font-size: 9px; color: #1a3040; text-transform: uppercase; letter-spacing: 1px; }
        .meta-val { font-size: 12px; color: #6a8898; font-weight: 600; }
        .meta-val.mono { font-family: 'IBM Plex Mono', monospace; font-size: 11px; }

        .agent-hex {
          font-size: 10px; color: #1a3040; letter-spacing: 1px;
          border-top: 1px solid rgba(255,255,255,0.04); padding-top: 6px;
        }

        .recent-list { display: flex; flex-direction: column; gap: 4px; max-height: 260px; overflow-y: auto; }
        .recent-row {
          display: grid; grid-template-columns: 100px 1fr auto;
          align-items: center; gap: 8px;
          padding: 6px 8px; border-radius: 4px;
          background: rgba(255,255,255,0.02);
          font-size: 11px;
        }
        .recent-num { font-family: 'IBM Plex Mono', monospace; color: #00e5ff; }
        .recent-hex { font-family: 'IBM Plex Mono', monospace; color: #1a3040; font-size: 10px; }
        .recent-agent { color: #2a4455; font-size: 10px; text-align: right; }

        .stats-grid {
          display: grid; grid-template-columns: 1fr 1fr;
          gap: 8px; margin-bottom: 16px;
        }
        .stat-box {
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.04);
          border-radius: 6px; padding: 12px;
        }
        .stat-val {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 15px; font-weight: 500; color: #8aa4b8;
          margin-bottom: 3px;
        }
        .stat-val.accent { color: #00e5ff; }
        .stat-lbl { font-size: 10px; color: #1a3040; text-transform: uppercase; letter-spacing: 1px; }

        .range-info { display: flex; flex-direction: column; gap: 6px; }
        .range-row { display: flex; justify-content: space-between; align-items: center; }
        .range-lbl { font-size: 11px; color: #1a3040; }
        .range-val { font-size: 11px; color: #2a5060; }

        .mono { font-family: 'IBM Plex Mono', monospace; }
        .dim  { color: #2a4455; }
        .empty { color: #1a3040; font-size: 12px; text-align: center; padding: 20px; }

        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(0,229,255,0.15); border-radius: 2px; }

        @media (max-width: 900px) {
          .layout { grid-template-columns: 1fr; }
          .agents-panel { grid-row: auto; }
          .header-stats { gap: 14px; }
        }
      `}</style>
    </div>
  )
}
