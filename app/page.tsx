'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

const TOTAL_BLOCKS = 1844
const MULTIPLIER = 50_000_000
const RANGE_START_HEX = '4000000000000000'

type Agent = {
  name: string
  speed: number
  status: 'working' | 'idle' | 'offline' | 'done'
  currentBlock: number
  lastSeen: number
}

type DashboardData = {
  agents: Agent[]
  completed: number[]
  inProgress: number[]
  recentCompletions: { block: number; ts: number }[]
  totalBlocks: number
  progress: number
}

function blockToHex(i: number): string {
  const start = BigInt('0x4000000000000000')
  const val = start + BigInt(i) * BigInt(MULTIPLIER)
  return val.toString(16).toUpperCase().padStart(16, '0')
}

function formatSpeed(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M/s`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K/s`
  return `${n}/s`
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return `${s}s atrás`
  if (s < 3600) return `${Math.floor(s / 60)}m atrás`
  return `${Math.floor(s / 3600)}h atrás`
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [tick, setTick] = useState(0)
  const intervalRef = useRef<NodeJS.Timeout>()

  const fetchData = useCallback(async () => {
    try {
      const r = await fetch('/api/agent')
      const d = await r.json()
      setData(d)
    } catch {}
  }, [])

  useEffect(() => {
    fetchData()
    intervalRef.current = setInterval(() => {
      fetchData()
      setTick(t => t + 1)
    }, 1500)
    return () => clearInterval(intervalRef.current)
  }, [fetchData])

  const completedSet = new Set(data?.completed ?? [])
  const inProgressSet = new Set(data?.inProgress ?? [])
  const completedCount = data?.completed.length ?? 0
  const progressPct = data ? Math.round(data.progress * 100) : 0
  const onlineAgents = (data?.agents ?? []).filter(a => a.status !== 'offline')
  const totalSpeed = onlineAgents.reduce((s, a) => s + a.speed, 0)

  return (
    <div className="root">
      <header>
        <div className="logo">
          <span className="logo-icon">⬡</span>
          <span className="logo-text">HASHSCAN</span>
          <span className="logo-sub">distributed range processor</span>
        </div>
        <div className="header-stats">
          <div className="hstat">
            <span className="hstat-val">{onlineAgents.length}</span>
            <span className="hstat-lbl">agentes online</span>
          </div>
          <div className="hstat">
            <span className="hstat-val">{formatSpeed(totalSpeed)}</span>
            <span className="hstat-lbl">velocidade total</span>
          </div>
          <div className="hstat">
            <span className="hstat-val">{progressPct}%</span>
            <span className="hstat-lbl">concluído</span>
          </div>
          <div className="hstat">
            <span className="hstat-val">{completedCount.toLocaleString()}</span>
            <span className="hstat-lbl">/ {TOTAL_BLOCKS} blocos</span>
          </div>
        </div>
      </header>

      <div className="range-bar-wrap">
        <div className="range-label">
          <span className="mono">0x{RANGE_START_HEX}</span>
          <span className="range-title">RANGE TOTAL: 0x4000000000000000 → 0x7FFFFFFFFFFFFFFF</span>
          <span className="mono">0x7FFFFFFFFFFFFFFF</span>
        </div>
        <div className="range-bar">
          <div className="range-fill" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      <div className="main-grid">
        {/* Block map */}
        <section className="block-map-section">
          <div className="section-header">
            <h2>MAPA DE BLOCOS</h2>
            <div className="legend">
              <span className="leg leg-done">■ concluído</span>
              <span className="leg leg-active">■ em processo</span>
              <span className="leg leg-pending">■ pendente</span>
            </div>
          </div>
          <div className="block-grid">
            {Array.from({ length: TOTAL_BLOCKS }, (_, i) => {
              const isDone = completedSet.has(i)
              const isActive = inProgressSet.has(i)
              let cls = 'blk'
              if (isDone) cls += ' blk-done'
              else if (isActive) cls += ' blk-active'
              return (
                <div
                  key={i}
                  className={cls}
                  title={`Bloco #${i}\n× ${MULTIPLIER.toLocaleString()}\n0x${blockToHex(i)}`}
                />
              )
            })}
          </div>
        </section>

        {/* Right panel */}
        <aside className="right-panel">
          {/* Agents */}
          <section className="agents-section">
            <div className="section-header">
              <h2>AGENTES</h2>
            </div>
            <div className="agents-list">
              {(data?.agents ?? []).length === 0 && (
                <div className="empty">nenhum agente conectado</div>
              )}
              {(data?.agents ?? []).map(agent => (
                <div key={agent.name} className={`agent-card agent-${agent.status}`}>
                  <div className="agent-top">
                    <div className="agent-name-wrap">
                      <span className={`agent-dot dot-${agent.status}`} />
                      <span className="agent-name">{agent.name}</span>
                    </div>
                    <span className={`agent-badge badge-${agent.status}`}>{agent.status}</span>
                  </div>
                  <div className="agent-meta">
                    <div className="agent-meta-item">
                      <span className="meta-lbl">velocidade</span>
                      <span className="meta-val">{formatSpeed(agent.speed)}</span>
                    </div>
                    <div className="agent-meta-item">
                      <span className="meta-lbl">bloco atual</span>
                      <span className="meta-val mono">
                        {agent.currentBlock >= 0 ? `#${agent.currentBlock}` : '—'}
                      </span>
                    </div>
                    <div className="agent-meta-item">
                      <span className="meta-lbl">visto</span>
                      <span className="meta-val">{timeAgo(agent.lastSeen)}</span>
                    </div>
                  </div>
                  {agent.currentBlock >= 0 && (
                    <div className="agent-hex mono">
                      0x{blockToHex(agent.currentBlock)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Recent completions */}
          <section className="recent-section">
            <div className="section-header">
              <h2>CONCLUÍDOS RECENTES</h2>
            </div>
            <div className="recent-list">
              {(data?.recentCompletions ?? []).map((r, idx) => (
                <div key={idx} className="recent-item">
                  <span className="recent-block mono">#{ r.block}</span>
                  <span className="recent-hex mono">0x{blockToHex(r.block)}</span>
                  <span className="recent-time">{timeAgo(r.ts)}</span>
                </div>
              ))}
              {(data?.recentCompletions ?? []).length === 0 && (
                <div className="empty">nenhum bloco concluído ainda</div>
              )}
            </div>
          </section>
        </aside>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Barlow:wght@300;400;500;600;700&family=Barlow+Condensed:wght@400;600;700&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .root {
          min-height: 100vh;
          background: #080b0f;
          color: #c8d4e0;
          font-family: 'Barlow', sans-serif;
          padding: 0 0 40px;
          background-image:
            radial-gradient(ellipse 80% 40% at 50% 0%, rgba(0,180,255,0.04) 0%, transparent 70%),
            repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(255,255,255,0.015) 40px),
            repeating-linear-gradient(90deg, transparent, transparent 39px, rgba(255,255,255,0.015) 40px);
        }

        header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px 32px;
          border-bottom: 1px solid rgba(0,200,255,0.12);
          background: rgba(0,0,0,0.4);
          backdrop-filter: blur(8px);
          position: sticky; top: 0; z-index: 10;
        }

        .logo { display: flex; align-items: center; gap: 10px; }
        .logo-icon { font-size: 22px; color: #00c8ff; filter: drop-shadow(0 0 8px #00c8ff88); }
        .logo-text {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 22px; font-weight: 700; letter-spacing: 4px;
          color: #fff; text-shadow: 0 0 20px rgba(0,200,255,0.4);
        }
        .logo-sub {
          font-size: 11px; color: #4a6070; letter-spacing: 2px;
          text-transform: uppercase; margin-left: 4px;
        }

        .header-stats { display: flex; gap: 32px; }
        .hstat { display: flex; flex-direction: column; align-items: flex-end; }
        .hstat-val { font-family: 'Barlow Condensed', sans-serif; font-size: 20px; font-weight: 600; color: #00c8ff; }
        .hstat-lbl { font-size: 11px; color: #4a6070; letter-spacing: 1px; text-transform: uppercase; }

        .range-bar-wrap { padding: 16px 32px 0; }
        .range-label {
          display: flex; justify-content: space-between; align-items: center;
          font-size: 11px; color: #3a5060; margin-bottom: 6px;
        }
        .range-title { font-family: 'Barlow Condensed', sans-serif; font-size: 12px; letter-spacing: 2px; color: #4a7080; }
        .mono { font-family: 'Share Tech Mono', monospace; }
        .range-bar {
          height: 4px; background: rgba(255,255,255,0.06); border-radius: 2px; overflow: hidden;
        }
        .range-fill {
          height: 100%; background: linear-gradient(90deg, #0080ff, #00c8ff);
          border-radius: 2px; transition: width 0.8s ease;
          box-shadow: 0 0 12px rgba(0,200,255,0.5);
        }

        .main-grid {
          display: grid;
          grid-template-columns: 1fr 340px;
          gap: 20px;
          padding: 20px 32px 0;
        }

        .section-header {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 12px;
        }
        .section-header h2 {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 12px; font-weight: 600; letter-spacing: 3px;
          color: #4a6070; border-left: 2px solid #00c8ff; padding-left: 8px;
        }

        .legend { display: flex; gap: 14px; }
        .leg { font-size: 11px; color: #3a5060; display: flex; align-items: center; gap: 4px; }
        .leg-done { color: #00c8ff; }
        .leg-active { color: #ff8c00; }
        .leg-pending { color: #2a3a48; }

        .block-map-section {
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 8px; padding: 16px;
        }

        .block-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(9px, 1fr));
          gap: 2px;
        }

        .blk {
          width: 100%; aspect-ratio: 1;
          background: rgba(255,255,255,0.04);
          border-radius: 1px;
          transition: background 0.3s;
          cursor: default;
        }
        .blk-done {
          background: rgba(0,200,255,0.55);
          box-shadow: 0 0 3px rgba(0,200,255,0.3);
        }
        .blk-active {
          background: #ff8c00;
          box-shadow: 0 0 6px rgba(255,140,0,0.7);
          animation: pulse 1s ease-in-out infinite;
        }
        @keyframes pulse {
          0%,100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .right-panel { display: flex; flex-direction: column; gap: 16px; }

        .agents-section, .recent-section {
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 8px; padding: 16px;
        }

        .agents-list { display: flex; flex-direction: column; gap: 8px; max-height: 420px; overflow-y: auto; }

        .agent-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 6px; padding: 10px 12px;
          transition: border-color 0.2s;
        }
        .agent-working { border-color: rgba(255,140,0,0.3); }
        .agent-idle    { border-color: rgba(0,200,255,0.15); }
        .agent-offline { opacity: 0.5; }

        .agent-top {
          display: flex; align-items: center;
          justify-content: space-between; margin-bottom: 8px;
        }
        .agent-name-wrap { display: flex; align-items: center; gap: 7px; }
        .agent-dot {
          width: 7px; height: 7px; border-radius: 50%;
          flex-shrink: 0;
        }
        .dot-working { background: #ff8c00; box-shadow: 0 0 6px #ff8c00; animation: pulse 1s infinite; }
        .dot-idle    { background: #00c8ff; box-shadow: 0 0 4px #00c8ff; }
        .dot-offline { background: #3a4a58; }
        .dot-done    { background: #00ff88; box-shadow: 0 0 4px #00ff88; }

        .agent-name {
          font-family: 'Share Tech Mono', monospace;
          font-size: 13px; color: #d0e0ec;
        }

        .agent-badge {
          font-size: 9px; font-weight: 600; letter-spacing: 1.5px;
          text-transform: uppercase; padding: 2px 6px; border-radius: 3px;
        }
        .badge-working { background: rgba(255,140,0,0.15); color: #ff8c00; border: 1px solid rgba(255,140,0,0.3); }
        .badge-idle    { background: rgba(0,200,255,0.1); color: #00c8ff; border: 1px solid rgba(0,200,255,0.2); }
        .badge-offline { background: rgba(255,255,255,0.04); color: #4a6070; border: 1px solid rgba(255,255,255,0.06); }
        .badge-done    { background: rgba(0,255,136,0.1); color: #00ff88; border: 1px solid rgba(0,255,136,0.2); }

        .agent-meta {
          display: grid; grid-template-columns: 1fr 1fr 1fr;
          gap: 4px;
        }
        .agent-meta-item { display: flex; flex-direction: column; }
        .meta-lbl { font-size: 9px; color: #3a5060; text-transform: uppercase; letter-spacing: 1px; }
        .meta-val { font-size: 12px; color: #7a9ab0; font-weight: 500; }

        .agent-hex {
          margin-top: 6px; font-size: 10px; color: #2a5060;
          letter-spacing: 1px; border-top: 1px solid rgba(255,255,255,0.04);
          padding-top: 5px;
        }

        .recent-list { display: flex; flex-direction: column; gap: 4px; max-height: 220px; overflow-y: auto; }
        .recent-item {
          display: flex; align-items: center; gap: 8px;
          padding: 5px 8px; border-radius: 4px;
          background: rgba(255,255,255,0.02);
          font-size: 11px;
        }
        .recent-block { color: #00c8ff; min-width: 36px; }
        .recent-hex { color: #2a6070; flex: 1; font-size: 10px; }
        .recent-time { color: #2a4050; white-space: nowrap; }

        .empty { color: #2a4050; font-size: 12px; text-align: center; padding: 16px; }

        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(0,200,255,0.2); border-radius: 2px; }
      `}</style>
    </div>
  )
}
