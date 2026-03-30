import { kv } from '@vercel/kv'
import { NextRequest, NextResponse } from 'next/server'

const RANGE_START = BigInt('0x4000000000000000')
const RANGE_END   = BigInt('0x7FFFFFFFFFFFFFFF')
const MULTIPLIER  = BigInt(50_000_000)
const TOTAL_BLOCKS = Number((RANGE_END - RANGE_START + 1n) / MULTIPLIER) // ~1,844

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { action, agentName, speed, completedBlock } = body

  if (!agentName) return NextResponse.json({ error: 'agentName required' }, { status: 400 })

  const now = Date.now()

  if (action === 'connect') {
    // Register agent / heartbeat
    await kv.hset(`agent:${agentName}`, {
      name: agentName,
      speed: speed ?? 0,
      lastSeen: now,
      status: 'idle',
      currentBlock: -1,
    })
    await kv.zadd('agents', { score: now, member: agentName })

    // Give first block
    const block = await assignNextBlock(agentName)
    return NextResponse.json({ block, totalBlocks: TOTAL_BLOCKS })
  }

  if (action === 'heartbeat') {
    await kv.hset(`agent:${agentName}`, { lastSeen: now, speed: speed ?? 0 })
    const agent = await kv.hgetall(`agent:${agentName}`)
    return NextResponse.json({ ok: true, currentBlock: agent?.currentBlock ?? -1 })
  }

  if (action === 'submit') {
    // Mark block as done
    if (completedBlock !== undefined && completedBlock >= 0) {
      await kv.hset(`agent:${agentName}`, { status: 'idle', currentBlock: -1 })
      await kv.zadd('completed', { score: now, member: String(completedBlock) })
      await kv.srem('in_progress', String(completedBlock))
    }
    // Assign next block
    const block = await assignNextBlock(agentName)
    return NextResponse.json({ block, totalBlocks: TOTAL_BLOCKS })
  }

  if (action === 'disconnect') {
    const agent = await kv.hgetall(`agent:${agentName}`)
    if (agent?.currentBlock && Number(agent.currentBlock) >= 0) {
      await kv.srem('in_progress', String(agent.currentBlock))
    }
    await kv.hset(`agent:${agentName}`, { status: 'offline', lastSeen: now, currentBlock: -1 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'unknown action' }, { status: 400 })
}

async function assignNextBlock(agentName: string): Promise<number> {
  // Find next block not yet completed or in progress
  const completedRaw = await kv.zrange('completed', 0, -1)
  const inProgressRaw = await kv.smembers('in_progress')

  const completed = new Set((completedRaw as string[]).map(Number))
  const inProgress = new Set((inProgressRaw as string[]).map(Number))

  let nextBlock = -1
  for (let i = 0; i < TOTAL_BLOCKS; i++) {
    if (!completed.has(i) && !inProgress.has(i)) {
      nextBlock = i
      break
    }
  }

  if (nextBlock === -1) {
    // All done!
    await kv.hset(`agent:${agentName}`, { status: 'done', currentBlock: -1 })
    return -1
  }

  await kv.sadd('in_progress', String(nextBlock))
  await kv.hset(`agent:${agentName}`, {
    status: 'working',
    currentBlock: nextBlock,
  })

  return nextBlock
}

export async function GET() {
  // Dashboard data endpoint
  const now = Date.now()
  const TIMEOUT = 10_000 // 10s offline threshold

  const agentNames = await kv.zrange('agents', 0, -1) as string[]

  const agents = await Promise.all(
    agentNames.map(async (name) => {
      const a = await kv.hgetall(`agent:${name}`)
      if (!a) return null
      const lastSeen = Number(a.lastSeen ?? 0)
      const isOnline = now - lastSeen < TIMEOUT
      return {
        name: a.name,
        speed: Number(a.speed ?? 0),
        status: isOnline ? a.status : 'offline',
        currentBlock: Number(a.currentBlock ?? -1),
        lastSeen,
      }
    })
  )

  const completedRaw = await kv.zrange('completed', 0, -1)
  const completedWithScores = await kv.zrange('completed', 0, -1, { withScores: true })
  const inProgressRaw = await kv.smembers('in_progress')

  const completed = (completedRaw as string[]).map(Number)
  const inProgress = (inProgressRaw as string[]).map(Number)

  // Recent completions (last 20) with timestamps
  const recent: { block: number; ts: number }[] = []
  if (Array.isArray(completedWithScores)) {
    for (let i = 0; i < completedWithScores.length; i += 2) {
      recent.push({ block: Number(completedWithScores[i]), ts: Number(completedWithScores[i + 1]) })
    }
  }
  recent.sort((a, b) => b.ts - a.ts)

  return NextResponse.json({
    agents: agents.filter(Boolean),
    completed,
    inProgress,
    recentCompletions: recent.slice(0, 20),
    totalBlocks: TOTAL_BLOCKS,
    progress: completed.length / TOTAL_BLOCKS,
  })
}
