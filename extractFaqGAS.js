function main() {
  onOpen()
  exportToJson()
}

function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('GAS MENU')
    .addItem('Jsonに書き出す', 'exportToJson')
    .addToUi();
}

function exportToJson() {
  // 操作に必要な要素を取得する
  var { sheet, range, values, headers } = getPreRequiredGSElements()
  var sheetVariables = extractTextsFromSheet(range, values, headers)

  // QAリストを抽出して配列に入れる
  var { qaGroupsArray, firstQaList } = getQaGroups(sheetVariables)

  // qaList.jsonのダウンロードリンクを作成する
  var qaListName = 'qaList.json'
  var { url: qaListUrl } = getDownloadUrl(qaListName, qaGroupsArray)

  // firstQuestions.jsonのダウンロードリンクを作成する
  var firstQAName = 'firstQuestions.json'
  var { url: firstQAUrl} = getDownloadUrl(firstQAName, firstQaList)
  var date = formatCurrentDateTimeToString();
  var tabNameOutputJson = 'チャットボットで使うJson生成履歴'

  // タブがなければ作成し、二つのjsonのダウンロード用URLを添付する
  if (!sheet.getSheetByName(tabNameOutputJson)) {
    sheet.insertSheet(tabNameOutputJson);
  }
  var downloadJsonTab = sheet.getSheetByName(tabNameOutputJson);
  downloadJsonTab.appendRow([date, qaListUrl,firstQAUrl])
}


function getPreRequiredGSElements() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet();
  var activeSheet = sheet.getActiveSheet();
  var range = activeSheet.getDataRange();
  var values = range.getValues();
  var headers = values[0];
  return {
    sheet,
    range,
    values,
    headers
  }
}

function extractTextsFromSheet(range, values, headers) {
  var sheetVariables = [];
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var jsonObject = {};
    for (var j = 0; j < row.length; j++) {
      if (row[j] !== '') {
        var cell = range.getCell(i + 1, j + 1);
        var text = cell.getRichTextValue();
        var textWithLinks = text ? getLinksFromRichTextValue(text) : row[j];
        jsonObject[headers[j]] = textWithLinks;
      }
    }
    sheetVariables.push(jsonObject);
  }
  return sheetVariables;
}

/** 
 * QA Groupのインターフェイス
 * export interface IQuestionAnswerGroup {
 *    categoryId: string;
 *    category: string;
 *    questions: TChatBotRelatedQuestion[];
 *    answers: TChatBotAnswer[];
 * }
 * */
function getQaGroups(sheetVariables) {
  var qaGroups = {};
  sheetVariables.forEach(function (item, index) {
    var category = item['カテゴリ'];
    var defaultUrl = 'https://www.gmo-office.com/faq'
    var link = item['FAQリンク'] === 'なし' ? defaultUrl : item['FAQリンク'];

    if (!qaGroups[category]) {
      qaGroups[category] = {
        categoryId: (100000 + Object.keys(qaGroups).length + 1).toString(),
        category: category + 'に関する質問',
        questions: [],
        answers: []
      };
    }

    var categoryId = qaGroups[category].categoryId;
    var questionId = 'Q' + ((Object.keys(qaGroups).length) * 10000 + qaGroups[category].questions.length + 1);

    /**
     * questionのインターフェイス
     * export type TChatBotRelatedQuestion = {
     *  id: string;
     *  title: string;
     *  index: string[];
     * };
     *  */
    var question = {
      id: questionId,
      title: item['質問'],
      index: []
    };

    var answerContent = item['回答（正式版）'];

    var formattedAnswerContent = formatLinks(answerContent);
    formattedAnswerContent = formattedAnswerContent && typeof formattedAnswerContent === 'string' ? formatNewLines(formattedAnswerContent) : formattedAnswerContent;
    var linkWithText = extractLinkWithText([], answerContent)

    /**
     * answerのインターフェイス
     * 
     *  export type TChatBotAnswer = {
     *  questionId: string;
     *  content: string;
     *  link: string;
     *  index: string[];
     * };
     *  */
    //
    var answer = {
      questionId: question.id,
      content: formattedAnswerContent,
      link: link,
      index: []
    };

    qaGroups[category].questions.push(question);
    qaGroups[category].answers.push(answer);
  });

  var qaGroupsArray = Object.values(qaGroups);
  var firstQaList = qaGroupsArray.map(qaGroup => ({
    id: qaGroup.categoryId,
    title: qaGroup.category,
    index: qaGroup.category
  }));

  return { qaGroupsArray, firstQaList }
}


function getDownloadUrl(fileName, arr) {
  var targetJson = JSON.stringify(arr, null, 2);
  var blob = Utilities.newBlob(targetJson, 'application/json', fileName);
  var file = DriveApp.createFile(blob);
  var url = file.getDownloadUrl();
  return { url }
}

function appendDownloadUrlToRow(tab, name, url) {
  tab.appendRow([name, ...url]);
}

function extractLinkWithText(linkWithText, text) {
  var linkPattern = /<a href="(.*?)"(.*?)>(.*?)<\/a>/g;
  var match;

  while ((match = linkPattern.exec(text)) !== null) {
    var url = match[1];
    var additionalAttributes = match[2];
    var linkText = match[3];

    // Fix for target="_blank"
    if (additionalAttributes.includes('target="_blank')) {
      additionalAttributes = ' target="_blank"';
    }

    linkWithText.push({
      text: linkText,
      url: url + additionalAttributes
    });
  }

  // Log all extracted URLs and texts for debugging purposes
  linkWithText.forEach(function (link) {
    Logger.log("URL: " + link.url + ", Text: " + link.text);
  });

  return linkWithText;
}
function formatLinks(text) {
  var linkPattern = /<a href="(.*?)">(.*?)<\/a>/g;
  var formattedText = text;
  var match;

  while ((match = linkPattern.exec(text)) !== null) {
    var url = match[1];
    var linkText = match[2];
    var replacement = '<a href="' + url + '>' + linkText + '</a>';
    formattedText = formattedText.replace(match[0], replacement);
  }

  return formattedText;
}

function getLinksFromRichTextValue(richText) {
  var runs = richText.getRuns();
  var result = "";

  runs.forEach(function (run) {
    var text = run.getText();
    var url = run.getLinkUrl();

    if (url && url != text) {
      result += '<a href="' + url + '" target="_blank"\">' + text + '</a>';
    } else {
      result += text;
    }
  });

  return result;
}

function formatNewLines(text) {
  return text.replace(/\n\n/g, '<br>').replace(/\n/g, '<br>');
}

function formatCurrentDateTimeToString() {
  var currentDate = new Date();
  var formattedDate = Utilities.formatDate(currentDate, Session.getScriptTimeZone(), 'yyyy-MM-dd.HH:mm:ss');
  Logger.log('フォーマット後の日時は ' + formattedDate);
  return formattedDate
}

function escapeHtmlAttributes(str) {
  if (str && typeof str === 'string') {
    return str.replace(/"/g, '\\"');
  }
  return str;
}
