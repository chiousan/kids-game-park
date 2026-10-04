# 小小遊戲樂園

給小朋友玩的無廣告小遊戲合集，共 15 款原創遊戲，以 iPad 觸控為主，舊款 iPad 也能順跑。

- 沒有廣告、沒有追蹤、沒有外部連結；遊戲紀錄只存在裝置本機
- 第一次開啟後會離線快取，沒有網路也能玩
- 已設定 `noindex`，不會被搜尋引擎收錄

## 遊戲清單

| 類別 | 遊戲 |
|---|---|
| 益智動腦 | 2048、寶石消消樂、方塊堆疊、動物翻翻樂、踩地雷 |
| 動作反應 | 貪食蛇、打磚塊、跳跳大冒險、太空射擊 |
| 競速運動 | 公路賽車、投籃高手、點球大戰 |
| 雙人對戰（也可對電腦） | 桌上冰球、五子棋、坦克對戰 |

每款都有簡單／普通／困難（雙人遊戲為雙人或對電腦）。

## 在 iPad 上使用

用 Safari 開啟網址 →「分享」→「加入主畫面」，之後就像 App 一樣全螢幕開啟。

## 技術說明

- 純 HTML + Canvas 2D + 原生 JavaScript（ES2017），不需要任何建置工具
- `js/engine.js`：共用引擎（迴圈、觸控、選單、音效合成、圖片載入）
- `js/games/<遊戲>.js`：各遊戲
- `assets/`：圖片素材（已壓縮，約 750 KB）
- `sw.js`：離線快取（內容變動後需重新產生版本號）

本機測試：在此資料夾執行 `python -m http.server`，再用瀏覽器開 `http://localhost:8000`。

## 素材授權

遊戲美術素材來自 [Kenney.nl](https://kenney.nl)，以 CC0（公眾領域）授權釋出：New Platformer Pack、Animal Pack Remastered、Space Shooter Remastered、Racing Pack、Puzzle Pack 1、Top-down Tanks Remastered、Boardgame Pack。籃球與足球圖示為本專案自繪。
