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

function drawCard({ result, phone, documentRef }) {
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

  context.textAlign = "right";
  context.fillStyle = INK_SOFT;
  setFont(context, 24, 700);
  context.fillText(phone || "0927-617-207", 972, 94);
  context.textAlign = "start";

  const status = String(result?.status || "方向整理完成");
  setFont(context, 22, 800);
  const statusWidth = Math.min(context.measureText(status).width + 48, 360);
  context.fillStyle = GOLD_PALE;
  roundedRect(context, 84, 188, statusWidth, 46, 23);
  context.fill();
  context.fillStyle = INK;
  context.fillText(status, 108, 198);

  context.fillStyle = INK;
  setFont(context, 57, 800, DISPLAY_FONT);
  drawWrappedText(context, result?.headline, {
    x: 84,
    y: 258,
    maxWidth: 912,
    maxLines: 2,
    lineHeight: 68
  });
  drawRule(context, 382);

  drawSectionLabel(context, "目前找房方向", 412);
  context.fillStyle = INK_SOFT;
  setFont(context, 28, 600);
  let directionY = 462;
  for (const item of (result?.direction || []).slice(0, 2)) {
    context.fillStyle = GOLD;
    context.fillRect(88, directionY + 11, 8, 8);
    context.fillStyle = INK_SOFT;
    directionY = drawWrappedText(context, item, {
      x: 116,
      y: directionY,
      maxWidth: 858,
      maxLines: 3,
      lineHeight: 34
    }) + 10;
  }

  const budgetLabelY = Math.max(670, directionY + 10);
  drawSectionLabel(context, "預算提醒", budgetLabelY);
  context.fillStyle = INK_SOFT;
  setFont(context, 26, 500);
  const budgetEnd = drawWrappedText(context, result?.budgetReminder, {
    x: 84,
    y: budgetLabelY + 50,
    maxWidth: 912,
    maxLines: 4,
    lineHeight: 32
  });

  const prioritiesLabelY = Math.max(878, budgetEnd + 35);
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
      lineHeight: 31
    }) + 9;
  });

  context.fillStyle = INK;
  roundedRect(context, 84, 1196, 912, 100, 18);
  context.fill();
  context.fillStyle = PAPER;
  setFont(context, 24, 700);
  context.fillText("想了解台南行情、買房、賣房，都可以找我聊聊。", 112, 1217);
  context.fillStyle = GOLD_PALE;
  setFont(context, 20, 600);
  context.fillText("魏泉承｜永慶不動產-小東南紡店", 112, 1257);
  context.textAlign = "right";
  setFont(context, 22, 800);
  context.fillText(phone || "0927-617-207", 968, 1255);
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

export function renderResultImage({ result, phone }) {
  if (!globalThis.document) throw new Error("無法建立需求照片");
  return drawCard({ result, phone, documentRef: globalThis.document });
}

export async function downloadResultImage({ result, phone, documentRef = globalThis.document, urlRef = globalThis.URL }) {
  if (!documentRef || !urlRef) throw new Error("無法建立需求照片");
  const canvas = drawCard({ result, phone, documentRef });
  const blob = await toPngBlob(canvas);
  const filename = `台南小魏-買房方向卡-${dateStamp()}.png`;
  const objectUrl = urlRef.createObjectURL(blob);
  const link = documentRef.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  link.style && (link.style.display = "none");
  try {
    documentRef.body?.append(link);
    link.click();
  } finally {
    link.remove();
    setTimeout(() => urlRef.revokeObjectURL(objectUrl), 0);
  }
  return filename;
}
