/**
 * Shared error handling for MCP tools
 */

import { z } from 'zod'
import { ApiError } from '../api-client.js'

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

  if (error instanceof ApiError) {
    return handleApiError(error)
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
 * Handle API-specific errors
 */
function handleApiError(error: ApiError): ToolResult {
  if (error.isNotFound()) {
    return {
      content: [
        {
          type: 'text',
          text: `Not found: ${error.details || error.message}`,
        },
      ],
      isError: true,
    }
  }

  if (error.isUnavailable()) {
    return {
      content: [
        {
          type: 'text',
          text: `Service unavailable: ${error.details || error.message}`,
        },
      ],
      isError: true,
    }
  }

  if (error.isRateLimitError()) {
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
        text: `API error: ${error.details || error.message}`,
      },
    ],
    isError: true,
  }
}
