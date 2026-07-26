# U1 Studio — דוח תיקוני ביקורת

סקירה מקיפה של המוצר לפני מסירה, בשלושה תחומים: **אבטחה**, **פונקציונליות**, ו**בדיקות הסימולציה** (כפתור 🧪). שלושה סוכני חקירה סרקו את כל הקוד; כל ממצא אומת ידנית. **16 תיקונים** יושמו ואומתו.

> ⚠️ לאחר התיקונים חובה **לרענן את התוסף** ב-`chrome://extensions` — כי `manifest.json` השתנה (נוסף CSP).

---

## שלב 1 — אבטחה 🔒

| # | חומרה | הבעיה | התיקון | קובץ |
|---|---|---|---|---|
| **S1** | Critical | ייבוא גיבוי JSON נכתב ישירות ל-`storage` ללא ולידציה. גיבוי זדוני יכול להכניס `manualInject_<host>.jsLink` → הזרקת `<script src>` לכל אתר בכל טעינה. זהו ה-linchpin שהופך את S2/S3/S5/S7 ממעשי | `sanitizeImport()` — allow-list מפתחות (`mappings_`,`config_`,`skipLinks_`,`autoApply_`,`platform_`,`manualInject_`), דחיית מפתחות `__`, schema-check לכל ערך (jsLink/cssLink חייבים `https:`; screenshot חייב `data:image/`; mappings = מערך עם `type` מרשימה לבנה; `code` מאוחסן נמחק) | `panel.js` |
| **S2** | Medium | `escapeHtml` ברח רק מ-`& < >`, לא ממרכאות → attribute-breakout סמוי | הוספת `"`→`&quot;` ו-`'`→`&#39;` | `panel.js` |
| **S3** | High | screenshot data-URL הוזרק ל-`<img src>` ללא escape/validation (`x" onerror=`). חמור בדוח שנפתח מ-`file://` (אין CSP) | `safeImg()` / `reportSafeImg()` — פולט `<img>` רק אם הערך `^data:image/` | `panel.js`, `report-gen.js` |
| **S4** | High | אין CSP מפורש; `report-view.js` עושה `document.write` של HTML מאוחסן | CSP מפורש ב-manifest (`script-src 'self'`, `img-src 'self' data:`, `object-src 'none'`). ודאתי שלא שובר את הפאנל (כל הסקריפטים חיצוניים, אין inline handlers). S1 כבר חוסם הזרקת `__closeOutReportHtml` | `manifest.json` |
| **S5** | Medium | אין ולידציית scheme ל-cssLink/jsLink (`data:text/javascript,…` היה רץ) | `isSafeHttpUrl()` — חוסם `javascript:`/`data:`/`blob:` בשמירה (Setup) **וגם** ב-background לפני ההזרקה (defense in depth) | `panel.js`, `background.js` |
| **S7** | Medium | הייצוא פלט `m.code` מאוחסן במקום לחולל מחדש → גיבוי מיובא יכול להטמיע קוד שרירותי בסקריפט שנמסר ללקוח | `mappingToCode` **מחולל תמיד מחדש** מ-`config` (u1.fix / __u1InstallGridFromMapping / __u1MakeClickable / buildAriaLabelCode); `buildDeployableCode` לא נוגע ב-`m.code` | `panel.js` |

**נמצא נקי:** אין `eval`/`new Function` בשום מקום; כל ה-apply עובר `executeScript({func,args})` (structured-clone); `buildAriaLabelCode` משתמש ב-`JSON.stringify`. **דחיתי כ-Low מחוץ לסקופ:** S6 (אימות `sender.id` — לא נגיש לדף), S8 (`rules.json` חוסם CDN גלובלית — עניין זמינות).

---

## שלב 2 — פונקציונליות 🔧

| # | חומרה | הבעיה | התיקון | קובץ |
|---|---|---|---|---|
| **H1** | High | `applyConfig` רץ ב-ISOLATED world (חסר `world:'MAIN'`), אז `window.u1` תמיד ריק → `autoRunOnOpen` המחיל קונפיג בפתיחת הפאנל היה **no-op שקט**, ו-"Run on Page" תמיד נפל לרילоуд מלא | הוספת `world: 'MAIN'` | `panel.js` |
| **H2** | High | מדריכי **React/Angular** ב-.docx קיבלו `mappings` אך לא השתמשו בו → לקוח React/Angular קיבל מדריך **בלי אף תיקון נגישות** | נוסף "Step: Apply the component mappings" עם המיפויים בשני ה-builders | `docx-gen.js` |
| **M3** | Medium | `buildKeyboardGridCode` פלט `installKeyboardGridDatepicker({…})` — פונקציה שלא קיימת. Copy של תבנית keyboard-grid בודדת נתן קוד שבור | פולט עכשיו את אותה קריאת `__u1InstallGridFromMapping(...)` כמו הייצוא | `panel.js` |
| **M1+M2** | Medium | test-engine שלח `u1-test-step` אך **לא היה מאזין** ב-panel → הצעדים הופיעו רק בסוף. וגם `res.inspect` יוצר אך "Applied code" מעולם לא הוצג | נוסף מאזין `chrome.runtime.onMessage` שמזרים צעדים **חי** (עם tag "running…" מהבהב); `renderTestResults` קורא ל-`codeSection(res.inspect)` וה-toggle חובר | `panel.js`, `styles.css` |

