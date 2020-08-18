import { writeFileSync, statSync, readFileSync, unlink } from 'fs';
export function writeSync(filepath, content) {
    return writeFileSync(filepath, content);
}
export function readSync(filepath) {
    return readFileSync(filepath, 'utf-8');
}
export function fileExists(filePath) {
    try {
        return statSync(filePath).isFile();
    }
    catch (err) {
        return false;
    }
}
export function unlinkFile(filePath, cb) {
    unlink(filePath, cb);
}
//# sourceMappingURL=file-system.js.map