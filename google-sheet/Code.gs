// Принимает результаты с сайта и записывает их строкой в таблицу.
// Вставляется в Google-таблицу: Расширения → Apps Script.

const SHEET_NAME = "Результаты";

function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(["Когда", "Ученик", "Код", "Уровень", "Задание", "Результат"]);
    sh.setFrozenRows(1);
  }
  sh.appendRow([
    new Date(data.at || Date.now()),
    String(data.name || "").slice(0, 100),
    String(data.kid || "").slice(0, 50),
    data.level || "",
    String(data.title || data.task || "").slice(0, 200),
    String(data.result || "").slice(0, 200),
  ]);
  return ContentService.createTextOutput("ok");
}
