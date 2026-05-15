import { BrowserWindow, Menu, app } from 'electron'

import type { MenuAction } from '../src/shared/electron'

function broadcastMenuAction(action: MenuAction): void {
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  win?.webContents.send('app:menu-action', action)
}

export function setupApplicationMenu(): void {
  const isMac = process.platform === 'darwin'
  const dev = Boolean(process.env.VITE_DEV_SERVER_URL)

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' },
            ],
          } satisfies Electron.MenuItemConstructorOptions,
        ]
      : []),
    {
      label: '文件',
      submenu: [
        {
          label: '返回列表',
          accelerator: 'CmdOrCtrl+Escape',
          click: () => broadcastMenuAction('back-to-list'),
        },
        { type: 'separator' },
        { label: '保存', accelerator: 'CmdOrCtrl+S', click: () => broadcastMenuAction('save') },
        { label: '打印…', accelerator: 'CmdOrCtrl+P', click: () => broadcastMenuAction('print') },
        {
          label: '导出 PDF…',
          accelerator: 'CmdOrCtrl+Shift+E',
          click: () => broadcastMenuAction('export-pdf'),
        },
        { type: 'separator' },
        { label: '导出 JSON 备份…', click: () => broadcastMenuAction('export-backup') },
        { label: '从 JSON 恢复…', click: () => broadcastMenuAction('import-backup') },
        ...(isMac
          ? ([
              { type: 'separator' },
              { role: 'close' },
            ] as Electron.MenuItemConstructorOptions[])
          : ([
              { type: 'separator' },
              { role: 'quit' },
            ] as Electron.MenuItemConstructorOptions[])),
      ],
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'pasteAndMatchStyle' },
        { type: 'separator' },
        { role: 'selectAll' },
      ],
    },
    {
      label: '视图',
      submenu: dev
        ? [
            { role: 'reload' },
            { role: 'forceReload' },
            { role: 'toggleDevTools' },
            { type: 'separator' },
            { role: 'resetZoom' },
            { role: 'zoomIn' },
            { role: 'zoomOut' },
            { type: 'separator' },
            { role: 'togglefullscreen' },
          ]
        : [{ role: 'togglefullscreen' }],
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '快捷键说明…',
          accelerator: 'CmdOrCtrl+/',
          click: () => broadcastMenuAction('shortcuts-help'),
        },
      ],
    },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
