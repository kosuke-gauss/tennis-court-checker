const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const SPOREC_ID  = process.env.SPOREC_ID;
const SPOREC_PW  = process.env.SPOREC_PW;
const TOSHIMA_ID = process.env.TOSHIMA_ID;
const TOSHIMA_PW = process.env.TOSHIMA_PW;
const SUMIDA_ID  = process.env.SUMIDA_ID;
const SUMIDA_PW  = process.env.SUMIDA_PW;
const CHIYODA_ID = process.env.CHIYODA_ID;
const CHIYODA_PW = process.env.CHIYODA_PW;

const SPOREC_COURTS = [
  { name: "猿江恩賜公園",   id: "0121" },
  { name: "光が丘公園",     id: "0107" },
  { name: "有明テニスの森", id: "0103" },
  { name: "日比谷公園",     id: "0106" },
  { name: "芝公園",         id: "0108" },
];
const TOSHIMA_COURTS = [
  { name: "豊島・総合体育場",           facilityCode: "001" },
  { name: "豊島・西巣鴨体育場",         facilityCode: "002" },
  { name: "豊島・千早スポーツフィールド", facilityCode: "003" },
];
const SUMIDA_COURTS = [
  { name: "墨田・錦糸公園",       facilityCode: "TC01" },
  { name: "墨田・緑町公園",       facilityCode: "TC02" },
  { name: "墨田・大横川親水公園", facilityCode: "TC03" },
  { name: "墨田・堤通公園",       facilityCode: "TC04" },
  { name: "墨田・文花",           facilityCode: "TC05" },
  { name: "墨田・東墨田",         facilityCode: "TC06" },
];
const CHIYODA_COURTS = [
  { name: "千代田・外濠公園Aコート",  facilityCode: "A"  },
  { name: "千代田・外濠公園Bコート",  facilityCode: "B"  },
  { name: "千代田・外濠公園ABコート", facilityCode: "AB" },
];

const TARGET_SLOTS = ["18:00","18:30","19:00","19:30","20:00","20:30","21:00","21:30"];

function isWeekday(dateStr) {
  const d = new Date(dateStr + "T00:00:00+09:00");
  const day = d.getDay();
  return day !== 0 && day !== 6;
}

function getTargetDates(days = 60) {
  const dates = [];
  const today = new Date();
  for (let i = 0; i <= days; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const str = d.toISOString().split("T")[0];
    if (isWeekday(str)) dates.push(str);
  }
  return dates;
}

// ==========================================
// 都営スポレク
// ==========================================
async function checkSporec(browser, targetDates) {
  if (!SPOREC_ID || !SPOREC_PW) { console.log("[スポレク] 未設定 → スキップ"); return []; }
  console.log("[スポレク] 処理開始...");
  const BASE = "https://kouen.sports.metro.tokyo.lg.jp/web";
  const ctx = await browser.newContext({ userAgent: "Mozilla/5.0 Chrome/120" });
  const page = await ctx.newPage();
  const results = SPOREC_COURTS.map(c => ({ name: c.name, system: "都営スポレク", vacancies: [] }));
  
  try {
    await page.goto(`${BASE}/rsvWTransUserLogin.do`);
    await page.fill('input[name="userId"]', SPOREC_ID);
    await page.fill('input[name="password"]', SPOREC_PW);
    await page.click('input[type="submit"]');
    await page.waitForNavigation({ waitUntil: "networkidle" }).catch(() => {});
    
    if (page.url().toLowerCase().includes("login")) { console.error("[スポレク] ログイン失敗"); return results; }
    
    for (let i = 0; i < SPOREC_COURTS.length; i++) {
      const court = SPOREC_COURTS[i];
      for (const date of targetDates) {
        try {
          await page.goto(`${BASE}/rsvWTransRsvNewVacantSearch.do?facilityId=${court.id}&useDate=${date.replace(/-/g,"")}&sportDiv=2`, { waitUntil: "networkidle", timeout: 15000 });
          const slots = await page.evaluate((ts) => {
            const found = [];
            document.querySelectorAll("table tr").forEach((row) => {
              const tc = row.querySelector("td:first-child");
              if (!tc) return;
              const time = tc.textContent.trim();
              if (!ts.some(t => time.startsWith(t))) return;
              row.querySelectorAll("td").forEach(cell => {
                const txt = cell.textContent.trim();
                if (txt === "○" || txt === "空き" || txt === "空") found.push(time);
              });
            });
            return [...new Set(found)];
          }, TARGET_SLOTS);
          if (slots.length > 0) results[i].vacancies.push({ date, slots });
          await page.waitForTimeout(400);
        } catch(e) { console.warn(`⚠ [スポレク] ${court.name} ${date}: ${e.message}`); }
      }
    }
  } catch(e) { console.error(`❌ [スポレク] システムエラー: ${e.message}`); }
  finally { await ctx.close(); }
  return results;
}

