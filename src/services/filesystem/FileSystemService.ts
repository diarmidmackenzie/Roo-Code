import fs from "fs/promises"
import * as path from "path"
import { fileExistsAtPath } from "../../utils/fs"
import { getReadablePath } from "../../utils/path"

export interface IFileSystemService {
    readFile(filePath: string): Promise<string>
    writeFile(filePath: string, content: string): Promise<void>
    deleteFile(filePath: string): Promise<void>
    ensureDirectory(dirPath: string): Promise<void>
    exists(path: string): Promise<boolean>
    getReadablePath(filePath: string): string
}

export class FileSystemService implements IFileSystemService {
    constructor(private workspaceRoot: string) {}

    async readFile(filePath: string): Promise<string> {
        const absolutePath = this.resolveWorkspacePath(filePath)
        return fs.readFile(absolutePath, 'utf-8')
    }

    async writeFile(filePath: string, content: string): Promise<void> {
        const absolutePath = this.resolveWorkspacePath(filePath)
        await this.ensureDirectory(path.dirname(absolutePath))
        await fs.writeFile(absolutePath, content, 'utf-8')
    }

    async deleteFile(filePath: string): Promise<void> {
        const absolutePath = this.resolveWorkspacePath(filePath)
        if (await this.exists(absolutePath)) {
            await fs.unlink(absolutePath)
        }
    }

    async ensureDirectory(dirPath: string): Promise<void> {
        try {
            await fs.mkdir(dirPath, { recursive: true })
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
                throw error
            }
        }
    }

    async exists(path: string): Promise<boolean> {
        return fileExistsAtPath(path)
    }

    getReadablePath(filePath: string): string {
        return getReadablePath(filePath)
    }

    private resolveWorkspacePath(filePath: string): string {
        if (path.isAbsolute(filePath)) {
            return filePath
        }
        return path.resolve(this.workspaceRoot, filePath)
    }
} 