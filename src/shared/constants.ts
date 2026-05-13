// src/shared/constants.ts

import type { AppConfig } from './ipc-types.js'

export const APP_NAME = 'ONE'

export const DEFAULT_CONFIG: AppConfig = {
  baseUrl: 'http://localhost:3000',
  model: 'claude-3-5-sonnet',
  theme: 'system',
}

export const HEALTH_CHECK_INTERVAL_MS = 30000
export const HEALTH_CHECK_TIMEOUT_MS = 3000
export const MAX_FILE_SIZE_MB = 50
export const SUPPORTED_FILE_EXTENSIONS = ['.csv', '.xlsx', '.docx', '.pptx', '.md', '.txt']

export const DAY_ZERO_WELCOME = {
  content:
    '你好！我是你的专属 AI 办公助手。你可以直接将 Excel、Word 或 PDF 拖拽到这个窗口，或者试试点击下方的快捷指令：',
  pills: [
    { label: '📊 帮我分析并清洗 Excel 销售数据', prompt: '帮我分析并清洗 Excel 销售数据' },
    { label: '📝 将这份文本排版为标准公文格式', prompt: '将这份文本排版为标准公文格式' },
    { label: '📊 根据数据生成一份汇报 PPT', prompt: '根据数据生成一份汇报 PPT' },
  ],
}
