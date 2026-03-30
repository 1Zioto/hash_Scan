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
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M/s`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K/s`
  return `${n}/s`
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60)   return `${s}s atrás`
  if (s < 3600) return `${Math.floor(s / 60)}m atrás`
  return `${Math.floor(s / 3600)}h atrás`
}

function fmt(n: number): string {
  return n.toLocaleString('pt-BR')
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const intervalRef = useRef<NodeJS.Timeout>()

  const fetchData = useCallback(async () => {
    try {
      const r = await fetch('/api/agent')
      setData(await r.json())
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
  const pct  = data ? (data.progress * 100).toFixed(8) : '0.00000000'
  const progressWidth = Math.max(data?.progress ?? 0, 0.0001) * 100

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          background: #f0f2f7;
          font-family: 'Outfit', sans-serif;
          color: #1a1f2e;
          min-height: 100vh;
        }

        .app {
          min-height: 100vh;
          background: linear-gradient(135deg, #f0f2f7 0%, #e8ecf5 100%);
        }

        /* ── HEADER ── */
        .header {
          background: #fff;
          border-bottom: 1px solid #e2e6ef;
          padding: 0 32px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 68px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.06);
          position: sticky; top: 0; z-index: 100;
        }

        .logo {
          display: flex; align-items: center; gap: 12px;
        }
        .logo-icon {
          width: 38px; height: 38px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          font-size: 18px;
          box-shadow: 0 4px 12px rgba(99,102,241,0.35);
        }
        .logo-text {
          font-size: 20px; font-weight: 800; letter-spacing: -0.5px;
          color: #1a1f2e;
        }
        .logo-text span { color: #6366f1; }
        .logo-sub {
          font-size: 11px; color: #94a3b8; letter-spacing: 0.5px; font-weight: 400;
        }

        .header-right {
          display: flex; align-items: center; gap: 8px;
        }
        .live-badge {
          display: flex; align-items: center; gap: 6px;
          background: #f0fdf4; border: 1px solid #bbf7d0;
          color: #16a34a; border-radius: 20px;
          padding: 5px 12px; font-size: 12px; font-weight: 600;
        }
        .live-dot {
          width: 7px; height: 7px; border-radius: 50%;
          background: #22c55e;
          animation: livepulse 1.5s ease-in-out infinite;
        }
        @keyframes livepulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.8)} }

        /* ── HERO STATS ── */
        .hero {
          padding: 28px 32px 0;
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 16px;
        }

        .stat-card {
          background: #fff;
          border-radius: 16px;
          padding: 20px 22px;
          border: 1px solid #e2e6ef;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
          transition: transform 0.2s, box-shadow 0.2s;
          position: relative; overflow: hidden;
        }
        .stat-card::before {
          content: '';
          position: absolute; top: 0; left: 0; right: 0; height: 3px;
          border-radius: 16px 16px 0 0;
        }
        .stat-card.indigo::before { background: linear-gradient(90deg, #6366f1, #8b5cf6); }
        .stat-card.emerald::before { background: linear-gradient(90deg, #10b981, #34d399); }
        .stat-card.amber::before { background: linear-gradient(90deg, #f59e0b, #fbbf24); }
        .stat-card.sky::before { background: linear-gradient(90deg, #0ea5e9, #38bdf8); }
        .stat-card.rose::before { background: linear-gradient(90deg, #f43f5e, #fb7185); }

        .stat-card:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.08); }

        .stat-icon {
          width: 36px; height: 36px; border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          font-size: 18px; margin-bottom: 12px;
        }
        .stat-card.indigo  .stat-icon { background: #eef2ff; }
        .stat-card.emerald .stat-icon { background: #ecfdf5; }
        .stat-card.amber   .stat-icon { background: #fffbeb; }
        .stat-card.sky     .stat-icon { background: #f0f9ff; }
        .stat-card.rose    .stat-icon { background: #fff1f2; }

        .stat-val {
          font-size: 26px; font-weight: 800; color: #1a1f2e;
          letter-spacing: -1px; line-height: 1;
          font-family: 'Outfit', sans-serif;
        }
        .stat-val.mono { font-family: 'JetBrains Mono', monospace; font-size: 18px; letter-spacing: -0.5px; }
        .stat-lbl {
          font-size: 12px; color: #94a3b8; font-weight: 500;
          margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px;
        }

        /* ── PROGRESS ── */
        .progress-section {
          padding: 20px 32px 0;
        }
        .progress-card {
          background: #fff;
          border-radius: 16px;
          padding: 20px 24px;
          border: 1px solid #e2e6ef;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }
        .progress-header {
          display: flex; justify-content: space-between; align-items: center;
          margin-bottom: 12px;
        }
        .progress-title { font-size: 14px; font-weight: 600; color: #475569; }
        .progress-pct {
          font-family: 'JetBrains Mono', monospace;
          font-size: 13px; color: #6366f1; font-weight: 600;
          background: #eef2ff; padding: 3px 10px; border-radius: 6px;
        }
        .progress-track {
          height: 10px; background: #f1f5f9; border-radius: 10px; overflow: hidden;
        }
        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #6366f1, #8b5cf6, #a78bfa);
          border-radius: 10px;
          transition: width 1.2s cubic-bezier(0.4,0,0.2,1);
          min-width: 4px;
          box-shadow: 0 0 12px rgba(99,102,241,0.4);
          position: relative;
        }
        .progress-fill::after {
          content: '';
          position: absolute; right: 0; top: 0; bottom: 0; width: 20px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4));
          animation: shimmer 2s ease-in-out infinite;
        }
        @keyframes shimmer { 0%,100%{opacity:0} 50%{opacity:1} }

        .progress-labels {
          display: flex; justify-content: space-between;
          margin-top: 8px; font-family: 'JetBrains Mono', monospace;
          font-size: 10px; color: #cbd5e1;
        }

        /* ── MAIN GRID ── */
        .main-grid {
          display: grid;
          grid-template-columns: 1fr 380px;
          gap: 20px;
          padding: 20px 32px 32px;
        }

        .panel {
          background: #fff;
          border-radius: 16px;
          border: 1px solid #e2e6ef;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
          overflow: hidden;
        }

        .panel-header {
          padding: 16px 20px;
          border-bottom: 1px solid #f1f5f9;
          display: flex; align-items: center; justify-content: space-between;
        }
        .panel-title {
          font-size: 13px; font-weight: 700; color: #475569;
          text-transform: uppercase; letter-spacing: 1px;
          display: flex; align-items: center; gap: 8px;
        }
        .panel-count {
          background: #f1f5f9; color: #64748b;
          font-size: 11px; font-weight: 600;
          padding: 2px 8px; border-radius: 20px;
        }
        .panel-count.active {
          background: #eef2ff; color: #6366f1;
        }

        /* ── AGENTS ── */
        .agents-body { padding: 12px; display: flex; flex-direction: column; gap: 8px; }

        .agent-row {
          border-radius: 12px;
          border: 1px solid #f1f5f9;
          padding: 14px 16px;
          background: #fafbfe;
          transition: all 0.2s;
          position: relative; overflow: hidden;
        }
        .agent-row.working {
          border-color: #c7d2fe;
          background: #fafbff;
          box-shadow: 0 2px 8px rgba(99,102,241,0.08);
        }
        .agent-row.working::before {
          content: '';
          position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
          background: linear-gradient(180deg, #6366f1, #8b5cf6);
          border-radius: 3px 0 0 3px;
        }
        .agent-row.offline { opacity: 0.45; }

        .agent-top {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 10px;
        }
        .agent-identity { display: flex; align-items: center; gap: 10px; }

        .agent-avatar {
          width: 34px; height: 34px; border-radius: 9px;
          display: flex; align-items: center; justify-content: center;
          font-size: 14px; font-weight: 700; color: #fff;
          flex-shrink: 0;
        }
        .working .agent-avatar { background: linear-gradient(135deg, #6366f1, #8b5cf6); }
        .idle    .agent-avatar { background: linear-gradient(135deg, #94a3b8, #cbd5e1); }
        .offline .agent-avatar { background: #e2e8f0; color: #94a3b8; }

        .agent-name-wrap {}
        .agent-name { font-size: 14px; font-weight: 600; color: #1e293b; }
        .agent-since { font-size: 11px; color: #94a3b8; }

        .status-pill {
          font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 20px;
          display: flex; align-items: center; gap: 5px;
        }
        .status-pill.working { background: #eef2ff; color: #6366f1; }
        .status-pill.idle    { background: #f8fafc; color: #94a3b8; border: 1px solid #e2e8f0; }
        .status-pill.offline { background: #f8fafc; color: #cbd5e1; border: 1px solid #f1f5f9; }
        .status-dot { width: 6px; height: 6px; border-radius: 50%; }
        .working .status-dot { background: #6366f1; animation: livepulse 1.5s infinite; }
        .idle    .status-dot { background: #94a3b8; }
        .offline .status-dot { background: #e2e8f0; }

        .agent-metrics {
          display: grid; grid-template-columns: repeat(3, 1fr);
          gap: 8px; margin-bottom: 10px;
        }
        .metric {
          background: #fff; border: 1px solid #f1f5f9;
          border-radius: 8px; padding: 8px 10px;
        }
        .metric-lbl { font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px; }
        .metric-val { font-size: 13px; font-weight: 600; color: #334155; }
        .metric-val.mono { font-family: 'JetBrains Mono', monospace; font-size: 12px; }

        .agent-hex {
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px; color: #94a3b8;
          background: #f8fafc; border: 1px solid #f1f5f9;
          border-radius: 6px; padding: 5px 10px;
          letter-spacing: 0.5px;
        }

        .empty-state {
          text-align: center; padding: 40px 20px;
          color: #cbd5e1; font-size: 14px;
        }
        .empty-icon { font-size: 32px; margin-bottom: 8px; }

        /* ── RIGHT PANEL ── */
        .right-col { display: flex; flex-direction: column; gap: 20px; }

        /* ── RECENT ── */
        .recent-body { padding: 8px 0; max-height: 320px; overflow-y: auto; }
        .recent-item {
          display: flex; align-items: center; gap: 12px;
          padding: 10px 20px;
          border-bottom: 1px solid #f8fafc;
          transition: background 0.15s;
        }
        .recent-item:last-child { border-bottom: none; }
        .recent-item:hover { background: #f8fafc; }

        .recent-num {
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px; font-weight: 600; color: #6366f1;
          min-width: 80px;
        }
        .recent-info { flex: 1; min-width: 0; }
        .recent-hex {
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px; color: #94a3b8;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .recent-agent { font-size: 11px; color: #64748b; font-weight: 500; }

        .recent-badge {
          width: 28px; height: 28px; border-radius: 7px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          display: flex; align-items: center; justify-content: center;
          font-size: 11px; font-weight: 700; color: #fff;
          flex-shrink: 0;
        }

        /* ── RANGE INFO ── */
        .range-body { padding: 16px 20px; display: flex; flex-direction: column; gap: 10px; }
        .range-item {
          display: flex; justify-content: space-between; align-items: center;
          padding: 10px 12px; background: #f8fafc; border-radius: 8px;
          border: 1px solid #f1f5f9;
        }
        .range-key { font-size: 12px; color: #64748b; font-weight: 500; }
        .range-val {
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px; color: #334155; font-weight: 600;
          background: #fff; border: 1px solid #e2e8f0;
          padding: 3px 8px; border-radius: 5px;
        }

        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
      `}</style>

      <div className="app">
        {/* Header */}
        <header className="header">
          <div className="logo">
            <div className="logo-icon">⬡</div>
            <div>
              <div className="logo-text">HASH<span>SCAN</span></div>
              <div className="logo-sub">Distributed Block Processor</div>
            </div>
          </div>
          <div className="header-right">
            <div className="live-badge">
              <div className="live-dot" />
              Ao vivo
            </div>
          </div>
        </header>

        {/* Hero Stats */}
        <div className="hero">
          <div className="stat-card indigo">
            <div className="stat-icon">👥</div>
            <div className="stat-val">{online.length}</div>
            <div className="stat-lbl">Agentes Online</div>
          </div>
          <div className="stat-card emerald">
            <div className="stat-icon">⚡</div>
            <div className="stat-val">{formatSpeed(totalSpeed)}</div>
            <div className="stat-lbl">Velocidade Total</div>
          </div>
          <div className="stat-card amber">
            <div className="stat-icon">✅</div>
            <div className="stat-val">{fmt(used)}</div>
            <div className="stat-lbl">Blocos Processados</div>
          </div>
          <div className="stat-card sky">
            <div className="stat-icon">📊</div>
            <div className="stat-val mono">{pct}%</div>
            <div className="stat-lbl">Cobertura</div>
          </div>
          <div className="stat-card rose">
            <div className="stat-icon">🔢</div>
            <div className="stat-val">{fmt(TOTAL_BLOCKS - used)}</div>
            <div className="stat-lbl">Blocos Restantes</div>
          </div>
        </div>

        {/* Progress */}
        <div className="progress-section">
          <div className="progress-card">
            <div className="progress-header">
              <span className="progress-title">Progresso do Espaço de Busca</span>
              <span className="progress-pct">{pct}%</span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${progressWidth}%` }} />
            </div>
            <div className="progress-labels">
              <span>0x4000000000000000</span>
              <span>{fmt(used)} / {fmt(TOTAL_BLOCKS)} blocos</span>
              <span>0x7FFFFFFFFFFFFFFF</span>
            </div>
          </div>
        </div>

        {/* Main Grid */}
        <div className="main-grid">
          {/* Agents */}
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title">
                🖥️ Agentes Conectados
              </div>
              <span className={`panel-count ${online.length > 0 ? 'active' : ''}`}>
                {online.length} online {offline.length > 0 ? `· ${offline.length} offline` : ''}
              </span>
            </div>
            <div className="agents-body">
              {online.length === 0 && offline.length === 0 && (
                <div className="empty-state">
                  <div className="empty-icon">🔌</div>
                  Nenhum agente conectado ainda.<br/>
                  Rode <code>python agent.py --server URL</code>
                </div>
              )}
              {[...online, ...offline].map(agent => (
                <div key={agent.name} className={`agent-row ${agent.status}`}>
                  <div className="agent-top">
                    <div className="agent-identity">
                      <div className="agent-avatar">
                        {agent.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="agent-name-wrap">
                        <div className="agent-name">{agent.name}</div>
                        <div className="agent-since">{timeAgo(agent.lastSeen)}</div>
                      </div>
                    </div>
                    <div className={`status-pill ${agent.status}`}>
                      <span className="status-dot" />
                      {agent.status === 'working' ? 'Processando' : agent.status === 'idle' ? 'Aguardando' : 'Offline'}
                    </div>
                  </div>

                  {agent.status !== 'offline' && (
                    <>
                      <div className="agent-metrics">
                        <div className="metric">
                          <div className="metric-lbl">Velocidade</div>
                          <div className="metric-val">{formatSpeed(agent.speed)}</div>
                        </div>
                        <div className="metric">
                          <div className="metric-lbl">Bloco Atual</div>
                          <div className="metric-val mono">
                            {agent.currentBlock >= 0 ? `#${agent.currentBlock.toLocaleString('pt-BR')}` : '—'}
                          </div>
                        </div>
                        <div className="metric">
                          <div className="metric-lbl">Multiplicador</div>
                          <div className="metric-val">×50M</div>
                        </div>
                      </div>
                      {agent.currentBlock >= 0 && (
                        <div className="agent-hex">{blockToHex(agent.currentBlock)}</div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Right col */}
          <div className="right-col">
            {/* Recent completions */}
            <div className="panel">
              <div className="panel-header">
                <div className="panel-title">🕐 Blocos Recentes</div>
                <span className="panel-count">{(data?.recentCompletions ?? []).length}</span>
              </div>
              <div className="recent-body">
                {(data?.recentCompletions ?? []).length === 0 && (
                  <div className="empty-state">
                    <div className="empty-icon">⏳</div>
                    Aguardando conclusões...
                  </div>
                )}
                {(data?.recentCompletions ?? []).map((r, i) => (
                  <div key={i} className="recent-item">
                    <div className="recent-badge">
                      {r.agent?.slice(0, 2).toUpperCase() ?? '??'}
                    </div>
                    <div className="recent-info">
                      <div className="recent-agent">{r.agent}</div>
                      <div className="recent-hex">{blockToHex(r.block)}</div>
                    </div>
                    <div className="recent-num">#{r.block.toLocaleString('pt-BR')}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Range info */}
            <div className="panel">
              <div className="panel-header">
                <div className="panel-title">📐 Configuração do Range</div>
              </div>
              <div className="range-body">
                <div className="range-item">
                  <span className="range-key">Início do range</span>
                  <span className="range-val">0x4000000000000000</span>
                </div>
                <div className="range-item">
                  <span className="range-key">Fim do range</span>
                  <span className="range-val">0x7FFFFFFFFFFFFFFF</span>
                </div>
                <div className="range-item">
                  <span className="range-key">Tamanho do bloco</span>
                  <span className="range-val">× 50.000.000</span>
                </div>
                <div className="range-item">
                  <span className="range-key">Total de blocos</span>
                  <span className="range-val">{fmt(TOTAL_BLOCKS)}</span>
                </div>
                <div className="range-item">
                  <span className="range-key">Blocos usados</span>
                  <span className="range-val">{fmt(used)}</span>
                </div>
                <div className="range-item">
                  <span className="range-key">Blocos restantes</span>
                  <span className="range-val">{fmt(TOTAL_BLOCKS - used)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
