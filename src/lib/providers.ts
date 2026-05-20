/**
 * LLM 供应商注册表
 *
 * 设计要点：
 *   1. 所有 OpenAI 兼容供应商在这里集中配置（baseURL + 模型列表）
 *   2. apiKey 从 process.env 读取，永不暴露到前端
 *   3. supportsToolCalling 标记某模型是否支持 Function Calling
 *      （前端可据此提示用户选了不支持工具的模型时降级为纯聊天）
 *   4. 通过 getPublicProviders() 暴露给前端的元数据 **不含 key**
 *
 * 添加新供应商：在下面 PROVIDERS 里加一项即可，前端会自动出现选项。
 */

export type ModelInfo = {
  /** 模型 id，传给 LLM API 的 model 字段 */
  id: string
  /** 给用户看的展示名 */
  label: string
  /** 是否支持 Function Calling（决定后端是否注入 tools） */
  supportsToolCalling: boolean
  /** 可选简介，展示在下拉里 */
  hint?: string
}

export type ProviderConfig = {
  /** 内部 id，比如 'deepseek'、'openai' */
  id: string
  /** 给用户看的供应商名 */
  label: string
  /** OpenAI 兼容 API 的 baseURL */
  baseURL: string
  /** 从环境变量读 key 的字段名（按顺序尝试，第一个有值的生效） */
  apiKeyEnv: string | string[]
  /** 该供应商提供的模型列表 */
  models: ModelInfo[]
  /** 官网链接，便于用户去申请 key */
  homepage?: string
}

/** 工具：从一个或多个候选环境变量名里取出第一个非空值 */
function readEnv(names: string | string[]): string | undefined {
  const list = Array.isArray(names) ? names : [names]
  for (const n of list) {
    const v = process.env[n]
    if (v) return v
  }
  return undefined
}

/**
 * 在这里维护所有支持的供应商。
 * 用户的 .env.local 里只要配置对应的 *_API_KEY 就会自动出现在前端下拉里。
 */
export const PROVIDERS: ProviderConfig[] = [
  {
    id: 'deepseek',
    label: 'DeepSeek',
    baseURL: 'https://api.deepseek.com',
    // 兼容老的 OPENAI_API_KEY（之前 demo 用 DeepSeek 但 key 字段叫 OPENAI_API_KEY）
    apiKeyEnv: ['DEEPSEEK_API_KEY', 'OPENAI_API_KEY'],
    homepage: 'https://platform.deepseek.com',
    models: [
      {
        id: 'deepseek-chat',
        label: 'DeepSeek Chat (V3)',
        supportsToolCalling: true,
        hint: '通用对话，性价比高',
      },
      {
        id: 'deepseek-reasoner',
        label: 'DeepSeek Reasoner (R1)',
        supportsToolCalling: false,
        hint: '推理模型，不支持工具调用',
      },
    ],
  },
  {
    id: 'openai',
    label: 'OpenAI',
    baseURL: 'https://api.openai.com/v1',
    // 单独一个 OPENAI_OFFICIAL_API_KEY 用来区分官方 OpenAI 和上面的 deepseek 兼容情况
    apiKeyEnv: 'OPENAI_OFFICIAL_API_KEY',
    homepage: 'https://platform.openai.com',
    models: [
      {
        id: 'gpt-4o-mini',
        label: 'GPT-4o mini',
        supportsToolCalling: true,
        hint: '便宜快速',
      },
      {
        id: 'gpt-4o',
        label: 'GPT-4o',
        supportsToolCalling: true,
        hint: '旗舰多模态',
      },
    ],
  },
  {
    id: 'moonshot',
    label: '月之暗面 (Moonshot)',
    baseURL: 'https://api.moonshot.cn/v1',
    apiKeyEnv: 'MOONSHOT_API_KEY',
    homepage: 'https://platform.moonshot.cn',
    models: [
      {
        id: 'moonshot-v1-8k',
        label: 'Moonshot v1 8K',
        supportsToolCalling: true,
      },
      {
        id: 'moonshot-v1-32k',
        label: 'Moonshot v1 32K',
        supportsToolCalling: true,
      },
    ],
  },
  {
    id: 'zhipu',
    label: '智谱 (Zhipu)',
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
    apiKeyEnv: 'ZHIPU_API_KEY',
    homepage: 'https://open.bigmodel.cn',
    models: [
      {
        id: 'glm-4-flash',
        label: 'GLM-4 Flash',
        supportsToolCalling: true,
        hint: '完全免费，国内畅通，demo 首选',
      },
      {
        id: 'glm-4-plus',
        label: 'GLM-4 Plus',
        supportsToolCalling: true,
        hint: '旗舰版，能力更强',
      },
      {
        id: 'glm-4.5',
        label: 'GLM-4.5',
        supportsToolCalling: true,
        hint: '2025 旗舰，复杂推理',
      },
    ],
  },
  {
    id: 'qwen',
    label: '通义千问 (Qwen)',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiKeyEnv: 'QWEN_API_KEY',
    homepage: 'https://dashscope.console.aliyun.com',
    models: [
      {
        id: 'qwen-turbo',
        label: 'Qwen Turbo',
        supportsToolCalling: true,
        hint: '便宜快速，日常对话首选',
      },
      {
        id: 'qwen-plus',
        label: 'Qwen Plus',
        supportsToolCalling: true,
        hint: '推理更强，长文本',
      },
      {
        id: 'qwen-max',
        label: 'Qwen Max',
        supportsToolCalling: true,
        hint: '最强能力，复杂任务',
      },
    ],
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    // Google AI Studio 提供的 OpenAI 兼容端点
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    apiKeyEnv: 'GEMINI_API_KEY',
    homepage: 'https://aistudio.google.com/apikey',
    models: [
      {
        id: 'gemini-2.0-flash',
        label: 'Gemini 2.0 Flash',
        supportsToolCalling: true,
        hint: '免费，快速，多模态',
      },
      {
        id: 'gemini-2.5-flash',
        label: 'Gemini 2.5 Flash',
        supportsToolCalling: true,
        hint: '最新版，推理增强',
      },
      {
        id: 'gemini-2.5-pro',
        label: 'Gemini 2.5 Pro',
        supportsToolCalling: true,
        hint: '旗舰，复杂任务',
      },
    ],
  },
]

