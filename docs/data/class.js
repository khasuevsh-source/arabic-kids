// Настройки класса: ученики, домашние задания и адрес Google-таблицы.
// Этот файл редактирует учитель.

// Ссылка на веб-приложение Google Apps Script (см. google-sheet/НАСТРОЙКА.md).
// Пока пусто — результаты сохраняются только на устройстве ребёнка.
window.SHEET_URL = "";

// Ученики. Каждый заходит по своей ссылке: https://<сайт>/?kid=<code>
// level: 1 — буквы и звуки (4–6 лет), 2 — слова и фразы (7–10), 3 — тексты и мультики (11+)
window.KIDS = [
  { code: "demo1", name: "Малыш (демо)", level: 1 },
  { code: "demo2", name: "Ученик (демо)", level: 2 },
  { code: "demo3", name: "Старший (демо)", level: 3 },
];

// Домашние задания. levels — каким уровням задано.
// Типы: video (посмотреть мультик), match (игра «Найди пару»), quiz (игра «Выбери перевод»),
//       letters (выучить буквы).
// source у игр: "set:<id набора слов>" или "video:<id мультика>" (слова из мультика).
window.HOMEWORK = [
  { id: "hw-letters-1", title: "Выучи буквы ا ب ت ث", type: "letters", letters: ["ا", "ب", "ت", "ث"], levels: [1, 2] },
  { id: "hw-animals-match", title: "Найди пару: животные", type: "match", source: "set:animals", levels: [1, 2] },
  { id: "hw-colors-quiz", title: "Выбери перевод: цвета", type: "quiz", source: "set:colors", levels: [1, 2, 3] },
  { id: "hw-daisy-video", title: "Посмотри мультик «Дейзи и Поппи»", type: "video", video: "daisy-poppy", levels: [2, 3] },
  { id: "hw-daisy-quiz", title: "Слова из мультика «Дейзи и Поппи»", type: "quiz", source: "video:daisy-poppy", levels: [3] },
];
