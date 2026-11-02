const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { kind, readDocument, resolveImage } = require('../electron/files.cjs');
test('file type checks are case-insensitive and reject unsupported files', () => {
  assert.equal(kind('说明.MD'), 'md'); assert.equal(kind('a.PDF'), 'pdf');
  assert.throws(() => kind('test.exe'), /仅支持/);
});
test('UTF-8 Chinese, BOM, empty documents, binary PDF, and missing files', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'atwread-test-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const md = path.join(dir, '中文 笔记.md');
  await fs.writeFile(md, '\uFEFF# 你好\n欢迎阅读');
  assert.equal((await readDocument(md)).data, '# 你好\n欢迎阅读');
  await fs.writeFile(md, ''); assert.equal((await readDocument(md)).data, '');
  const pdf = path.join(dir, 'test.pdf'); await fs.writeFile(pdf, Buffer.from([37, 80, 68, 70, 255]));
  assert.deepEqual([...((await readDocument(pdf)).data)], [37, 80, 68, 70, 255]);
  await assert.rejects(readDocument(path.join(dir, 'missing.md')), { code: 'ENOENT' });
  await assert.rejects(readDocument('relative.md'), /路径无效/);
});
test('images allow local assets and reject traversal and absolute paths before I/O', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'atwread-image-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  await fs.writeFile(path.join(dir, '图.png'), 'fixture');
  assert.equal(await resolveImage(dir, '图.png'), path.join(dir, '图.png'));
  await assert.rejects(resolveImage(dir, '../escape.png'), /目录内/);
  await assert.rejects(resolveImage(dir, '\\\\unreachable.invalid\\share\\image.png'), /相对路径/);
  await assert.rejects(resolveImage(dir, 'C:\\image.png'), /相对路径/);
  await fs.writeFile(path.join(dir, 'private.txt'), 'private');
  await assert.rejects(resolveImage(dir, 'private.txt'), /图片格式/);
});