---

## שלב 3 — בדיקות סימולציה 🧪

המשתמש בדק ידנית רק את **המניו**. אלה התיקונים לשאר הרכיבים כדי שיהיו אמינים:

| # | חומרה | הבעיה | התיקון | קובץ |
|---|---|---|---|---|
| **T1** | High | **אקורדיון שבור לגמרי** — `headerSelector` הוא PRIMARY, אז `root` הוא כפתור בודד; החיפוש בתוכו החזיר 0 → "No accordion headers" גם על תיקון תקין | מחפש כותרות מ-`document` (הסלקטור עצמו); מפעיל ב-`.click()` אמיתי (במקום Enter סינתטי שלא עובד על native buttons); משחזר מצב רק אם השתנה | `test-engine.js` |
| **T2** | High | **dialog נכשל שקרית** — הבדיקה הסטטית רצה לפני הפתיחה, ו-U1 מגדיר role/aria-modal/שם רק כשפתוח | זיהוי מצב פתוח/סגור; כשסגור → אזהרה "open it to verify" במקום fail. גם: "Focus returns to trigger" מדולג כשאין `sel.trigger` | `test-engine.js` |
| **T3** | Medium | **listbox false-negative** — בדק `document.activeElement`, אבל listbox מנהל בחירה דרך `aria-activedescendant` (פוקוס נשאר על המיכל) | בודק שינוי ב-`aria-activedescendant`/`aria-selected` בנוסף ל-focus | `test-engine.js` |
| **T4** | Medium | **grid דרש `<table>`** — נכשל על `role="grid"` מ-DIVים | מקבל `[role=grid]`/`[role=row]`/`[role=columnheader]` כשווי-ערך | `test-engine.js` |
| **T5** | Medium | רכיבים בלי branch נפלו ל-generic "Element is focusable" → אזהרת-שווא על מיכלים שאינם focusable | נוספו **branchים אמיתיים**: combobox (ArrowDown פותח רשימה), radio (roving tabindex + חצים), checkbox (Space→aria-checked). למיכלים מוכרים (form/table/grid/carousel/…) אזהרת ה-focusable הושתקה | `test-engine.js` |

**נמצא נקי:** אין אי-התאמות שמות-שדות בין test-engine ל-COMPONENT_SCHEMAS; מבנה ה-config תקין; menu/menubar כבר מוקשח; form/heading/ariaLabel/tabs סטטיים תקינים.

---

## קבצים שהשתנו
`panel.js` · `background.js` · `docx-gen.js` · `report-gen.js` · `test-engine.js` · `manifest.json` · `styles.css`
(ללא שינוי: `grid-nav.js`, `report-view.js`, `report.html`, `rules.json`)

## אימות שבוצע
- **תחביר:** כל 7 קבצי ה-JS עוברים `new Function(...)`; `manifest.json` JSON תקין.
- **אבטחה:** `sanitizeImport` נחסם מול 9 תרחישי תקיפה (data: jsLink, `__closeOutReportHtml`, code זדוני, type לא-חוקי, screenshot לא-תמונה); `safeImg`/`isSafeHttpUrl` 6/6.
- **ייצוא:** `mappingToCode` מחולל קוד רץ לכל הסוגים ו-`code` זדוני לא דולף; המנוע המנוקה (client bundle) עובר 8/8 בדיקות התנהגות **ללא `chrome`** ואפס דליפת מונחים פנימיים.

## מה נשאר לך (בדיקה ידנית בדפדפן)
1. רענן את התוסף (חובה — CSP חדש).
2. 🧪 על dialog **סגור** → אמור להראות "open it to verify", לא כישלון.
3. 🧪 על accordion → מזהה כותרות; על listbox/combobox/radio/checkbox → ללא אזהרות-שווא.
4. ייבא גיבוי עם `manualInject_evil.com.jsLink="data:…"` → אמור להידחות ("unsafe/unknown entries skipped").
5. ייצא .docx כ-React וכ-Angular → המיפויים מופיעים.
