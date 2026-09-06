import { deriveResult } from "./result.js?v=20260906-r2";
import { needsThirdRoomUse, QUESTION_STEPS } from "./questions.js?v=20260906-r2";

const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1350;
const INK = "#18352e";
const INK_SOFT = "#455f57";
const GOLD = "#b37a2d";
const GOLD_PALE = "#f6ddb0";
const PAPER = "#fffdf8";
const PAPER_WARM = "#f7f1e6";
const BODY_FONT = '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif';
const DISPLAY_FONT = '"Noto Serif TC", "Songti TC", "PMingLiU", "Microsoft JhengHei", serif';
const BRAND_PHONE = "0927-617-207";
const IMAGE_PRIVATE_KEYS = [
  "name",
  "phone",
  "customArea",
  "customDownPayment",
  "customMonthlyMortgage",
  "customRooms",
  "customAgePreference",
  "otherNoGo",
  "moveInBudget",
  "conditionTolerance",
  "decisionLimit"
];
const IMAGE_CHOICE_FIELDS = QUESTION_STEPS
  .flatMap(step => step.fields)
  .filter(field => Array.isArray(field.options))
  .map(field => ({
    key: field.key,
    type: field.type,
    allowedOptions: new Set(field.options)
  }));

export function createImageSafeAnswers(answers = {}) {
  const sourceAnswers = structuredClone(answers || {});
  const safeAnswers = {};

  for (const field of IMAGE_CHOICE_FIELDS) {
    const value = sourceAnswers[field.key];
    if (field.type === "multi") {
      safeAnswers[field.key] = Array.isArray(value)
        ? value.filter(option => field.allowedOptions.has(option))
        : [];
    } else {
      safeAnswers[field.key] = field.allowedOptions.has(value) ? value : "";
    }
  }
  for (const key of IMAGE_PRIVATE_KEYS) safeAnswers[key] = "";
  if (!needsThirdRoomUse(safeAnswers)) safeAnswers.thirdRoomUse = "";
  return safeAnswers;
}

function deriveImageResult(answers) {
  return deriveResult(createImageSafeAnswers(answers));
}

function setFont(context, size, weight = 500, family = BODY_FONT) {
  context.font = `${weight} ${size}px ${family}`;
}

function roundedRect(context, x, y, width, height, radius) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.arcTo(x + width, y, x + width, y + safeRadius, safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.arcTo(x + width, y + height, x + width - safeRadius, y + height, safeRadius);
  context.lineTo(x + safeRadius, y + height);
  context.arcTo(x, y + height, x, y + height - safeRadius, safeRadius);
  context.lineTo(x, y + safeRadius);
  context.arcTo(x, y, x + safeRadius, y, safeRadius);
  context.closePath();
}

