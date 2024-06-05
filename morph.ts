import fs from "fs";

// 変換させたいQAリストを配置する
import { qaListTes } from "./qaList";
import axios from "axios";
type TChatBotRelatedQuestion = {
  id: string;
  title: string;
  index: string[];
};

type TChatBotAnswer = {
  questionId: string;
  content: string;
  link: string;
  index: string[];
};

// S3に保管しているカテゴリ毎のQAリスト
interface IQuestionAnswerGroup {
  categoryId: string;
  category: string;
  questions: TChatBotRelatedQuestion[];
  answers: TChatBotAnswer[];
}
/**
 * 解析結果の配列から最初の文字を抽出
 * input: 会社の登記をしたいのですが、可能でしょうか？
 * result: [
 * "会社", "の", "登記", "を", "し", "たい", "の", "です", "が",
 * "、", "可能", "でし", "ょ", "う", "か", "？",
 *]
 */
function extractStringIndexes(lines: string[]): string[] {
  const firstCharsArr: string[] = [];

  for (const line of lines) {
    const parts = line.split("\t");
    // console.log("parts", parts);
    // 最初の文字だけをピックアップする
    // 名詞、動詞-自立、だけピックアップする。
    // かな→カナ、かな→漢字、のようなあいまい検索は対応しない。indexが増えすぎてしまうことを防止
    const isNounOrVerb = parts.find((part) => {
      // console.log(part);
      console.log(part, part.includes("名詞" || "動詞-自立"));
      return part.includes("名詞" || "動詞-自立");
    });
    const isFirstCharInArr = parts[0] && parts[0] !== "" && parts[0] !== "EOS";
    if (isFirstCharInArr && isNounOrVerb) {
      firstCharsArr.push(parts[0]);
    }
  }
  console.log("firstCharsArr", firstCharsArr);
  return firstCharsArr;
}

async function getMorphemesStrings(text: string) {
  console.log("isFreeInputQuery", text);
  // TODON: URLを切り替える
  const BASE_URL =
    // "http://localhost:7000/2015-03-31/functions/function/invocations"; // 本番用に切り替える
    "https://tnu76skoxiq2bli7sni2mlyqoa0kmvgd.lambda-url.ap-northeast-1.on.aws/"; // 検証lambda container
  try {
    const response = await axios.post(
      BASE_URL,
      { text },
      {
        headers: { "Content-Type": "application/json" },
      }
    );
    console.log("Response:", response.data.morphemes);

    // 形態素解析の結果を抽出
    const morphemes = response.data.morphemes;
    const lines = morphemes.split("\n");

    // indexに合致する回数が高かった上位6つの質問を取得
    return extractStringIndexes(lines);
  } catch (error) {
    console.error("Error making request to morphemes container:", error);
    throw error;
  }
}

async function main() {
  const newQAList: IQuestionAnswerGroup[] = [];
  for (const QaCategory of qaListTes) {
    const qaCategory: IQuestionAnswerGroup = {
      categoryId: QaCategory.categoryId,
      category: QaCategory.category,
      questions: [],
      answers: [],
    };
    //QA Categoryの
    console.log(QaCategory);
    for (const question of QaCategory.questions) {
      const newQuestion = { ...question, index: [] as string[] };
      const res = await getMorphemesStrings(question.title);
      newQuestion.index = res;
      qaCategory.questions.push(newQuestion);
    }
    for (const answer of QaCategory.answers) {
      const newAnswer = {
        ...answer,
        questionId: answer.id,
        index: [] as string[],
      };
      const res = await getMorphemesStrings(answer.content);
      newAnswer.index = res;
      qaCategory.answers.push(newAnswer);
    }
    newQAList.push(qaCategory);
  }
  generateObj(newQAList);
}

function generateObj(newQAList: IQuestionAnswerGroup[]) {
  fs.writeFileSync("./qaList.json", JSON.stringify(newQAList, null, 2));
}

main().catch((err) => {
  console.error("Error in main function:", err);
});

