/**
 * MCP Server Logging
 *
 * Simple console-based logging for the MCP server.
 * Uses stderr to avoid interfering with stdio MCP transport (stdout must be pure JSON-RPC).
 */

import { env } from './config.js'

// Check if running in stdio mode
const isStdioMode = process.argv.includes('--stdio')
const isDev = env.server.nodeEnv === 'development' && !isStdioMode

const levels = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
  fatal: 5,
  silent: 6,
} as const

type LogLevel = keyof typeof levels
type LogData = Record<string, unknown>

function createLogger(bindings: LogData = {}) {
  const configuredLevel = env.logging.level as LogLevel
  const shouldLog = (level: LogLevel) => levels[level] >= levels[configuredLevel]

  const formatLog = (level: LogLevel, data: LogData, msg: string) => {
    const timestamp = new Date().toISOString()
    const merged = { ...bindings, ...data }

    if (isDev) {
      const prefix = Object.keys(merged).length ? `${JSON.stringify(merged)} ` : ''
      return `${timestamp} [${level.toUpperCase()}] ${prefix}${msg}`
    }
    return JSON.stringify({ level, time: timestamp, msg, ...merged })
  }

  const log = (level: LogLevel, dataOrMsg: LogData | string, msg?: string) => {
    if (!shouldLog(level)) return

    let data: LogData
    let message: string

    if (typeof dataOrMsg === 'string') {
      data = {}
      message = dataOrMsg
    } else {
      data = dataOrMsg
      message = msg ?? ''
    }

    // biome-ignore lint/suspicious/noConsole: Logger must use console.error for MCP stdio transport
    console.error(formatLog(level, data, message))
  }

  return {
    trace: (dataOrMsg: LogData | string, msg?: string) => log('trace', dataOrMsg, msg),
    debug: (dataOrMsg: LogData | string, msg?: string) => log('debug', dataOrMsg, msg),
    info: (dataOrMsg: LogData | string, msg?: string) => log('info', dataOrMsg, msg),
    warn: (dataOrMsg: LogData | string, msg?: string) => log('warn', dataOrMsg, msg),
    error: (dataOrMsg: LogData | string, msg?: string) => log('error', dataOrMsg, msg),
    fatal: (dataOrMsg: LogData | string, msg?: string) => log('fatal', dataOrMsg, msg),
    child: (childBindings: LogData) => createLogger({ ...bindings, ...childBindings }),
  }
}

export const logger = createLogger()
export { createLogger }