/** 兼容老的 OPENAI_BASE_URL/OPENAI_MODEL 配置：把它当作 fallback */
const LEGACY_BASE_URL = process.env.OPENAI_BASE_URL
const LEGACY_MODEL = process.env.OPENAI_MODEL

/**
 * 给前端用的"已配置好 key 的供应商列表"。
 * 不会泄漏 key，只暴露 id/label/models。
 */
export function getPublicProviders() {
  return PROVIDERS.filter((p) => !!readEnv(p.apiKeyEnv)).map((p) => ({
    id: p.id,
    label: p.label,
    homepage: p.homepage,
    models: p.models.map((m) => ({
      id: m.id,
      label: m.label,
      supportsToolCalling: m.supportsToolCalling,
      hint: m.hint,
    })),
  }))
}

/**
 * 根据请求里的 providerId 找到完整配置（含 baseURL + apiKey）。
 * 仅在服务端调用！
 */
export function getProviderConfig(providerId: string | undefined) {
  // 没传时取第一个有 key 的供应商
  if (!providerId) {
    const first = PROVIDERS.find((p) => !!readEnv(p.apiKeyEnv))
    if (first) return resolveProvider(first)
    // 真的什么 key 都没配置 → 退回到老的 OPENAI_API_KEY 兼容模式
    return resolveLegacyProvider()
  }

  const p = PROVIDERS.find((x) => x.id === providerId)
  if (!p) throw new Error(`未知的供应商：${providerId}`)
  const apiKey = readEnv(p.apiKeyEnv)
  if (!apiKey) {
    const envName = Array.isArray(p.apiKeyEnv) ? p.apiKeyEnv[0] : p.apiKeyEnv
    throw new Error(
      `供应商 ${p.label} 未配置 API Key，请在 .env.local 中设置 ${envName}`,
    )
  }
  return {
    id: p.id,
    label: p.label,
    baseURL: p.baseURL,
    apiKey,
    models: p.models,
  }
}

function resolveProvider(p: ProviderConfig) {
  const apiKey = readEnv(p.apiKeyEnv)!
  return {
    id: p.id,
    label: p.label,
    baseURL: p.baseURL,
    apiKey,
    models: p.models,
  }
}

function resolveLegacyProvider() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error(
      '没有配置任何 API Key，请在 .env.local 中至少设置一个供应商的 *_API_KEY',
    )
  }
  return {
    id: 'legacy',
    label: 'Custom',
    baseURL: LEGACY_BASE_URL || 'https://api.deepseek.com',
    apiKey,
    models: [
      {
        id: LEGACY_MODEL || 'deepseek-chat',
        label: LEGACY_MODEL || 'deepseek-chat',
        supportsToolCalling: true,
      },
    ],
  }
}

/** 找具体模型的配置（用于判断是否支持 tool calling） */
export function getModelInfo(
  providerId: string | undefined,
  modelId: string | undefined,
): ModelInfo | undefined {
  const p = PROVIDERS.find((x) => x.id === providerId)
  return p?.models.find((m) => m.id === modelId)
}
