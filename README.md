# 🎾 テニスコート空き確認ボット

**都営5コート・豊島区3コート・墨田区6コート** を毎日自動チェックし、
**平日18時以降**の空きが見つかったら **LINE** に通知します。

---

## チェック対象コート

### 都営スポレク（5施設）
| 公園名 | 施設ID |
|--------|--------|
| 猿江恩賜公園 | 0121 |
| 光が丘公園 | 0107 |
| 有明テニスの森 | 0103 |
| 日比谷公園 | 0106 |
| 芝公園 | 0108 |

### 豊島区（3施設）
- 総合体育場（オムニ4面・ナイターあり）
- 西巣鴨体育場（ハード2面）
- 三芳グランド（オムニ6面・ナイターあり）

### 墨田区（6施設）
- 錦糸公園 / 緑町公園 / 大横川親水公園
- 堤通公園 / 文花 / 東墨田

---

## セットアップ手順

### 1. リポジトリを Fork / Clone

```bash
git clone https://github.com/あなたのユーザー名/tennis-court-checker.git
cd tennis-court-checker
npm install
```

### 2. LINE Notify トークンを取得

1. [LINE Notify](https://notify-bot.line.me/ja/) にアクセス
2. ログイン → 「マイページ」→「トークンを発行する」
3. トークン名（例：`テニス空き通知`）を入力して発行

### 3. GitHub Secrets に登録

Settings → Secrets and variables → Actions から登録：

| Secret名 | 値 | 必須 |
|----------|----|------|
| `LINE_TOKEN` | LINE Notify のトークン | ✅ |
| `SPOREC_ID` | スポレクのログインID | 都営チェック時 |
| `SPOREC_PW` | スポレクのパスワード | 都営チェック時 |
| `TOSHIMA_ID` | 豊島区予約システムのID | 豊島チェック時 |
| `TOSHIMA_PW` | 豊島区予約システムのPW | 豊島チェック時 |
| `SUMIDA_ID` | 墨田区予約システムのID | 墨田チェック時 |
| `SUMIDA_PW` | 墨田区予約システムのPW | 墨田チェック時 |

> **ヒント**: ID/PWが未設定のシステムは自動的にスキップされます。使いたいシステムだけ設定すればOKです。

### 4. Actions を有効化

リポジトリの **Actions タブ** → 「I understand my workflows...」をクリック。

---

## 実行スケジュール（JST・平日のみ）

| 時刻 | 内容 |
|------|------|
| 09:00 | 朝の先読みチェック（60日先まで） |
| 18:00〜21:30 | 30分おきにチェック |

月間消費：約 **990分** / 無料枠2,000分（約50%）✅

---

## ローカルでテスト

```bash
export LINE_TOKEN="..."
export SPOREC_ID="..."  SPOREC_PW="..."
export TOSHIMA_ID="..." TOSHIMA_PW="..."
export SUMIDA_ID="..."  SUMIDA_PW="..."
npm run check
```

---

## LINE通知サンプル

```
🎾 テニスコート空き情報
（平日18時以降）

▼ 都営スポレク
【有明テニスの森】2026-07-01（18:00・19:00）

▼ 豊島区
【豊島・総合体育場】2026-07-02（20:00）

▼ 墨田区
【墨田・錦糸公園】2026-07-03（18:30・19:00）

予約リンク:
都営: https://kouen.sports.metro.tokyo.lg.jp/web/
豊島: https://yoyaku.toshima.lg.jp
墨田: https://yoyaku03.city.sumida.lg.jp/user/Home
```

---

## 注意事項

- 各システムのページ構造が変わった場合、`src/checker.js` のセレクタ調整が必要になることがあります。
- **豊島区・墨田区の施設コード**は実際の予約システムにログインして確認し、`src/checker.js` の `facilityCode` を更新してください。
- 初回は必ず手動実行（Actions → Run workflow）で動作確認してから本運用を推奨します。
