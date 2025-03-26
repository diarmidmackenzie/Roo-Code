import { Anthropic } from "@anthropic-ai/sdk"
import { IFileSystemService } from "../filesystem/FileSystemService"
import { ConversationState, IMessageService, MessageHistory } from "./MessageTypes"
import * as path from "path"
import { ClineMessage } from "../../exports/roo-code"

export interface ApiMessageWithMetadata extends Anthropic.MessageParam {
    taskId?: string
    ts?: number
}

export class MessageService implements IMessageService {
    private static readonly HISTORY_FILENAME = "message-history.json"
    private static readonly DEFAULT_STATE: ConversationState = {
        isStreaming: false,
        isPaused: false,
        isWaitingForResponse: false
    }

    private messages: Map<string, ClineMessage[]> = new Map()
    private apiMessages: Map<string, ApiMessageWithMetadata[]> = new Map()
    private conversationStates: Map<string, ConversationState> = new Map()
    private activeTaskId?: string
    
    constructor(
        private readonly fileSystemService: IFileSystemService,
        private readonly workspaceRoot: string
    ) {}

    // Task Management
    private validateTaskId(taskId?: string): asserts taskId is string {
        if (!taskId) {
            throw new Error("No active task found")
        }
    }

    private getTaskMessages(taskId: string): ClineMessage[] {
        return this.messages.get(taskId) || []
    }

    private getTaskApiMessages(taskId: string): ApiMessageWithMetadata[] {
        return this.apiMessages.get(taskId) || []
    }

    // Message Management
    async addMessage(message: ClineMessage): Promise<void> {
        this.validateTaskId(this.activeTaskId)
        const messages = this.getTaskMessages(this.activeTaskId)
        messages.push(message)
        this.messages.set(this.activeTaskId, messages)
        await this.saveHistory(this.activeTaskId)
    }

    async updateMessage(message: Partial<ClineMessage> & { ts: number }): Promise<void> {
        this.validateTaskId(this.activeTaskId)
        const messages = this.getTaskMessages(this.activeTaskId)
        const index = messages.findIndex(m => m.ts === message.ts)
        
        if (index === -1) {
            return
        }

        messages[index] = { ...messages[index], ...message }
        this.messages.set(this.activeTaskId, messages)
        await this.saveHistory(this.activeTaskId)
    }

    async getMessages(taskId: string): Promise<ClineMessage[]> {
        if (!this.messages.has(taskId)) {
            const history = await this.loadHistory(taskId)
            this.messages.set(taskId, history.messages)
        }
        return this.getTaskMessages(taskId)
    }

    async addMessages(messages: ClineMessage[]): Promise<void> {
        this.validateTaskId(this.activeTaskId)
        const existingMessages = this.getTaskMessages(this.activeTaskId)
        this.messages.set(this.activeTaskId, [...existingMessages, ...messages])
        await this.saveHistory(this.activeTaskId)
    }

    // API Message Management
    async addApiMessage(message: Anthropic.MessageParam): Promise<void> {
        this.validateTaskId(this.activeTaskId)
        const messageWithMetadata: ApiMessageWithMetadata = {
            ...message,
            taskId: this.activeTaskId,
            ts: Date.now()
        }
        
        const messages = this.getTaskApiMessages(this.activeTaskId)
        messages.push(messageWithMetadata)
        this.apiMessages.set(this.activeTaskId, messages)
        await this.saveHistory(this.activeTaskId)
    }

    async addApiMessages(messages: Anthropic.MessageParam[]): Promise<void> {
        this.validateTaskId(this.activeTaskId)
        const existingMessages = this.getTaskApiMessages(this.activeTaskId)
        const newMessages = messages.map(message => ({
            ...message,
            taskId: this.activeTaskId,
            ts: Date.now()
        }))
        this.apiMessages.set(this.activeTaskId, [...existingMessages, ...newMessages])
        await this.saveHistory(this.activeTaskId)
    }

    async getApiMessages(taskId: string): Promise<Anthropic.MessageParam[]> {
        if (!this.apiMessages.has(taskId)) {
            const history = await this.loadHistory(taskId)
            this.apiMessages.set(taskId, history.apiMessages)
        }
        return this.getTaskApiMessages(taskId)
    }

    async saveApiMessages(historyPath: string): Promise<void> {
        this.validateTaskId(this.activeTaskId)
        const messages = this.getTaskApiMessages(this.activeTaskId)
        await this.fileSystemService.writeFile(
            historyPath,
            JSON.stringify(messages, null, 2)
        )
    }

    // State Management
    getConversationState(taskId: string): ConversationState {
        if (!this.conversationStates.has(taskId)) {
            this.conversationStates.set(taskId, {
                ...MessageService.DEFAULT_STATE,
                currentTaskId: taskId
            })
        }
        return this.conversationStates.get(taskId)!
    }

    updateConversationState(taskId: string, state: Partial<ConversationState>): void {
        const currentState = this.getConversationState(taskId)
        this.conversationStates.set(taskId, { ...currentState, ...state })
    }

    // History Management
    async saveHistory(taskId: string): Promise<void> {
        const taskDir = await this.ensureTaskDirectory(taskId)
        const history: MessageHistory = {
            messages: this.getTaskMessages(taskId),
            apiMessages: this.getTaskApiMessages(taskId)
        }
        await this.fileSystemService.writeFile(
            path.join(taskDir, MessageService.HISTORY_FILENAME),
            JSON.stringify(history, null, 2)
        )
    }

