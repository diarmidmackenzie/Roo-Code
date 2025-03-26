import { Anthropic } from "@anthropic-ai/sdk"
import { ClineMessage } from "../../exports/roo-code"
import { ApiMessageWithMetadata } from "./MessageService"

export interface ConversationState {
    isStreaming: boolean
    isPaused: boolean
    isWaitingForResponse: boolean
    currentTaskId?: string
}

export interface MessageHistory {
    messages: ClineMessage[]
    apiMessages: ApiMessageWithMetadata[]
}

export interface IMessageService {
    // Core message handling
    addMessage(message: ClineMessage): Promise<void>
    updateMessage(message: Partial<ClineMessage> & { ts: number }): Promise<void>
    getMessages(taskId: string): Promise<ClineMessage[]>
    
    // API message handling
    addApiMessage(message: Anthropic.MessageParam): Promise<void>
    addApiMessages(messages: Anthropic.MessageParam[]): Promise<void>
    getApiMessages(taskId: string): Promise<Anthropic.MessageParam[]>
    saveApiMessages(historyPath: string): Promise<void>
    
    // State management
    getConversationState(taskId: string): ConversationState
    updateConversationState(taskId: string, state: Partial<ConversationState>): void
    
    // History management
    saveHistory(taskId: string): Promise<void>
    loadHistory(taskId: string): Promise<MessageHistory>
    saveMessages(messagesPath: string): Promise<void>
    addMessages(messages: ClineMessage[]): Promise<void>
    
    // Webview integration
    postStateToWebview(): Promise<void>

    // New Streaming Operations
    handlePartialMessage(taskId: string, message: ClineMessage, isComplete: boolean): Promise<void>
    updateStreamingState(taskId: string, isStreaming: boolean): Promise<void>
    
    // New Complex Operations
    deleteMessage(taskId: string, messageTs: number): Promise<void>
    deleteMessageAndSubsequent(taskId: string, messageTs: number): Promise<void>
    handleStreamInterruption(taskId: string, reason: string): Promise<void>
    restoreToCheckpoint(taskId: string, checkpointTs: number): Promise<void>
} 