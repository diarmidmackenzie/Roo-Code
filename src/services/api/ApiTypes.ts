import { Anthropic } from "@anthropic-ai/sdk"
import { ApiConfiguration } from "../../shared/api"
import { TokenUsage } from "../../exports/roo-code"

export type ApiResponse = {
    content: string
    usage: TokenUsage
}

export type ApiStreamOptions = {
    previousApiReqIndex: number
    retryAttempt?: number
}

export type ApiMessageParam = Anthropic.MessageParam & { ts?: number }

export interface IApiService {
    initialize(config: ApiConfiguration): void
    handleApiRequest(options: ApiStreamOptions): AsyncGenerator<ApiResponse>
    updateConversationHistory(messages: ApiMessageParam[]): Promise<void>
    getConversationHistory(): Promise<ApiMessageParam[]>
} 