    async loadHistory(taskId: string): Promise<MessageHistory> {
        const taskDir = await this.ensureTaskDirectory(taskId)
        const historyPath = path.join(taskDir, MessageService.HISTORY_FILENAME)
        
        if (await this.fileSystemService.exists(historyPath)) {
            const content = await this.fileSystemService.readFile(historyPath)
            return JSON.parse(content)
        }
        
        return {
            messages: [],
            apiMessages: []
        }
    }

    async saveMessages(messagesPath: string): Promise<void> {
        this.validateTaskId(this.activeTaskId)
        const messages = this.getTaskMessages(this.activeTaskId)
        await this.fileSystemService.writeFile(
            messagesPath,
            JSON.stringify(messages, null, 2)
        )
    }

    // Webview Integration
    async postStateToWebview(): Promise<void> {
        // This is a placeholder implementation
        // The actual implementation would need to be provided by the webview integration layer
        return Promise.resolve()
    }

    // File System Operations
    private async ensureTaskDirectory(taskId: string): Promise<string> {
        const taskDir = path.join(this.workspaceRoot, ".roo", "tasks", taskId)
        await this.fileSystemService.ensureDirectory(taskDir)
        return taskDir
    }

    // Streaming Operations
    async handlePartialMessage(taskId: string, message: ClineMessage, isComplete: boolean): Promise<void> {
        const messages = this.getTaskMessages(taskId)
        const lastMessage = messages.at(-1)
        const isUpdatingPreviousPartial = lastMessage && 
            lastMessage.partial && 
            lastMessage.type === message.type && 
            ((message.type === "ask" && lastMessage.ask === message.ask) || 
             (message.type === "say" && lastMessage.say === message.say))

        if (!isComplete) {
            if (isUpdatingPreviousPartial) {
                // Update existing partial message
                await this.updateMessage({
                    ...lastMessage,
                    ...message,
                    partial: true
                })
            } else {
                // Add new partial message
                await this.addMessage({
                    ...message,
                    partial: true
                })
            }
        } else {
            if (isUpdatingPreviousPartial) {
                // Complete the partial message
                await this.updateMessage({
                    ...lastMessage,
                    ...message,
                    partial: false
                })
                await this.saveHistory(taskId)
            } else {
                // Add new complete message
                await this.addMessage({
                    ...message,
                    partial: false
                })
            }
        }
    }

    async updateStreamingState(taskId: string, isStreaming: boolean): Promise<void> {
        this.updateConversationState(taskId, { isStreaming })
    }

    // Complex Operations
    async deleteMessage(taskId: string, messageTs: number): Promise<void> {
        const messages = this.getTaskMessages(taskId)
        const apiMessages = this.getTaskApiMessages(taskId)
        
        const messageIndex = messages.findIndex(msg => msg.ts === messageTs)
        if (messageIndex === -1) return

        // Find the next user message
        const nextUserMessage = messages
            .slice(messageIndex + 1)
            .find(msg => msg.type === "say" && msg.say === "user_feedback")

        if (nextUserMessage) {
            const nextUserMessageIndex = messages.findIndex(msg => msg === nextUserMessage)
            // Keep messages before current message and after next user message
            this.messages.set(taskId, [
                ...messages.slice(0, messageIndex),
                ...messages.slice(nextUserMessageIndex)
            ])

            // Handle API messages
            if (nextUserMessage.ts) {
                this.apiMessages.set(taskId, [
                    ...apiMessages.slice(0, messageIndex),
                    ...apiMessages.filter(msg => msg.ts && msg.ts >= nextUserMessage.ts)
                ])
            }
        } else {
            // If no next user message, keep only messages before current message
            this.messages.set(taskId, messages.slice(0, messageIndex))
            this.apiMessages.set(taskId, apiMessages.slice(0, messageIndex))
        }

        await this.saveHistory(taskId)
    }

    async deleteMessageAndSubsequent(taskId: string, messageTs: number): Promise<void> {
        const messages = this.getTaskMessages(taskId)
        const apiMessages = this.getTaskApiMessages(taskId)
        
        const messageIndex = messages.findIndex(msg => msg.ts === messageTs)
        if (messageIndex === -1) return

        // Delete this message and all that follow
        this.messages.set(taskId, messages.slice(0, messageIndex))
        this.apiMessages.set(taskId, apiMessages.slice(0, messageIndex))

        await this.saveHistory(taskId)
    }

    async handleStreamInterruption(taskId: string, reason: string): Promise<void> {
        const messages = this.getTaskMessages(taskId)
        const lastMessage = messages.at(-1)

        if (lastMessage?.partial) {
            await this.updateMessage({
                ...lastMessage,
                partial: false
            })
        }

        // Add interruption note to API conversation
        await this.addApiMessage({
            role: "assistant",
            content: [
                {
                    type: "text",
                    text: `[Response interrupted: ${reason}]`
                }
            ]
        })

        await this.saveHistory(taskId)
    }

    async restoreToCheckpoint(taskId: string, checkpointTs: number): Promise<void> {
        const messages = this.getTaskMessages(taskId)
        const apiMessages = this.getTaskApiMessages(taskId)
        
        const index = messages.findIndex(m => m.ts === checkpointTs)
        if (index === -1) return

        // Restore messages up to checkpoint
        this.messages.set(taskId, messages.slice(0, index + 1))
        this.apiMessages.set(taskId, apiMessages.filter(m => !m.ts || m.ts < checkpointTs))

        await this.saveHistory(taskId)
    }
} 