// ==========================================
// 豊島区 (ログイン処理修正)
// ==========================================
async function checkToshima(browser, targetDates) {
  if (!TOSHIMA_ID || !TOSHIMA_PW) { console.log("[豊島区] 未設定 → スキップ"); return []; }
  console.log("[豊島区] 処理開始...");
  const BASE = "https://www2.pf489.com/toshima/WebR";
  const ctx = await browser.newContext({ userAgent: "Mozilla/5.0 Chrome/120" });
  const page = await ctx.newPage();
  const results = TOSHIMA_COURTS.map(c => ({ name: c.name, system: "豊島区", vacancies: [] }));
  
  try {
    // 1. トップ（モード選択）画面へ移動
    await page.goto(`${BASE}/Home/WgR_ModeSelect`);
    await page.waitForLoadState("networkidle");
    
    // 2. 画面内の「ログイン」ボタンをクリック
    await page.click('a:has-text("ログイン"), button:has-text("ログイン")');
    await page.waitForLoadState("networkidle");
    
    // 3. ログイン画面で、表示されている入力欄にID/PWを入力
    await page.locator('input[type="text"]:visible').fill(TOSHIMA_ID);
    await page.fill('input[type="password"]', TOSHIMA_PW);
    
    // 4. ログイン実行
    await page.click('button:has-text("ログイン"), input[type="submit"], #loginBtn');
    await page.waitForNavigation({ waitUntil: "networkidle" }).catch(() => {});
    
    if (page.url().toLowerCase().includes("login")) { console.error("[豊島区] ログイン失敗"); return results; }
    
    for (let i = 0; i < TOSHIMA_COURTS.length; i++) {
      const court = TOSHIMA_COURTS[i];
      for (const date of targetDates) {
        try {
          // ⚠️注意: 自治体システムによってはURL直叩きがエラーになる場合があります
          await page.goto(`${BASE}/vacant?facility=${court.facilityCode}&date=${date}`, { waitUntil: "networkidle", timeout: 15000 });
          const slots = await page.evaluate((ts) => {
            const found = [];
            document.querySelectorAll("table tr, .slot-row, .time-slot").forEach(row => {
              const m = row.textContent.match(/(\d{2}:\d{2})/);
              if (!m) return;
              const time = m[1];
              if (!ts.some(t => time.startsWith(t))) return;
              if (row.textContent.includes("○") || row.textContent.includes("空き") || row.textContent.includes("空")) found.push(time);
            });
            return [...new Set(found)];
          }, TARGET_SLOTS);
          if (slots.length > 0) results[i].vacancies.push({ date, slots });
          await page.waitForTimeout(400);
        } catch(e) { console.warn(`⚠ [豊島区] ${court.name} ${date}: ${e.message}`); }
      }
    }
  } catch(e) { console.error(`❌ [豊島区] システムエラー: ${e.message}`); }
  finally { await ctx.close(); }
  return results;
}

// ==========================================
// 墨田区 (スキップ解除・ログイン実装)
// ==========================================
async function checkSumida(browser, targetDates) {
  if (!SUMIDA_ID || !SUMIDA_PW) { console.log("[墨田区] 未設定 → スキップ"); return []; }
  console.log("[墨田区] 処理開始...");
  const BASE = "https://yoyaku03.city.sumida.lg.jp/user";
  const ctx = await browser.newContext({ userAgent: "Mozilla/5.0 Chrome/120" });
  const page = await ctx.newPage();
  const results = SUMIDA_COURTS.map(c => ({ name: c.name, system: "墨田区", vacancies: [] }));
  
  try {
    // 1. トップページへ移動
    await page.goto(`${BASE}/Home`);
    await page.waitForLoadState("networkidle");
    
    // 2. ログインボタンをクリック
    await page.click('a:has-text("ログイン"), button:has-text("ログイン")');
    await page.waitForLoadState("networkidle");
    
    // 3. IDとパスワードを入力 (一般的な自治体システムの要素名に合わせ、念のためIDとName両方に対応)
    await page.fill('input[id="userId"], input[name="userId"], input[id="txtUserId"]', SUMIDA_ID);
    await page.fill('input[type="password"]', SUMIDA_PW);
    
    // 4. ログイン実行
    await page.click('button:has-text("ログイン"), input[type="submit"]');
    await page.waitForNavigation({ waitUntil: "networkidle" }).catch(() => {});
    
    if (page.url().toLowerCase().includes("login")) { console.error("[墨田区] ログイン失敗"); return results; }
    
    for (let i = 0; i < SUMIDA_COURTS.length; i++) {
      const court = SUMIDA_COURTS[i];
      for (const date of targetDates) {
        try {
          // ⚠️注意: 自治体システムによってはURL直叩きがエラーになる場合があります
          await page.goto(`${BASE}/VacantSearch?facility=${court.facilityCode}&date=${date}`, { waitUntil: "networkidle", timeout: 15000 });
          const slots = await page.evaluate((ts) => {
            const found = [];
            document.querySelectorAll("table tr, .slot, .time-row").forEach(row => {
              const m = row.textContent.match(/(\d{2}:\d{2})/);
              if (!m) return;
              const time = m[1];
              if (!ts.some(t => time.startsWith(t))) return;
              if (row.textContent.includes("○") || row.textContent.includes("空き") || row.textContent.includes("空") || row.textContent.includes("利用可")) found.push(time);
            });
            return [...new Set(found)];
          }, TARGET_SLOTS);
          if (slots.length > 0) results[i].vacancies.push({ date, slots });
          await page.waitForTimeout(400);
        } catch(e) { console.warn(`⚠ [墨田区] ${court.name} ${date}: ${e.message}`); }
      }
    }
  } catch(e) { console.error(`❌ [墨田区] システムエラー: ${e.message}`); }
  finally { await ctx.close(); }
  return results;
}

