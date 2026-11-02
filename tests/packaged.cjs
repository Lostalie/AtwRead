const { _electron: electron } = require('playwright');
const path = require('node:path');
const fs = require('node:fs/promises');
(async () => {
  const root = path.resolve(__dirname, '..');
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({ executablePath: path.join(root, 'release', 'AtwRead', 'AtwRead.exe'), args: [path.join(__dirname, 'fixtures', '阅读示例.md')], env });
  const page = await app.firstWindow(); page.setDefaultTimeout(20000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  try {
    await page.waitForFunction(() => document.querySelector('#document-title')?.textContent === '阅读示例.md');
    await page.waitForFunction(() => document.querySelector('#markdown img')?.naturalWidth === 600);
    await app.evaluate(({ BrowserWindow }, file) => BrowserWindow.getAllWindows()[0].webContents.send('open-request', file), path.join(__dirname, 'fixtures', '阅读示例.pdf'));
    await page.waitForFunction(() => document.querySelector('#pdf-viewer canvas')?.width > 0);
    await page.locator('#pdf-viewer .textLayer span').first().waitFor();
    await page.screenshot({ path: path.join(root, 'test-results', '05-packaged-pdf.png') });
    if (errors.length) throw new Error(errors.join('\n'));
    await fs.writeFile(path.join(root, 'test-results', 'packaged-result.json'), JSON.stringify({ passed: true, checks: ['standalone executable', 'command line open', 'asar local images', 'asar PDF worker', 'PDF text layer'], errors }, null, 2));
    console.log('PASS: packaged Windows executable opens Markdown, images and PDF with selectable text.');
  } finally { await app.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
