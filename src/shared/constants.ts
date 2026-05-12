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
    '你好！我是 ONE，你的专属 AI 助手。我可以帮你处理数据、撰写文档、生成报告。今天想从什么开始？',
  pills: [
    { label: '分析 Excel 数据', prompt: '帮我分析一份 Excel 数据文件' },
    { label: '撰写工作报告', prompt: '帮我撰写一份工作周报' },
    { label: '生成 PPT 大纲', prompt: '帮我生成一份季度汇报的 PPT 大纲' },
  ],
}
