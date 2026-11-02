from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from pypdf import PdfReader, PdfWriter

root = Path(__file__).resolve().parent / 'fixtures'
root.mkdir(exist_ok=True)
pdfmetrics.registerFont(UnicodeCIDFont('STSong-Light'))
c = canvas.Canvas(str(root / '阅读示例.pdf'), pagesize=(595, 842))
for i, title in enumerate(['欢迎使用 AtwRead', '给阅读留一点空间', '从一页开始'], 1):
    c.setFillColor(HexColor('#32634e'))
    c.setFont('Helvetica', 10)
    c.drawString(60, 780, 'ATWREAD / LOCAL READER')
    c.setFont('STSong-Light', 28)
    c.drawString(60, 708, title)
    c.bookmarkPage(f'page{i}')
    c.addOutlineEntry(title, f'page{i}', 0)
    c.setFont('STSong-Light', 13)
    c.setFillColor(HexColor('#596456'))
    lines = ['这是一份用于验证中文显示的 PDF 文档。', '你可以连续滚动阅读，也可以用顶部页码直接跳转。', '左侧目录帮助你定位章节，缩放按钮可以调整阅读大小。', '文字支持选择和复制；原始文件始终保持不变。']
    for j, line in enumerate(lines):
        c.drawString(60, 645 - j * 32, line)
    c.setStrokeColor(HexColor('#d9e0d3'))
    c.line(60, 105, 535, 105)
    c.setFont('Helvetica', 10)
    c.drawString(60, 80, 'PDF VIEWING / VERSION 0.1')
    c.drawRightString(535, 80, f'{i} / 3')
    c.showPage()
c.save()
writer = PdfWriter()
writer.append(PdfReader(root / '阅读示例.pdf'))
writer.encrypt('atw-test', algorithm='RC4-128')
writer.write(root / '加密.pdf')
(root / '损坏.pdf').write_text('not a valid pdf', encoding='utf-8')
(root / '本地 图片.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="130"><rect width="600" height="130" rx="12" fill="#e8eee0"/><text x="30" y="75" fill="#32634e" font-size="25">AtwRead · Local image</text></svg>', encoding='utf-8')
(root / '阅读示例.md').write_text('''# 阅读，是一段安静的旅程

> 让文字回到中心，让工具退到身后。

这是 **AtwRead** 的 Markdown 阅读示例。所有内容直接从本地文件加载。

## 从这里开始

你可以点击左侧的章节目录，也可以直接滚动阅读。

- 支持 **粗体**、*斜体* 和 `行内代码`
- 支持表格、引用、任务列表与代码块
- 支持文档目录中的本地图片

![本地示例图片](本地%20图片.svg)

## 一张小表格

| 格式 | 浏览方式 |
| --- | --- |
| PDF | 连续滚动、页码跳转、缩放 |
| Markdown | 排版阅读、章节目录、字号调整 |

## 一段代码

```javascript
const reading = { focus: true, pace: "slow" };
console.log("Enjoy your reading.");
```

- [x] 打开一份文档
- [ ] 留一点时间给自己

[回到开始](#从这里开始)

## Status

这个标题不应覆盖应用的状态栏。

## Password dialog

这个标题不应覆盖密码弹窗。

<script>window.__injected = true</script>
<img src="bad" onerror="window.__injected = true">
''', encoding='utf-8')
print('Created PDF, encrypted PDF, Markdown and image fixtures.')
