# AtwRead 0.1.0

Windows 本地 PDF / Markdown 阅读器。第一版专注浏览，文档在本机读取，无需服务端或登录，不修改原始文件。

## 使用

双击工程根目录的 **启动 AtwRead.lnk**，或打开 `release\AtwRead\AtwRead.exe`。这是便携版，不需要安装 Node.js；请保留程序旁的运行时文件，不要单独移动 exe。需要复制给其他电脑时，复制整个 `release\AtwRead` 文件夹即可。

- 点击「打开文件」，或按 `Ctrl+O` 选择 `.pdf`、`.md`、`.markdown`。
- 将本地文档拖入窗口，也可将文件拖到 AtwRead.exe 上打开。
- PDF 支持连续滚动、文字选择与复制、前后翻页、页码跳转、缩放、适合宽度/整页、内置目录，以及有密码文档的密码输入。
- Markdown 支持标题目录、段落、列表、引用、表格、任务列表、代码块、文内章节链接与本地图片；缩放可调整字号。
- 侧栏可切换文档目录与最近阅读，最多保留 12 条记录。

| 快捷键 | 功能 |
| --- | --- |
| Ctrl+O | 打开文档 |
| Ctrl+B | 显示/隐藏侧栏 |
| Ctrl++ / Ctrl+- | 放大/缩小 |
| Ctrl+0 | PDF 适合宽度；Markdown 恢复字号 |
| ← / → | PDF 上一页/下一页 |

## 当前范围

- 仅浏览，不含编辑、批注、搜索、书签、打印、导出、同步和文件关联设置。
- Markdown 使用 UTF-8 编码。支持文档所在目录及其子目录的相对图片路径；不读取目录以外的图片，不加载网络图片或外部链接。
- 单个文件上限 250 MB。复杂大文档的内存消耗仍取决于内容。
- Markdown 中的脚本、表单和可执行 HTML 会被移除；PDF 脚本不执行。
- 最近阅读的路径记录保存在 `%APPDATA%\AtwRead\recent.json`，原始文档不复制到应用中。

## 开发

工程根目录为 `D:\Tools\AtwRead`，可直接用编辑器打开此目录。技术栈为 Electron、PDF.js、Marked、DOMPurify；依赖版本锁定在 `package-lock.json`。界面和依赖全部打包到本地资源中。

```text
AtwRead/
├─ electron/             桌面窗口、文件访问与资源协议
├─ src/                  阅读界面源码
├─ scripts/              构建、打包、部署验证脚本
├─ tests/                测试与示例文档
├─ test-results/         验证结果与截图
├─ dist/                 前端构建产物
├─ release/
│  ├─ AtwRead/           独立运行目录（exe、运行库、资源）
│  └─ manifest.json      部署文件校验清单
├─ package.json
├─ package-lock.json
├─ README.md
└─ 启动 AtwRead.lnk       本机快捷启动入口
```

```powershell
npm ci
npm start
```

构建及验证：

```powershell
npm run build
npm test
npm run test:app
npm run package
npm run test:packaged
npm run deploy
```

`npm run package` 更新 `release\AtwRead`；`npm run deploy` 校验该目录、刷新 SHA256 清单并创建本机启动快捷方式。更新程序前请先关闭正在运行的 AtwRead。首次开发需执行 `npm ci` 安装开发依赖；直接使用发布程序不需要这一步。

`npm run test:app` 使用 `tests/fixtures` 内的文档，无需联网。可通过 Python（reportlab、pypdf）运行 `tests/fixtures.py` 重新生成测试样本。加密测试文档的密码为 `atw-test`，仅用于测试。

应用结构：`electron` 管理窗口、文件读取和资源协议；`src` 实现阅读界面；`scripts` 构建静态资源与 Windows 便携版；`tests` 验证文件边界与真实窗口中的阅读流程。后续版本可在此基础上增加功能。

## 验证记录

已通过文件类型、中文路径、UTF-8/BOM、缺失文件、目录越界等文件层测试，以及 Markdown 渲染/净化/本地图片/目录、PDF 中文渲染/文字层/翻页/缩放、密码重试/取消、损坏文档、快速切换、小窗口布局等 19 项应用检查。

另对打包后的独立程序验证命令行打开、Markdown 图片、PDF Worker 与文字层。截图和结果文件见 `test-results`。

第三方许可证随程序附带。Electron 的隔离与沙箱设计参考 [Electron 官方安全文档](https://www.electronjs.org/docs/latest/tutorial/security)，PDF 渲染采用 [Mozilla PDF.js](https://mozilla.github.io/pdf.js/)。
