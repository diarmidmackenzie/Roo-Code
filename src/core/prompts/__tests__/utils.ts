import * as fs from "fs/promises"
import { PathLike } from "fs"

// Make a path take a unix-like form.  Useful for making path comparisons.
export function unixLike(filePath: PathLike | fs.FileHandle) {
	return filePath.toString().split("\\").join("/")
}
