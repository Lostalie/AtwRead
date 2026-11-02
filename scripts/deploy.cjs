const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
async function main() {
  const root = path.resolve(__dirname, '..');
  const release = path.join(root, 'release', 'AtwRead');
  const exe = path.join(release, 'AtwRead.exe');
  await fs.access(exe);
  await fs.access(path.join(release, 'resources', 'app.asar'));
  const manifest = [];
  async function walk(folder) {
    for (const entry of await fs.readdir(folder, { withFileTypes: true })) {
      const file = path.join(folder, entry.name);
      if (entry.isDirectory()) await walk(file);
      else if (entry.isFile()) {
        const bytes = await fs.readFile(file);
        manifest.push({ path: path.relative(release, file).split(path.sep).join('/'), bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') });
      }
    }
  }
  await walk(release);
  manifest.sort((a,b) => a.path.localeCompare(b.path));
  await fs.writeFile(path.join(root, 'release', 'manifest.json'), JSON.stringify(manifest, null, 2));
  if (process.platform === 'win32') {
    const quote = value => `'${value.replace(/'/g, "''")}'`;
    const shortcut = path.join(root, '启动 AtwRead.lnk');
    const command = `$ErrorActionPreference='Stop'; $shell=New-Object -ComObject WScript.Shell; $shortcut=$shell.CreateShortcut(${quote(shortcut)}); $shortcut.TargetPath=${quote(exe)}; $shortcut.WorkingDirectory=${quote(release)}; $shortcut.IconLocation=${quote(exe + ',0')}; $shortcut.Description='AtwRead - Local PDF and Markdown reader'; $shortcut.Save()`;
    execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { windowsHide: true, stdio: 'pipe' });
    console.log(`启动入口：${shortcut}`);
  }
  console.log(`发布目录：${release}`);
  console.log(`已生成 ${manifest.length} 个文件的 SHA256 校验清单。`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
