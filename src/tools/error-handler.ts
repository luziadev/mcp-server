/**
 * Shared error handling for MCP tools
 */

import { LuziaError } from '@luziadev/sdk'
import { z } from 'zod'

export type ToolResult = {
  content: Array<{ type: 'text'; text: string }>
  isError?: boolean
}

/**
 * Handle errors from tool execution and return formatted error response
 */
export function handleToolError(error: unknown, toolName: string): ToolResult {
  if (error instanceof z.ZodError) {
    return {
      content: [
        {
          type: 'text',
          text: `Invalid input: ${error.errors.map((e) => e.message).join(', ')}`,
        },
      ],
      isError: true,
    }
  }

  if (error instanceof LuziaError) {
    return handleLuziaError(error)
  }

  return {
    content: [
      {
        type: 'text',
        text: `Error in ${toolName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
    ],
    isError: true,
  }
}

/**
 * Handle Luzia SDK errors
 */
function handleLuziaError(error: LuziaError): ToolResult {
  if (error.code === 'not_found') {
    return {
      content: [
        {
          type: 'text',
          text: `Not found: ${error.message}`,
        },
      ],
      isError: true,
    }
  }

  if (error.code === 'server') {
    return {
      content: [
        {
          type: 'text',
          text: `Service unavailable: ${error.message}`,
        },
      ],
      isError: true,
    }
  }

  if (error.code === 'rate_limit') {
    return {
      content: [
        {
          type: 'text',
          text: 'Rate limit exceeded. Please try again later.',
        },
      ],
      isError: true,
    }
  }

  return {
    content: [
      {
        type: 'text',
        text: `API error: ${error.message}`,
      },
    ],
    isError: true,
  }
}
