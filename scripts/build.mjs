import { build } from 'esbuild';
import { mkdir, copyFile, cp } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
await build({ entryPoints: ['src/app.js'], bundle: true, format: 'esm', target: 'chrome140', outfile: 'dist/app.js', sourcemap: false, minify: true });
await Promise.all([
  copyFile('src/index.html', 'dist/index.html'),
  copyFile('src/style.css', 'dist/style.css'),
  copyFile('node_modules/pdfjs-dist/web/pdf_viewer.css', 'dist/pdf_viewer.css'),
  cp('node_modules/pdfjs-dist/web/images', 'dist/images', { recursive: true }),
  copyFile('node_modules/pdfjs-dist/build/pdf.worker.mjs', 'dist/pdf.worker.mjs'),
  cp('node_modules/pdfjs-dist/cmaps', 'dist/cmaps', { recursive: true }),
  cp('node_modules/pdfjs-dist/standard_fonts', 'dist/standard_fonts', { recursive: true }),
  cp('node_modules/pdfjs-dist/wasm', 'dist/wasm', { recursive: true }),
]);
console.log('AtwRead 构建完成。');
