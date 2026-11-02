const fs = require('node:fs/promises');
const path = require('node:path');
const asar = require('@electron/asar');
async function main() {
  const root = path.resolve(__dirname, '..');
  const output = path.join(root, 'release', 'AtwRead');
  const staging = path.join(root, '.package-app');
  const electronRoot = path.join(root, 'node_modules', 'electron', 'dist');
  await fs.mkdir(output, { recursive: true });
  await fs.mkdir(staging, { recursive: true });
  await fs.cp(electronRoot, output, { recursive: true, filter: src => path.basename(src) !== 'default_app.asar' });
  await fs.cp(path.join(root, 'electron'), path.join(staging, 'electron'), { recursive: true });
  await fs.cp(path.join(root, 'dist'), path.join(staging, 'dist'), { recursive: true });
  const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
  await fs.writeFile(path.join(staging, 'package.json'), JSON.stringify({ name: 'atwread', productName: 'AtwRead', version: pkg.version, main: 'electron/main.cjs' }, null, 2));
  await asar.createPackage(staging, path.join(output, 'resources', 'app.asar'));
  await fs.rename(path.join(output, 'electron.exe'), path.join(output, 'AtwRead.exe'));
  await fs.copyFile(path.join(root, 'README.md'), path.join(output, '使用说明.md'));
  const licenseFiles = ['dompurify/LICENSE', 'marked/LICENSE.md', 'pdfjs-dist/LICENSE'];
  let notices = 'AtwRead 第三方组件许可\nElectron / Chromium 许可见本目录 LICENSE 和 LICENSES.chromium.html。\n\n';
  for (const file of licenseFiles) notices += `\n===== ${file} =====\n${await fs.readFile(path.join(root, 'node_modules', file), 'utf8')}\n`;
  await fs.writeFile(path.join(output, 'THIRD-PARTY-NOTICES.txt'), notices);
  console.log(`Windows 便携版已生成：${output}`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