// ==========================================
// 千代田区
// ==========================================
async function checkChiyoda(browser, targetDates) {
  if (!CHIYODA_ID || !CHIYODA_PW) { console.log("[千代田区] 未設定 → スキップ"); return []; }
  console.log("[千代田区] 処理開始...");
  const BASE = "https://yoyaku-sotobori.jp";
  const ctx = await browser.newContext({ userAgent: "Mozilla/5.0 Chrome/120" });
  const page = await ctx.newPage();
  const results = CHIYODA_COURTS.map(c => ({ name: c.name, system: "千代田区", vacancies: [] }));
  
  try {
    await page.goto(`${BASE}/`);
    await page.waitForLoadState("networkidle");
    await page.fill('input[name="userId"]', CHIYODA_ID);
    await page.fill('input[name="password"]', CHIYODA_PW);
    await page.click('input[type="submit"][value*="ログイン"], input[name*="login"], button:has-text("ログイン")');
    await page.waitForNavigation({ waitUntil: "networkidle" }).catch(() => {});
    
    if (page.url().toLowerCase().includes("login")) { console.error("[千代田区] ログイン失敗"); return results; }
    
    for (let i = 0; i < CHIYODA_COURTS.length; i++) {
      const court = CHIYODA_COURTS[i];
      for (const date of targetDates) {
        try {
          await page.goto(`${BASE}/vacant?court=${court.facilityCode}&date=${date.replace(/-/g,"")}`, { waitUntil: "networkidle", timeout: 15000 });
          const slots = await page.evaluate((ts) => {
            const found = [];
            document.querySelectorAll("table tr, .time-slot, .slot-item").forEach(row => {
              const m = row.textContent.match(/(\d{2}:\d{2})/);
              if (!m) return;
              const time = m[1];
              if (!ts.some(t => time.startsWith(t))) return;
              if (row.textContent.includes("○") || row.textContent.includes("空き") || row.textContent.includes("空") || row.textContent.includes("予約可")) found.push(time);
            });
            return [...new Set(found)];
          }, TARGET_SLOTS);
          if (slots.length > 0) results[i].vacancies.push({ date, slots });
          await page.waitForTimeout(400);
        } catch(e) { console.warn(`⚠ [千代田区] ${court.name} ${date}: ${e.message}`); }
      }
    }
  } catch(e) { console.error(`❌ [千代田区] システムエラー: ${e.message}`); }
  finally { await ctx.close(); }
  return results;
}

// ==========================================
// メイン実行処理 (直列実行へ変更)
// ==========================================
(async () => {
  const browser = await chromium.launch({ headless: true });
  const targetDates = getTargetDates(60);
  console.log(`対象: ${targetDates.length}日（平日のみ・60日先まで）`);
  
  let allCourts = [];
  
  try {
    // 順番に実行することで、ブラウザのセッション競合を防ぎ、ログを追いやすくします
    const r1 = await checkSporec(browser, targetDates);
    const r2 = await checkToshima(browser, targetDates);
    const r3 = await checkSumida(browser, targetDates);
    const r4 = await checkChiyoda(browser, targetDates);
    
    allCourts = [...r1, ...r2, ...r3, ...r4];
  } catch (globalError) {
    console.error("メイン処理で予期せぬエラーが発生しました:", globalError);
  } finally {
    await browser.close();
  }
  
  // 結果の保存処理
  const output = { updatedAt: new Date().toISOString(), courts: allCourts };
  const outPath = path.join(__dirname, "../docs/results.json");
  
  // ディレクトリが存在しない場合は作成
  const dirPath = path.dirname(outPath);
  if (!fs.existsSync(dirPath)){
    fs.mkdirSync(dirPath, { recursive: true });
  }
  
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`\n✅ results.json 保存完了`);
  console.log(`空きあり: ${allCourts.filter(c => c.vacancies.length > 0).length}コート / 全${allCourts.length}コート`);
})();
