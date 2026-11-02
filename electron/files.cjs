const fs = require('node:fs/promises');
const path = require('node:path');
const TYPES = new Set(['.pdf', '.md', '.markdown']);
const MAX_SIZE = 250 * 1024 * 1024;
function kind(file) {
  const ext = path.extname(file).toLowerCase();
  if (!TYPES.has(ext)) throw new Error('仅支持 PDF、MD 和 Markdown 文件。');
  return ext === '.pdf' ? 'pdf' : 'md';
}
async function readDocument(file) {
  if (typeof file !== 'string' || !path.isAbsolute(file)) throw new Error('文件路径无效。');
  const type = kind(file);
  const actual = await fs.realpath(file);
  const stat = await fs.stat(actual);
  if (!stat.isFile()) throw new Error('请选择一个文件。');
  if (stat.size > MAX_SIZE) throw new Error('第一版支持最大 250 MB 的文件。');
  const bytes = await fs.readFile(actual);
  return { path: actual, name: path.basename(actual), type, size: stat.size,
    data: type === 'pdf' ? new Uint8Array(bytes) : bytes.toString('utf8').replace(/^\uFEFF/, '') };
}
async function resolveImage(root, relative) {
  if (path.isAbsolute(relative) || relative.includes(':')) throw new Error('图片路径必须是相对路径。');
  const lexical = path.resolve(root, relative);
  const lexicalRelative = path.relative(root, lexical);
  if (lexicalRelative.startsWith('..') || path.isAbsolute(lexicalRelative)) throw new Error('图片不在文档目录内。');
  const candidate = await fs.realpath(lexical);
  const rel = path.relative(root, candidate);
  if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('图片不在文档目录内。');
  if (!/\.(png|jpe?g|gif|webp|bmp|avif|svg)$/i.test(candidate)) throw new Error('不支持的图片格式。');
  return candidate;
}
module.exports = { kind, readDocument, resolveImage };
