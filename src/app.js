import * as pdfjs from 'pdfjs-dist/build/pdf.mjs';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
globalThis.pdfjsLib = pdfjs;
const { EventBus, PDFViewer, PDFLinkService } = await import('pdfjs-dist/web/pdf_viewer.mjs');
pdfjs.GlobalWorkerOptions.workerSrc = 'atw://app/pdf.worker.mjs';
const $ = id => document.getElementById(id);
const events = new EventBus();
const links = new PDFLinkService({ eventBus: events, externalLinkEnabled: false });
links.externalLinkEnabled = false;
const viewer = new PDFViewer({ container: $('pdf-container'), viewer: $('pdf-viewer'), eventBus: events, linkService: links,
  textLayerMode: 1, annotationMode: pdfjs.AnnotationMode.ENABLE, imageResourcesPath: 'atw://app/images/', maxCanvasPixels: 16777216 });
links.setViewer(viewer);
let current = null;
let loadTask = null;
let requestId = 0;
let selectionId = 0;
let mdZoom = 1;
let recent = [];
let toastTimeout;
let passwordCallback;
let passwordCancel;
let headingObserver;
function toast(message) {
  clearTimeout(toastTimeout);
  $('toast').textContent = message;
  $('toast').hidden = false;
  toastTimeout = setTimeout(() => { $('toast').hidden = true; }, 5500);
}
function tab(name) {
  $('outline').hidden = name !== 'outline';
  $('recent').hidden = name !== 'recent';
  $('outline-tab').classList.toggle('active', name === 'outline');
  $('recent-tab').classList.toggle('active', name === 'recent');
}
function emptyOutline(message) {
  $('outline').replaceChildren();
  const p = document.createElement('p'); p.className = 'side-empty'; p.textContent = message;
  $('outline').append(p);
}
function updateRecents(items) {
  recent = items;
  $('recent').replaceChildren();
  $('home-recent-list').replaceChildren();
  $('home-recent').hidden = !items.length;
  if (!items.length) {
    const p = document.createElement('p'); p.className = 'side-empty'; p.textContent = '还没有阅读记录。'; $('recent').append(p);
  }
  items.forEach((item, index) => {
    const button = document.createElement('button');
    button.textContent = item.name;
    button.title = item.path;
    button.classList.toggle('selected', current?.path === item.path);
    const small = document.createElement('small'); small.textContent = item.type === 'pdf' ? 'PDF 文档' : 'Markdown'; button.append(small);
    button.onclick = () => openFile(item.path);
    $('recent').append(button);
    if (index < 3) {
      const home = document.createElement('button');
      const name = document.createElement('span'); name.textContent = item.name;
      const type = document.createElement('small'); type.textContent = item.type.toUpperCase();
      home.append(name, type); home.onclick = () => openFile(item.path); home.title = item.path;
      $('home-recent-list').append(home);
    }
  });
}
function setZoomOptions(isPdf) {
  $('zoom').querySelector('[value="page-width"]').hidden = !isPdf;
  $('zoom').querySelector('[value="page-fit"]').hidden = !isPdf;
}
function showDocument(doc) {
  current = doc;
  $('welcome').hidden = true;
  $('reading').hidden = false;
  $('controls').hidden = false;
  $('page-controls').hidden = doc.type !== 'pdf';
  $('pdf-container').hidden = doc.type !== 'pdf';
  $('md-container').hidden = doc.type !== 'md';
  $('document-title').textContent = doc.name;
  $('document-title').title = doc.path;
  $('document-subtitle').textContent = doc.type === 'pdf' ? 'PDF 文档' : 'Markdown 文档';
  document.title = `${doc.name} — AtwRead`;
  $('status').textContent = doc.path;
  setZoomOptions(doc.type === 'pdf');
  updateRecents(recent);
  tab('outline');
}
function closePassword() {
  if ($('password-dialog').open) $('password-dialog').close();
  $('password').value = '';
  passwordCallback = null;
  passwordCancel = null;
}
async function disposePdf() {
  closePassword();
  viewer.setDocument(null);
  links.setDocument(null);
  const old = loadTask; loadTask = null;
  if (old) await old.destroy().catch(() => {});
}
function showHome() {
  current = null;
  $('welcome').hidden = false;
  $('reading').hidden = true;
  $('controls').hidden = true;
  $('document-title').textContent = '阅读，从这里开始';
  $('document-subtitle').textContent = '你的文档，你的阅读空间';
  $('status').textContent = '准备就绪'; $('progress').textContent = 'PDF & MARKDOWN';
  document.title = 'AtwRead';
  emptyOutline('打开文档后，在这里浏览它的章节。');
  updateRecents(recent);
}
async function openFile(file) {
  const selection = ++selectionId;
  let result;
  try { result = await window.reader.open(file); }
  catch { toast('文件读取失败，请重试。'); return; }
  if (selection !== selectionId || result.canceled) return;
  if (!result.ok) { toast(result.error); return; }
  const id = ++requestId;
  headingObserver?.disconnect();
  await disposePdf();
  if (id !== requestId) return;
  recent = result.recent;
  const doc = result.document;
  $('status').textContent = '正在打开文档…';
  try {
    if (doc.type === 'md') {
      renderMarkdown(doc);
      showDocument(doc);
      $('md-container').scrollTop = 0;
      updateMdProgress();
    } else {
      const task = pdfjs.getDocument({ data: doc.data, cMapUrl: 'atw://app/cmaps/', cMapPacked: true,
        standardFontDataUrl: 'atw://app/standard_fonts/', wasmUrl: 'atw://app/wasm/', isEvalSupported: false, enableXfa: false });
      loadTask = task;
      task.onPassword = (callback, reason) => {
        if (id !== requestId) return;
        $('password-message').textContent = reason === pdfjs.PasswordResponses.INCORRECT_PASSWORD ? '密码不正确，请重新输入。' : '输入密码后继续阅读。';
        passwordCallback = callback;
        passwordCancel = () => { ++requestId; void disposePdf(); showHome(); toast('已取消打开加密 PDF。'); };
        $('password').value = '';
        if (!$('password-dialog').open) $('password-dialog').showModal();
        $('password').focus();
      };
      const pdf = await task.promise;
      if (id !== requestId) return;
      closePassword();
      showDocument(doc);
      $('page-total').textContent = `/ ${pdf.numPages}`;
      $('page-number').max = String(pdf.numPages);
      links.setDocument(pdf);
      viewer.setDocument(pdf);
      renderPdfOutline(await pdf.getOutline(), id);
    }
  } catch (error) {
    if (id !== requestId) return;
    await disposePdf();
    if (id !== requestId) return;
    showHome();
    toast(error.name === 'InvalidPDFException' ? '这份 PDF 已损坏或格式无效，无法读取。' : '无法显示文档，请确认文件内容完整。');
    console.error('Document load failed:', error.name, error.message);
  }
}
function renderMarkdown(doc) {
  const clean = DOMPurify.sanitize(marked.parse(doc.data, { gfm: true, breaks: false }), {
    FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'form', 'button', 'video', 'audio'],
    FORBID_ATTR: ['style', 'srcset', 'name', 'id', 'autofocus'], ALLOW_DATA_ATTR: false
  });
  $('markdown').innerHTML = clean;
  $('markdown').querySelectorAll('img').forEach(img => {
    const src = img.getAttribute('src') || '';
    if (/^data:image\/(png|jpeg|gif|webp);/i.test(src)) return;
    if (/^[a-z][a-z\d+.-]*:|^[\\/]/i.test(src)) {
      img.removeAttribute('src'); img.alt = img.alt ? `[外部图片] ${img.alt}` : '[外部图片不加载]';
      return;
    }
    // Keep relative images inside the document directory; main process checks real paths.
    img.src = doc.baseUrl + src.split('/').map(part => encodeURIComponent(decodeSafe(part))).join('/');
    img.loading = 'lazy';
  });
  $('markdown').querySelectorAll('input').forEach(input => { input.disabled = true; });
  $('outline').replaceChildren();
  const used = new Set();
  const headings = [...$('markdown').querySelectorAll('h1,h2,h3,h4,h5,h6')];
  for (const [index, heading] of headings.entries()) {
    const base = heading.textContent.trim().toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s+/g, '-') || `section-${index}`;
    let slug = base; let n = 1;
    while (used.has(slug)) slug = `${base}-${n++}`;
    used.add(slug); heading.id = `md-heading-${index}`; heading.dataset.slug = slug;
    const button = document.createElement('button'); button.textContent = heading.textContent;
    button.title = heading.textContent; button.dataset.heading = heading.id;
    button.style.paddingLeft = `${10 + Math.max(0, Number(heading.tagName[1]) - 1) * 12}px`;
    button.onclick = () => { heading.scrollIntoView({ block: 'start' }); selectHeading(heading.id); };
    $('outline').append(button);
  }
  if (!headings.length) emptyOutline('这份文档没有标题，可直接滚动阅读。');
  headingObserver = new IntersectionObserver(entries => {
    const visible = entries.filter(entry => entry.isIntersecting).sort((a,b) => a.boundingClientRect.top - b.boundingClientRect.top);
    if (visible.length) selectHeading(visible[0].target.id);
  }, { root: $('md-container'), rootMargin: '0px 0px -65% 0px' });
  headings.forEach(heading => headingObserver.observe(heading));
  mdZoom = 1; $('markdown').style.setProperty('--md-size', '16px'); $('zoom').value = '1';
}
function decodeSafe(value) { try { return decodeURIComponent(value); } catch { return value; } }
function selectHeading(id) {
  $('outline').querySelectorAll('button').forEach(button => button.classList.toggle('selected', button.dataset.heading === id));
}
function renderPdfOutline(items, id) {
  if (id !== requestId) return;
  $('outline').replaceChildren();
  if (!items?.length) { emptyOutline('这份 PDF 没有内置目录，可使用页码跳转。'); return; }
  let count = 0;
  function append(entries, depth) {
    for (const item of entries) {
      if (++count > 5000) return;
      const button = document.createElement('button'); button.textContent = item.title || '未命名章节'; button.title = item.title;
      button.style.paddingLeft = `${10 + Math.min(depth, 5) * 12}px`;
      button.onclick = () => {
        if (!item.dest) { toast('此目录项没有可跳转的本地页面。'); return; }
        Promise.resolve(links.goToDestination(item.dest)).catch(() => toast('无法跳转到这个章节。'));
        $('outline').querySelectorAll('button').forEach(b => b.classList.toggle('selected', b === button));
      };
      $('outline').append(button);
      if (item.items?.length && depth < 30) append(item.items, depth + 1);
    }
  }
  append(items, 0);
}
function syncPdfPage() {
  if (current?.type !== 'pdf') return;
  $('page-number').value = String(viewer.currentPageNumber);
  $('prev').disabled = viewer.currentPageNumber <= 1;
  $('next').disabled = viewer.currentPageNumber >= viewer.pagesCount;
  $('progress').textContent = `第 ${viewer.currentPageNumber} / ${viewer.pagesCount} 页`;
}
function syncZoom(value) {
  const select = $('zoom');
  select.querySelector('[data-custom]')?.remove();
  const key = String(value);
  if (![...select.options].some(option => option.value === key)) {
    const option = new Option(`${Math.round(Number(value) * 100)}%`, key); option.dataset.custom = 'true'; select.add(option);
  }
  select.value = key;
}
function zoomBy(amount) {
  if (!current) return;
  if (current.type === 'pdf') viewer.currentScale = Math.max(.25, Math.min(4, viewer.currentScale + amount));
  else {
    mdZoom = Math.round(Math.max(.75, Math.min(2, mdZoom + amount)) * 100) / 100;
    $('markdown').style.setProperty('--md-size', `${16 * mdZoom}px`); syncZoom(mdZoom); updateMdProgress();
  }
}
function updateMdProgress() {
  if (current?.type !== 'md') return;
  const el = $('md-container'); const total = el.scrollHeight - el.clientHeight;
  $('progress').textContent = total <= 1 ? '全文已显示' : `已读 ${Math.min(100, Math.round(el.scrollTop / total * 100))}%`;
}
events.on('pagesinit', () => { viewer.currentScaleValue = 'page-width'; syncPdfPage(); });
events.on('pagechanging', syncPdfPage);
events.on('scalechanging', event => syncZoom(event.presetValue || event.scale));
events.on('pagerendered', event => { if (event.error) toast('部分页面渲染失败，请尝试缩小后重试。'); });
$('open').onclick = () => openFile();
$('drop-card').onclick = () => openFile();
$('outline-tab').onclick = () => tab('outline');
$('recent-tab').onclick = () => tab('recent');
$('brand').onclick = () => { ++requestId; ++selectionId; headingObserver?.disconnect(); void disposePdf(); showHome(); };
$('toggle-sidebar').onclick = () => {
  const hidden = document.body.classList.toggle('sidebar-hidden'); $('toggle-sidebar').setAttribute('aria-expanded', String(!hidden));
};
$('prev').onclick = () => { if (viewer.currentPageNumber > 1) viewer.currentPageNumber--; };
$('next').onclick = () => { if (viewer.currentPageNumber < viewer.pagesCount) viewer.currentPageNumber++; };
function jumpPage() {
  if (current?.type !== 'pdf') return;
  const page = Number($('page-number').value);
  if (Number.isInteger(page) && page >= 1 && page <= viewer.pagesCount) viewer.currentPageNumber = page;
  else toast(`请输入 1 到 ${viewer.pagesCount} 之间的页码。`);
  syncPdfPage();
}
$('page-number').onchange = jumpPage;
$('page-number').onkeydown = e => { if (e.key === 'Enter') { jumpPage(); e.currentTarget.blur(); } };
$('zoom-in').onclick = () => zoomBy(.25);
$('zoom-out').onclick = () => zoomBy(-.25);
$('zoom').onchange = event => {
  if (current?.type === 'pdf') viewer.currentScaleValue = event.target.value;
  else { mdZoom = Number(event.target.value); $('markdown').style.setProperty('--md-size', `${16 * mdZoom}px`); updateMdProgress(); }
};
$('md-container').addEventListener('scroll', updateMdProgress, { passive: true });
new ResizeObserver(() => {
  if (current?.type === 'pdf' && ['page-width','page-fit'].includes(viewer.currentScaleValue)) viewer.currentScaleValue = viewer.currentScaleValue;
  updateMdProgress();
}).observe($('reading'));
$('markdown').addEventListener('click', event => {
  const anchor = event.target.closest('a'); if (!anchor) return;
  event.preventDefault();
  const href = anchor.getAttribute('href') || '';
  if (href.startsWith('#')) {
    const heading = [...$('markdown').querySelectorAll('[data-slug]')].find(el => el.dataset.slug === decodeSafe(href.slice(1)));
    if (heading) heading.scrollIntoView({ block: 'start' }); else toast('未找到对应章节。');
  } else toast('第一版仅浏览当前文档，暂不打开外部链接。');
});
$('pdf-container').addEventListener('click', event => {
  const anchor = event.target.closest('a');
  if (anchor && /^https?:|^mailto:/i.test(anchor.getAttribute('href') || '')) { event.preventDefault(); event.stopPropagation(); toast('第一版暂不打开外部链接。'); }
}, true);
$('password-form').onsubmit = event => { event.preventDefault(); const callback = passwordCallback; const password = $('password').value; closePassword(); callback?.(password); };
$('password-cancel').onclick = () => passwordCancel?.();
$('password-dialog').addEventListener('cancel', event => { event.preventDefault(); passwordCancel?.(); });
document.addEventListener('keydown', event => {
  if ($('password-dialog').open) return;
  if (event.ctrlKey || event.metaKey) {
    if (event.key.toLowerCase() === 'o') { event.preventDefault(); openFile(); }
    if (event.key.toLowerCase() === 'b') { event.preventDefault(); $('toggle-sidebar').click(); }
    if (['+', '=', '-'].includes(event.key)) { event.preventDefault(); zoomBy(event.key === '-' ? -.25 : .25); }
    if (event.key === '0') { event.preventDefault(); if (current?.type === 'pdf') viewer.currentScaleValue = 'page-width'; else { mdZoom = .75; zoomBy(.25); } }
  }
  if (current?.type === 'pdf' && !['INPUT','SELECT','TEXTAREA'].includes(event.target.tagName)) {
    if (event.key === 'ArrowLeft') { event.preventDefault(); $('prev').click(); }
    if (event.key === 'ArrowRight') { event.preventDefault(); $('next').click(); }
  }
});
let dragDepth = 0;
document.addEventListener('dragenter', event => { event.preventDefault(); if (event.dataTransfer.types.includes('Files')) { dragDepth++; $('drop-overlay').hidden = false; } });
document.addEventListener('dragover', event => { event.preventDefault(); if (event.dataTransfer.types.includes('Files')) event.dataTransfer.dropEffect = 'copy'; });
document.addEventListener('dragleave', event => { event.preventDefault(); dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) $('drop-overlay').hidden = true; });
document.addEventListener('drop', event => {
  event.preventDefault(); dragDepth = 0; $('drop-overlay').hidden = true;
  const files = [...event.dataTransfer.files];
  if (!files.length) return;
  if (files.length > 1) toast('一次阅读一份文档，已打开第一个文件。');
  const file = window.reader.pathForFile(files[0]); if (file) openFile(file); else toast('请拖入本地 PDF 或 Markdown 文件。');
});
window.addEventListener('blur', () => { dragDepth = 0; $('drop-overlay').hidden = true; });
window.reader.onOpen(openFile);
const initial = await window.reader.initialize(); updateRecents(initial.recent);
if (initial.file) openFile(initial.file);
