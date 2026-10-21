@echo off
chcp 65001 >nul
title 消防水喷淋系统 · 三维可视化教学系统
cd /d "%~dp0"

echo ==============================================================
echo   消防水喷淋系统 · 三维可视化教学系统
echo ==============================================================
echo.

where python >nul 2>nul
if %errorlevel%==0 (
    echo   正在启动本地服务器...
    python serve.py 8080
    goto :eof
)

where python3 >nul 2>nul
if %errorlevel%==0 (
    echo   正在启动本地服务器...
    python3 serve.py 8080
    goto :eof
)

where npx >nul 2>nul
if %errorlevel%==0 (
    echo   未检测到 Python，改用 Node 静态服务器...
    npx --yes serve -l 8080 .
    goto :eof
)

echo.
echo   [!] 未找到 Python 或 Node.js。
echo       请任选一种方式打开：
echo       1) 安装 Python 后双击本文件
echo       2) 在 PowerShell 中执行： python -m http.server 8080
echo       3) 用 VS Code 的 Live Server 插件打开 index.html
echo.
echo   注意：直接双击 index.html 无法运行（浏览器禁止 file:// 加载 ES Module）。
echo.
pause
