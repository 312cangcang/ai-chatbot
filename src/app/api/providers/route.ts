/**
 * GET /api/providers
 *
 * 返回当前服务端「已配置 API Key」的供应商列表（不含 key）。
 * 前端启动时拉一次，用来渲染模型选择下拉。
 */
import { getPublicProviders } from '@/lib/providers'

export const runtime = 'nodejs'

export async function GET() {
  const providers = getPublicProviders()
  return new Response(JSON.stringify({ providers }), {
    headers: { 'Content-Type': 'application/json' },
  })
}