function paragraphLines(context, value, maxWidth) {
  const characters = Array.from(String(value || "").trim());
  if (!characters.length) return [];
  const lines = [];
  let line = "";
  for (const character of characters) {
    const candidate = line + character;
    if (line && context.measureText(candidate).width > maxWidth) {
      lines.push(line.trimEnd());
      line = character.trimStart();
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line.trimEnd());
  return lines;
}

function wrappedLines(context, value, maxWidth, maxLines) {
  const lines = String(value || "")
    .split(/\r?\n/)
    .flatMap(paragraph => paragraphLines(context, paragraph, maxWidth));
  if (lines.length <= maxLines) return lines;

  const visible = lines.slice(0, maxLines);
  let last = visible[maxLines - 1].replace(/[，。、；：,.!?！？…\s]+$/u, "");
  while (last && context.measureText(`${last}…`).width > maxWidth) {
    last = Array.from(last).slice(0, -1).join("");
  }
  visible[maxLines - 1] = `${last}…`;
  return visible;
}

function drawWrappedText(context, value, { x, y, maxWidth, maxLines, lineHeight }) {
  const lines = wrappedLines(context, value, maxWidth, maxLines);
  lines.forEach((line, index) => context.fillText(line, x, y + index * lineHeight));
  return y + lines.length * lineHeight;
}

function drawRule(context, y) {
  context.strokeStyle = "rgba(179, 122, 45, 0.34)";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(84, y);
  context.lineTo(996, y);
  context.stroke();
}

function drawSectionLabel(context, value, y) {
  context.fillStyle = GOLD;
  context.fillRect(84, y + 4, 9, 31);
  context.fillStyle = INK;
  setFont(context, 30, 800);
  context.fillText(value, 112, y);
}

function drawCard({ result, documentRef }) {
  const canvas = documentRef.createElement("canvas");
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("無法建立需求照片");

  context.textBaseline = "top";
  context.fillStyle = PAPER_WARM;
  context.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  context.fillStyle = PAPER;
  context.fillRect(30, 30, CARD_WIDTH - 60, CARD_HEIGHT - 60);
  context.strokeStyle = "rgba(179, 122, 45, 0.55)";
  context.lineWidth = 3;
  context.strokeRect(48, 48, CARD_WIDTH - 96, CARD_HEIGHT - 96);

  context.fillStyle = GOLD;
  context.fillRect(84, 76, 11, 79);
  context.fillStyle = INK;
  setFont(context, 46, 800, DISPLAY_FONT);
  context.fillText("台南小魏", 118, 70);
  context.fillStyle = GOLD;
  setFont(context, 24, 800);
  context.fillText("買厝作伙", 120, 127);

  const status = String(result?.status || "方向整理完成");
  setFont(context, 22, 800);
  const statusWidth = Math.min(context.measureText(status).width + 48, 360);
  context.fillStyle = GOLD_PALE;
  roundedRect(context, 84, 188, statusWidth, 46, 23);
  context.fill();
  context.fillStyle = INK;
  context.fillText(status, 108, 198);

  context.fillStyle = INK;
  setFont(context, 52, 800, DISPLAY_FONT);
  drawWrappedText(context, result?.headline, {
    x: 84,
    y: 258,
    maxWidth: 912,
    maxLines: 2,
    lineHeight: 70
  });
  drawRule(context, 390);

  drawSectionLabel(context, "目前找房方向", 422);
  context.fillStyle = INK_SOFT;
  setFont(context, 27, 600);
  let directionY = 474;
  for (const item of (result?.direction || []).slice(0, 2)) {
    context.fillStyle = GOLD;
    context.fillRect(88, directionY + 11, 8, 8);
    context.fillStyle = INK_SOFT;
    directionY = drawWrappedText(context, item, {
      x: 116,
      y: directionY,
      maxWidth: 858,
      maxLines: 3,
      lineHeight: 36
    }) + 12;
  }

  const budgetLabelY = Math.max(664, directionY + 18);
  drawSectionLabel(context, "預算提醒", budgetLabelY);
  context.fillStyle = INK_SOFT;
  setFont(context, 25, 500);
  const budgetEnd = drawWrappedText(context, result?.budgetReminder, {
    x: 84,
    y: budgetLabelY + 50,
    maxWidth: 912,
    maxLines: 4,
    lineHeight: 34
  });

  const prioritiesLabelY = Math.max(852, budgetEnd + 34);
  drawSectionLabel(context, "最值得先確認的 3 件事", prioritiesLabelY);
  context.fillStyle = INK;
  setFont(context, 25, 700);
  let priorityY = prioritiesLabelY + 52;
  (result?.priorityPreview || []).slice(0, 3).forEach((item, index) => {
    context.fillStyle = GOLD;
    setFont(context, 23, 800);
    context.fillText(String(index + 1).padStart(2, "0"), 84, priorityY + 1);
    context.fillStyle = INK;
    setFont(context, 25, 700);
    priorityY = drawWrappedText(context, item?.text, {
      x: 134,
      y: priorityY,
      maxWidth: 840,
      maxLines: 2,
      lineHeight: 33
    }) + 9;
  });

  context.fillStyle = INK;
  roundedRect(context, 84, 1144, 912, 152, 18);
  context.fill();
  context.textAlign = "center";
  context.fillStyle = PAPER;
  setFont(context, 23, 700);
  context.fillText("想了解台南行情、買房、賣房，都可以找我聊聊。", 540, 1167);
  context.fillStyle = GOLD_PALE;
  setFont(context, 19, 600);
  context.fillText("魏泉承｜永慶不動產-小東南紡店", 540, 1211);
  setFont(context, 22, 800);
  context.fillText(BRAND_PHONE, 540, 1250);
  context.textAlign = "start";

  return canvas;
}

function dateStamp(date = new Date()) {
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((part, index) => String(part).padStart(index === 0 ? 4 : 2, "0"))
    .join("");
}

function toPngBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error("無法建立需求照片"));
    }, "image/png");
  });
}

export function renderResultImage({ answers }) {
  if (!globalThis.document) throw new Error("無法建立需求照片");
  const result = deriveImageResult(answers);
  return drawCard({ result, documentRef: globalThis.document });
}

export async function downloadResultImage({ answers, documentRef = globalThis.document, urlRef = globalThis.URL }) {
  if (!documentRef || !urlRef) throw new Error("無法建立需求照片");
  const result = deriveImageResult(answers);
  const canvas = drawCard({ result, documentRef });
  const blob = await toPngBlob(canvas);
  const filename = `台南小魏-買房方向卡-${dateStamp()}.png`;
  const objectUrl = urlRef.createObjectURL(blob);
  let link;
  let operationError;
  try {
    link = documentRef.createElement("a");
    link.href = objectUrl;
    link.download = filename;
    link.style && (link.style.display = "none");
    documentRef.body?.append(link);
    link.click();
  } catch (error) {
    operationError = error;
  }

  let removalError;
  try {
    link?.remove();
  } catch (error) {
    removalError = error;
  }

  if (operationError || removalError) {
    urlRef.revokeObjectURL(objectUrl);
  } else {
    setTimeout(() => urlRef.revokeObjectURL(objectUrl), 0);
  }
  if (operationError) throw operationError;
  if (removalError) throw removalError;
  return filename;
}
