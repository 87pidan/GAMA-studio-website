@echo off
chcp 65001 >nul
echo 正在啟動網站預覽，關掉這個視窗就會停止。
start "" http://localhost:4173
npx --yes serve -l 4173 .
