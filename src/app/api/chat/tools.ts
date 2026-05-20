/**
 * Tool Calling 工具集（Day 5）
 *
 * 一个工具 = 两件事：
 *   1. schema：告诉 LLM「我有这个工具，参数长这样」
 *   2. impl：真实执行的函数
 *
 * 工具命名规范：snake_case，描述要清晰，让 LLM 准确判断何时调用。
 */

// ============================================================
// 工具实现：真实的业务逻辑
// ============================================================

/**
 * 工具 1：查询当前时间（最简单的工具，证明"实时性"）
 *
 * 为什么需要这个工具？
 *   LLM 训练数据是冻结的，它根本"不知道"现在是几月几号。
 *   问它"今天星期几"，它要么编一个、要么说"我不知道"。
 *   有了这个工具，它能准确告诉用户当前时间。
 */
function get_current_time(): { current_time: string; timezone: string } {
  const now = new Date()
  return {
    current_time: now.toLocaleString('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'long',
    }),
    timezone: 'Asia/Shanghai (UTC+8)',
  }
}

/**
 * 工具 2：精确数学计算（弥补 LLM 算数不准的硬伤）
 *
 * 为什么需要这个工具？
 *   LLM 是基于概率生成的，遇到 (12345 + 6789) × 7 这种大数运算
 *   经常算错。有了精确计算器，结果 100% 正确。
 *
 * ⚠️ 安全性：用 Function 而不是 eval，并做正则白名单
 */
function calculator({ expression }: { expression: string }):
  | { expression: string; result: number }
  | { error: string } {
  try {
    // 白名单：只允许数字、空格、运算符、小数点、括号
    if (!/^[\d+\-*/().\s]+$/.test(expression)) {
      return { error: '表达式只允许数字和 + - * / ( ) 字符' }
    }
    // 用 Function 比 eval 稍微安全（独立作用域，访问不到外部变量）
    const result = new Function(`return (${expression})`)()
    if (typeof result !== 'number' || !Number.isFinite(result)) {
      return { error: '计算结果无效' }
    }
    return { expression, result }
  } catch (e) {
    return { error: e instanceof Error ? e.message : '计算失败' }
  }
}

/**
 * 工具 3：查询天气（mock 数据，演示用）
 *
 * 真实项目可以接：
 *   - 和风天气 https://dev.qweather.com（国内）
 *   - OpenWeatherMap https://openweathermap.org（国际）
 */
function get_weather({ city }: { city: string }):
  | {
      city: string
      temperature: number
      condition: string
      humidity: number
      unit: string
    }
  | { error: string } {
  const mockData: Record<
    string,
    { temperature: number; condition: string; humidity: number }
  > = {
    北京: { temperature: 12, condition: '晴', humidity: 45 },
    上海: { temperature: 18, condition: '多云', humidity: 65 },
    广州: { temperature: 26, condition: '小雨', humidity: 80 },
    深圳: { temperature: 27, condition: '晴', humidity: 70 },
    杭州: { temperature: 20, condition: '阴', humidity: 72 },
    成都: { temperature: 22, condition: '小雨', humidity: 78 },
  }
  const data = mockData[city]
  if (!data) {
    return {
      error: `暂未收录「${city}」的天气数据，目前支持：${Object.keys(mockData).join('、')}`,
    }
  }
  return {
    city,
    temperature: data.temperature,
    condition: data.condition,
    humidity: data.humidity,
    unit: 'celsius',
  }
}

// ============================================================
// 工具注册表：name → 实现函数
// ============================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ToolFn = (args: any) => unknown

export const TOOL_IMPL: Record<string, ToolFn> = {
  get_current_time,
  calculator,
  get_weather,
}

// ============================================================
// 工具 Schema：告诉 LLM 你有哪些工具、怎么用
// ============================================================
// 这是 OpenAI 的 Function Calling 标准格式
// DeepSeek、通义千问、智谱 GLM 都完全兼容

export const TOOLS_SCHEMA = [
  {
    type: 'function' as const,
    function: {
      name: 'get_current_time',
      description:
        '查询当前的真实时间（北京时间）。当用户问"现在几点"、"今天星期几"、"今天是几号"等时间相关问题时使用。',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'calculator',
      description:
        '执行精确的数学计算，支持加减乘除、括号、小数。当用户需要计算具体数字（如"1234+5678 等于多少"、"算一下 (10+20)×3"）时必须使用此工具，不要自己心算。',
      parameters: {
        type: 'object',
        properties: {
          expression: {
            type: 'string',
            description:
              '要计算的数学表达式，只能包含数字和 + - * / ( ) 符号，例如 "(12 * 2) + 5"',
          },
        },
        required: ['expression'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_weather',
      description:
        '查询指定城市当前的天气情况，包括温度、天气状况、湿度。当用户问某城市的天气时使用。',
      parameters: {
        type: 'object',
        properties: {
          city: {
            type: 'string',
            description: '城市的中文名称，例如 "北京"、"上海"',
          },
        },
        required: ['city'],
      },
    },
  },
]
