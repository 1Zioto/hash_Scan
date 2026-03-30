import { Redis } from '@upstash/redis'
import { NextRequest, NextResponse } from 'next/server'

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
})

const TOTAL_BLOCKS = 92_233_720_368
const OFFLINE_TIMEOUT = 15_000

async function pickRandomBlock(): Promise<number | null> {
  for (let i = 0; i < 20; i++) {
    const n = Math.floor(Math.random() * TOTAL_BLOCKS)
    const used = await redis.sismember('used_blocks', String(n))
    if (!used) return n
  }
  return null
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { action, agentName, speed, completedBlock } = body

  if (!agentName) return NextResponse.json({ error: 'agentName required' }, { status: 400 })

  const now = Date.now()

  if (action === 'connect') {
    const block = await pickRandomBlock()
    if (block === null) return NextResponse.json({ error: 'no blocks available' }, { status: 503 })

    await redis.sadd('used_blocks', String(block))
    await redis.hset(`agent:${agentName}`, {
      name: agentName,
      speed: speed ?? 0,
      lastSeen: now,
      status: 'working',
      currentBlock: block,
    })
    await redis.zadd('agents', { score: now, member: agentName })

    return NextResponse.json({ block })
  }

  if (action === 'heartbeat') {
    await redis.hset(`agent:${agentName}`, { lastSeen: now, speed: speed ?? 0 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'submit') {
    const block = await pickRandomBlock()
    if (block === null) return NextResponse.json({ block: null })

    await redis.sadd('used_blocks', String(block))
    await redis.hset(`agent:${agentName}`, {
      lastSeen: now,
      speed: speed ?? 0,
      status: 'working',
      currentBlock: block,
    })
    await redis.zadd('completed_log', { score: now, member: `${completedBlock}:${agentName}` })

    return NextResponse.json({ block })
  }

  if (action === 'disconnect') {
    await redis.hset(`agent:${agentName}`, { status: 'offline', lastSeen: now, currentBlock: -1 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'unknown action' }, { status: 400 })
}

export async function GET() {
  const now = Date.now()
  const agentNames = (await redis.zrange('agents', 0, -1)) as string[]

  const agents = await Promise.all(
    agentNames.map(async (name) => {
      const a = await redis.hgetall(`agent:${name}`)
      if (!a) return null
      const lastSeen = Number(a.lastSeen ?? 0)
      const isOnline = now - lastSeen < OFFLINE_TIMEOUT
      return {
        name: a.name,
        speed: Number(a.speed ?? 0),
        status: isOnline ? a.status : 'offline',
        currentBlock: Number(a.currentBlock ?? -1),
        lastSeen,
      }
    })
  )

  const usedCount = await redis.scard('used_blocks')

  const recentRaw = (await redis.zrange('completed_log', 0, -1, { rev: true })) as string[]
  const recent = recentRaw.slice(0, 20).map((entry) => {
    const [block, agent] = entry.split(':')
    return { block: Number(block), agent }
  })

  return NextResponse.json({
    agents: agents.filter(Boolean),
    usedCount: Number(usedCount),
    totalBlocks: TOTAL_BLOCKS,
    progress: Number(usedCount) / TOTAL_BLOCKS,
    recentCompletions: recent,
  })
}
