// =========================================================================
// ★ プレビュー切り替えスイッチ ★
// true  : APIキー・画像なしで「トップ画面〜AIとの会話画面」の流れを即座に確認できます
// false : 本番モード（同意確認 → パスワード認証 → トップ画面 → AI対話）で動作します
// =========================================================================
const PREVIEW_MODE = false;

// Cognition の Source code に貼り付ける jsPsych 8 / Survey 4 のコード（OpenAI API版・課題選択トップ画面付き）
// External JS: OpenAI APIキーを暗号化した encrypted-api-key.js をアップロードしてください。
// Plugins: survey / html-button-response / call-function を有効にしてください。
// Stimuli: 課題画像（または image_path に Base64 Data URL を直接貼り付け）を設定してください。

// ① システムプロンプトを1つに限定
const SYSTEM_PROMPT = `あなたは教員の文章指導を支援するAIです。
【1回目の応答（課題画像が添付されている場合）】
必ず以下の2つの見出しを使って、日本語で回答してください。
【画像内の文章の文字起こし】
添付された課題画像に書かれている文章を、誤字脱字や改行も含めて省略せずそのまま正確に文字起こししてください。

【フィードバック案】
文字起こしした文章に基づき、改善点と具体的な改善案（書き換え例を含む）を簡潔に提示してください。

【2回目以降の応答（画像は添付されず会話履歴のみが送られる場合）】
1回目の応答に含まれる【画像内の文章の文字起こし】を原文として参照し、これまでのやり取りと教員からの最新の追質問・修正指示を踏まえて、日本語で簡潔に応答してください（2回目以降は文字起こしの再掲は不要です）。`;

// OpenAI の生成設定（必要に応じて model を "gpt-4o" や "gpt-4o-mini" 等に変更してください）
const SETTINGS = {
  model: "gpt-6-luna",
  reasoningEffort: "none",
  temperature: 0.3,
  maxOutputTokens: 1500
};

// 課題リスト（Stimuliのファイル名、または "data:image/png;base64,..." 形式の文字列を指定可能）
const TASKS = [
  { task_id: "task_1", task_label: "課題 1", image_path: "task1.png" },
  { task_id: "task_2", task_label: "課題 2", image_path: "task2.png" },
  { task_id: "task_3", task_label: "課題 3", image_path: "task3.png" }
];

// Survey 4 と トップ画面・全画面左右2カラムUIのスタイル調整
const experimentStyle = document.createElement("style");
experimentStyle.textContent = `
  /* jsPsych と SurveyJS の横幅制限を解除 */
  .jspsych-display-element { width: 100%; }
  .jspsych-content-wrapper { width: 100%; }
  .jspsych-content { box-sizing: border-box; width: 100%; max-width: 100%; margin: 0 auto; padding: 0 1rem; }
  .sd-root-modern { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Yu Gothic", "Meiryo", sans-serif; width: 100%; }
  .sd-container-modern { width: 100% !important; max-width: 100% !important; }
  .sd-body, .sd-body.sd-body--responsive, .sd-body.sd-body--static {
    box-sizing: border-box !important;
    width: 100% !important;
    max-width: 56rem !important;
    margin: 0 auto !important;
    padding: 0.75rem 1rem !important;
  }
  /* 2カラム対話画面のときだけブラウザの画面幅いっぱいまで広げる */
  .jspsych-content:has(.split-workspace) { padding: 0 0.75rem; }
  .sd-body:has(.split-workspace) {
    max-width: 100% !important;
    width: 100% !important;
    padding: 0.5rem 0.75rem !important;
  }
  .sd-page, .sd-row, .sd-page__row, .sd-element, .sd-question, .sd-question__content, .sd-html {
    box-sizing: border-box !important;
    width: 100% !important;
    max-width: 100% !important;
    min-width: 0 !important;
  }
  .sd-element--with-frame { padding: 0 !important; box-shadow: none !important; background: transparent !important; }
  .sd-element__title { line-height: 1.4; }
  .sd-input { font-size: 1rem; line-height: 1.5; }
  textarea.sd-input { min-height: 6rem; max-width: 100%; }
  .sd-btn--action { min-height: 2.75rem; background-color: #23395d; border-color: #23395d; color: #fff; }

  /* プレビューモード通知バー */
  .preview-banner {
    background: #fef3c7;
    color: #92400e;
    border: 1px solid #f59e0b;
    border-radius: 6px;
    padding: 0.35rem 0.75rem;
    font-size: 0.82rem;
    font-weight: 600;
    margin-bottom: 0.65rem;
    text-align: center;
  }

  /* トップ画面（識別NO入力 ＆ 課題選択メニュー） */
  .menu-container {
    max-width: 44rem;
    margin: 0.5rem auto;
    background: #ffffff;
    border: 1px solid #cbd5e1;
    border-radius: 12px;
    padding: 1.5rem 1.75rem;
    box-shadow: 0 2px 10px rgba(15, 23, 42, 0.04);
    text-align: left;
  }
  .menu-header {
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 0.85rem;
    margin-bottom: 1.25rem;
  }
  .menu-title {
    font-size: 1.3rem;
    font-weight: 700;
    color: #0f172a;
    margin: 0 0 0.25rem 0;
  }
  .menu-subtitle {
    font-size: 0.9rem;
    color: #475569;
    margin: 0;
  }
  .participant-id-box {
    background: #f8fafc;
    border: 1px solid #cbd5e1;
    border-radius: 10px;
    padding: 1rem 1.15rem;
    margin-bottom: 1.35rem;
  }
  .participant-id-label {
    display: block;
    font-size: 0.95rem;
    font-weight: 700;
    color: #1e293b;
    margin-bottom: 0.4rem;
  }
  .participant-id-required {
    background: #dc2626;
    color: #ffffff;
    font-size: 0.72rem;
    padding: 0.1rem 0.45rem;
    border-radius: 4px;
    margin-left: 0.4rem;
    vertical-align: middle;
  }
  .participant-id-input {
    width: 100%;
    box-sizing: border-box;
    padding: 0.6rem 0.85rem;
    font-size: 1.05rem;
    border: 1.5px solid #94a3b8;
    border-radius: 8px;
    background: #ffffff;
    color: #0f172a;
  }
  .participant-id-input:focus {
    outline: none;
    border-color: #23395d;
    box-shadow: 0 0 0 3px rgba(35, 57, 93, 0.14);
  }
  .menu-error-msg {
    color: #dc2626;
    font-size: 0.88rem;
    font-weight: 700;
    margin-top: 0.45rem;
    display: none;
  }
  .task-list-heading {
    font-size: 0.95rem;
    font-weight: 700;
    color: #1e293b;
    margin: 0 0 0.65rem 0;
  }
  .task-card-list {
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
  }
  .task-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    padding: 0.85rem 1.1rem;
    border: 1.5px solid #cbd5e1;
    border-radius: 10px;
    background: #ffffff;
    transition: border-color 0.15s, background 0.15s;
  }
  .task-card:hover {
    border-color: #23395d;
    background: #f8fafc;
  }
  .task-card.is-done {
    background: #f0fdfa;
    border-color: #99f6e4;
  }
  .task-card-info {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    flex-wrap: wrap;
  }
  .task-card-title {
    font-size: 1.05rem;
    font-weight: 700;
    color: #0f172a;
  }
  .task-status-badge {
    font-size: 0.76rem;
    font-weight: 700;
    padding: 0.18rem 0.55rem;
    border-radius: 999px;
  }
  .task-status-badge.pending {
    background: #e2e8f0;
    color: #475569;
  }
  .task-status-badge.done {
    background: #0f766e;
    color: #ffffff;
  }
  .task-start-btn {
    background: #23395d;
    color: #ffffff;
    border: none;
    border-radius: 8px;
    padding: 0.55rem 1.15rem;
    font-size: 0.92rem;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s;
  }
  .task-start-btn:hover { background: #1a2b47; }
  .task-card.is-done .task-start-btn {
    background: #475569;
  }
  .task-card.is-done .task-start-btn:hover {
    background: #334155;
  }
  .menu-footer {
    margin-top: 1.5rem;
    padding-top: 1rem;
    border-top: 1px solid #e2e8f0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.75rem;
  }
  .menu-progress-text {
    font-size: 0.88rem;
    color: #475569;
    font-weight: 600;
  }
  .menu-finish-btn {
    background: #ffffff;
    color: #475569;
    border: 1.5px solid #94a3b8;
    border-radius: 8px;
    padding: 0.5rem 1.1rem;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
  }
  .menu-finish-btn:hover {
    background: #f1f5f9;
    color: #0f172a;
    border-color: #64748b;
  }

  /* 待機中のスピナー */
  .ai-spinner {
    width: 36px; height: 36px; margin: 0 auto;
    border: 4px solid #cbd5e1; border-top-color: #23395d;
    border-radius: 50%; animation: ai-spin 0.85s linear infinite;
  }
  @keyframes ai-spin { to { transform: rotate(360deg); } }

  /* 左右2カラムレイアウト（画面幅いっぱいに展開） */
  .split-workspace {
    display: flex;
    align-items: stretch;
    gap: 1.25rem;
    width: 100%;
    height: calc(100vh - 2.2rem);
    min-height: 520px;
  }
  .split-workspace.has-preview-banner {
    height: calc(100vh - 4.6rem);
  }
  .workspace-left {
    flex: 0 0 46%;
    max-width: 46%;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .workspace-right {
    flex: 1 1 54%;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    height: 100%;
  }

  /* 課題画像エリア */
  .task-image-box {
    margin: 0;
    text-align: center;
    background: #f8fafc;
    padding: 0.65rem;
    border: 1px solid #cbd5e1;
    border-radius: 10px;
    height: 100%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
  }
  .task-image-box img {
    width: 100%;
    flex: 1 1 auto;
    min-height: 0;
    max-height: calc(100vh - 6rem);
    height: auto;
    display: block;
    margin: 0 auto;
    border-radius: 4px;
    object-fit: contain;
  }
  /* 事前確認画面用の画像高さ調整 */
  .task-intro-box {
    height: auto;
    max-width: 52rem;
    margin: 0 auto;
  }
  .task-intro-box img {
    width: auto;
    max-width: 100%;
    max-height: 60vh;
  }

  /* ChatGPT風のスクロール可能な対話タイムライン */
  .chat-window-wrapper {
    border: 1px solid #cbd5e1;
    border-radius: 10px;
    background: #ffffff;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-height: 0;
  }
  .chat-window-topbar {
    background: #f1f5f9;
    padding: 0.45rem 0.9rem;
    font-size: 0.82rem;
    font-weight: 600;
    color: #475569;
    border-bottom: 1px solid #e2e8f0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.75rem;
    flex-shrink: 0;
  }
  .chat-thread-container {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    padding: 0.9rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
    scroll-behavior: smooth;
    background: #ffffff;
  }

  /* メッセージバブル */
  .chat-row-user { display: flex; flex-direction: column; align-items: flex-end; }
  .chat-bubble-user { max-width: 82%; background: #23395d; color: #ffffff; padding: 0.7rem 1rem; border-radius: 14px 14px 2px 14px; font-size: 0.96rem; line-height: 1.6; white-space: pre-wrap; }
  .chat-meta-user { font-size: 0.78rem; color: #64748b; margin-bottom: 0.2rem; }

  .chat-row-ai { display: flex; flex-direction: column; align-items: flex-start; }
  .chat-bubble-ai { max-width: 94%; background: #f8fafc; color: #0f172a; border: 1px solid #e2e8f0; padding: 0.85rem 1.05rem; border-radius: 14px 14px 14px 2px; font-size: 0.98rem; line-height: 1.68; white-space: pre-wrap; }
  .chat-bubble-ai.is-latest { border-color: #93c5fd; background: #f0f7ff; box-shadow: 0 2px 6px rgba(37, 99, 235, 0.08); }
  .chat-meta-ai { font-size: 0.8rem; font-weight: 600; color: #334155; margin-bottom: 0.25rem; display: flex; align-items: center; gap: 0.45rem; }
  .chat-badge-new {
    background: #2563eb;
    color: #fff;
    font-size: 0.7rem;
    padding: 0.12rem 0.5rem;
    border-radius: 999px;
    font-weight: 700;
    white-space: nowrap;
    flex-shrink: 0;
    line-height: 1.2;
  }

  /* ChatGPT風の入力ボックス＋右側送信ボタン */
  .chat-composer-wrapper { margin-top: 0; flex-shrink: 0; }
  .chat-composer {
    display: flex;
    align-items: flex-end;
    gap: 0.5rem;
    border: 1.5px solid #cbd5e1;
    border-radius: 14px;
    background: #ffffff;
    padding: 0.45rem 0.5rem 0.45rem 0.85rem;
    box-shadow: 0 1px 4px rgba(15, 23, 42, 0.05);
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .chat-composer:focus-within {
    border-color: #23395d;
    box-shadow: 0 0 0 3px rgba(35, 57, 93, 0.12);
  }
  .chat-composer textarea {
    flex: 1;
    min-width: 0;
    border: none;
    outline: none;
    resize: none;
    font-family: inherit;
    font-size: 0.96rem;
    line-height: 1.5;
    min-height: 2.5rem;
    max-height: 120px;
    padding: 0.15rem 0;
    background: transparent;
    color: #0f172a;
  }
  .chat-send-btn {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    height: 2.35rem;
    padding: 0 0.95rem;
    border-radius: 10px;
    border: none;
    background: #23395d;
    color: #ffffff;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s;
  }
  .chat-send-btn:hover { background: #1a2b47; }

  /* 入力欄下のフッター（操作ヒント ＆ 対話終了ボタン） */
  .chat-footer-bar { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 0.6rem; margin-top: 0.45rem; }
  .chat-hint-text { font-size: 0.78rem; color: #64748b; }
  .chat-btn-finish { background: #ffffff; color: #0f766e; border: 2px solid #0f766e; border-radius: 8px; padding: 0.42rem 1.1rem; font-size: 0.9rem; font-weight: 700; cursor: pointer; white-space: nowrap; }
  .chat-btn-finish:hover { background: #f0fdfa; }
  .chat-input-error { color: #dc2626; font-size: 0.85rem; font-weight: 600; margin-bottom: 0.3rem; display: none; }

  /* 画面幅が狭いタブレット・スマホでは自動で上下1列に切り替え */
  @media (max-width: 860px) {
    .split-workspace, .split-workspace.has-preview-banner { flex-direction: column; height: auto; }
    .workspace-left, .workspace-right { flex: 1 1 100%; max-width: 100%; width: 100%; height: auto; }
    .task-image-box { height: auto; }
    .task-image-box img { max-height: 300px; width: auto; }
    .chat-thread-container { height: 340px; }
  }
`;

// セッション状態管理変数
let password = null;
let participantId = "";
let selectedTask = null;
let currentAttemptId = 0;
let shouldExitSession = false;
const completedTaskIds = new Set();

let pendingReviewAction = null;
let pendingFollowupText = null;
let loadingTimerId = null;

// プレビュー用のダミー履歴保持（課題IDごと）
const previewHistoryStore = {};

function clearLoadingTimer() {
  if (loadingTimerId !== null) {
    clearInterval(loadingTimerId);
    loadingTimerId = null;
  }
}

const jsPsych = initJsPsych({
  on_finish: () => {
    clearLoadingTimer();
    password = null;
    if (window.FeedbackUtils && typeof FeedbackUtils.clearKey === "function") {
      FeedbackUtils.clearKey();
    }
    jsPsych.getDisplayElement().textContent = "お疲れさまでした。実験担当者に連絡してください。";
  }
});

// プレビュー用のサンプル画像（SVG）
const SAMPLE_SVG_IMAGE = "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="600" height="720" viewBox="0 0 600 720">
    <rect width="600" height="720" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
    <rect x="30" y="30" width="540" height="660" fill="#fdfdfb" stroke="#94a3b8" stroke-width="1.5"/>
    <text x="55" y="75" font-family="sans-serif" font-size="20" font-weight="bold" fill="#334155">【サンプル課題原稿】読書感想文</text>
    <line x1="50" y1="92" x2="550" y2="92" stroke="#cbd5e1" stroke-width="1"/>
    <text x="55" y="135" font-family="sans-serif" font-size="18" fill="#1e293b"> 私が最も印象に残っている本は、夏目漱石の「こころ」</text>
    <text x="55" y="175" font-family="sans-serif" font-size="18" fill="#1e293b">です。最初は難しい言葉が多くて読み進めるのが大変でし</text>
    <text x="55" y="215" font-family="sans-serif" font-size="18" fill="#1e293b">たが、後半になるにつれて登場人物の気持ちの変化が分か</text>
    <text x="55" y="255" font-family="sans-serif" font-size="18" fill="#1e293b">り、とても面白くなりました。</text>
    <text x="55" y="310" font-family="sans-serif" font-size="18" fill="#1e293b"> 特に「私」と先生の関係がどうなるのか気になって最後</text>
    <text x="55" y="350" font-family="sans-serif" font-size="18" fill="#1e293b">まで一気に読みました。人間の弱さや優しさについて考え</text>
    <text x="55" y="390" font-family="sans-serif" font-size="18" fill="#1e293b">させられる一冊でした。</text>
    <text x="55" y="655" font-family="sans-serif" font-size="14" fill="#64748b">※ これはプレビュー用のサンプル画像です</text>
  </svg>
`);

function getDisplayImageSrc(imagePath) {
  if (!PREVIEW_MODE) return imagePath;
  if (String(imagePath).startsWith("data:") || String(imagePath).startsWith("http")) {
    return imagePath;
  }
  return SAMPLE_SVG_IMAGE;
}

// 課題画像を Data URL（Base64）へ変換・キャッシュ（1ターン目のみ使用）
const imageDataUrlCache = {};
async function getImageDataUrl(imagePath) {
  if (String(imagePath).startsWith("data:")) return imagePath;
  if (imageDataUrlCache[imagePath]) return imageDataUrlCache[imagePath];
  const response = await fetch(imagePath);
  if (!response.ok) throw new Error(`課題画像を読み込めませんでした: ${imagePath}`);
  const blob = await response.blob();
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(`課題画像の変換に失敗しました: ${imagePath}`));
    reader.readAsDataURL(blob);
  });
  imageDataUrlCache[imagePath] = dataUrl;
  return dataUrl;
}

// 初回（1ターン目）専用：課題画像を1度だけ添付して OpenAI API へ送信
async function generateInitialWithImage({ systemPrompt, text, imagePath }, callback) {
  let dataUrl;
  try {
    dataUrl = await getImageDataUrl(imagePath);
  } catch (err) {
    callback({ api_error: err.message, ai_feedback: null, generation_attempt: 0 });
    return;
  }

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (url, options = {}) => {
    const urlStr = typeof url === "string" ? url : (url && url.url) || "";
    if (urlStr.includes("api.openai.com") && options.body && typeof options.body === "string") {
      try {
        const payload = JSON.parse(options.body);
        if (typeof payload.input === "string") {
          payload.input = [{
            role: "user",
            content: [
              { type: "input_text", text: payload.input },
              { type: "input_image", image_url: dataUrl }
            ]
          }];
          options = { ...options, body: JSON.stringify(payload) };
        } else if (Array.isArray(payload.messages)) {
          const lastUserMsg = [...payload.messages].reverse().find(m => m.role === "user");
          if (lastUserMsg && typeof lastUserMsg.content === "string") {
            lastUserMsg.content = [
              { type: "text", text: lastUserMsg.content },
              { type: "image_url", image_url: { url: dataUrl } }
            ];
            options = { ...options, body: JSON.stringify(payload) };
          }
        }
      } catch (e) {}
    }
    return originalFetch(url, options);
  };

  try {
    FeedbackUtils.generate({ ...SETTINGS, systemPrompt, text }, result => {
      window.fetch = originalFetch;
      callback(result);
    });
  } catch (err) {
    window.fetch = originalFetch;
    callback({ api_error: String(err), ai_feedback: null, generation_attempt: 0 });
  }
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function buildTaskImageHtml(taskLabel, imagePath, extraClass = "") {
  const cls = extraClass ? `task-image-box ${extraClass}` : "task-image-box";
  const src = getDisplayImageSrc(imagePath);
  return `<div class="${cls}">
    <div style="font-size: 0.92rem; font-weight: 700; margin-bottom: 0.45rem; color: #1e293b; flex-shrink: 0;">${escapeHtml(taskLabel)}：課題画像</div>
    <img src="${escapeHtml(src)}" alt="${escapeHtml(taskLabel)}">
  </div>`;
}

// ChatGPT風の時系列チャットHTMLを生成
function buildChatThreadHtml(generations, pastReviews) {
  const latestIdx = generations.length - 1;
  const messageBlocks = [];

  for (let i = 0; i < generations.length; i++) {
    const isLatest = i === latestIdx;
    const aiLabel = i === 0 ? "AI（文字起こし・初期フィードバック）" : `AI（応答 ${i + 1}回目）`;
    const badgeHtml = isLatest ? `<span class="chat-badge-new">最新</span>` : "";
    const latestAttr = isLatest ? ` id="latest-ai-message"` : "";
    const latestClass = isLatest ? ` is-latest` : "";

    messageBlocks.push(`
      <div class="chat-row-ai"${latestAttr}>
        <div class="chat-meta-ai"><span>${escapeHtml(aiLabel)}</span> ${badgeHtml}</div>
        <div class="chat-bubble-ai${latestClass}">${escapeHtml(generations[i].ai_feedback)}</div>
      </div>
    `);

    if (pastReviews[i] && pastReviews[i].followup_prompt) {
      messageBlocks.push(`
        <div class="chat-row-user">
          <div class="chat-meta-user">あなた（追質問 ${i + 1}回目）</div>
          <div class="chat-bubble-user">${escapeHtml(pastReviews[i].followup_prompt)}</div>
        </div>
      `);
    }
  }

  return `
    <div class="chat-window-wrapper">
      <div class="chat-window-topbar">
        <span>AIとの対話履歴（全 ${generations.length} 件の応答）</span>
        <span>↑↓ スクロールで過去のやり取りを参照できます</span>
      </div>
      <div class="chat-thread-container" id="chat-thread-container">
        ${messageBlocks.join("")}
      </div>
    </div>
  `;
}

function scrollToLatestMessage() {
  setTimeout(() => {
    const container = document.getElementById("chat-thread-container");
    const latestMsg = document.getElementById("latest-ai-message");
    if (container && latestMsg) {
      container.scrollTop = Math.max(0, latestMsg.offsetTop - container.offsetTop - 12);
    }
  }, 60);
}

// 1. 同意確認（本番モードのみ）
const consent = {
  type: jsPsychHtmlButtonResponse,
  data: { feedback_phase: "consent" },
  stimulus: `<p>AIと協働して文章へのフィードバックを作成する実験です（全${TASKS.length}課題）。</p>
    <p>提示された課題画像に対してAIがフィードバック案を生成します。チャット形式で自由にAIへ追質問や修正指示を送り、任意のタイミングで対話を終了して次の課題へ進んでください。</p>
    <p>AIとのすべてのやり取り・操作ログを記録します。個人情報は入力しないでください。</p>`,
  choices: ["同意する", "同意しない"]
};

// 2. パスワード入力（本番モードのみ）
const passwordEntry = {
  type: jsPsychSurvey,
  min_width: "0px",
  data: { feedback_phase: "password_entry" },
  survey_json: {
    showQuestionNumbers: "off", showCompletedPage: false, completeText: "開始",
    elements: [{
      type: "text", name: "password", title: "実験用パスワード",
      inputType: "password", autocomplete: "off", isRequired: true,
      requiredErrorText: "パスワードを入力してください。"
    }]
  },
  on_finish: data => {
    password = data.response.password;
    delete data.response;
  }
};

// 3. OpenAI APIキー復号（本番モードのみ）
const authentication = {
  type: jsPsychCallFunction,
  async: true,
  data: { feedback_phase: "authentication" },
  func: done => {
    const suppliedPassword = password;
    password = null;
    if (!window.ENCRYPTED_API_KEY) {
      done({
        authentication_succeeded: false,
        authentication_error: "External JS に encrypted-api-key.js が設定されていません。"
      });
      return;
    }
    FeedbackUtils.decryptApiKey(window.ENCRYPTED_API_KEY, suppliedPassword, done);
  },
  on_finish: data => { Object.assign(data, data.value); delete data.value; }
};

const authenticationTimeline = {
  timeline: [passwordEntry, authentication],
  conditional_function: () => {
    if (PREVIEW_MODE) return false;
    return jsPsych.data.get().filter({ feedback_phase: "consent" }).last(1).values()[0].response === 0;
  }
};

const consentTimeline = {
  timeline: [consent],
  conditional_function: () => !PREVIEW_MODE
};

// 4. トップ画面（実験参加者 識別NO入力 ＋ 課題選択メニュー）
const taskMenu = {
  type: jsPsychSurvey,
  min_width: "0px",
  data: { feedback_phase: "task_menu" },
  survey_json: {
    showQuestionNumbers: "off",
    showCompletedPage: false,
    showNavigationButtons: false,
    elements: [{ type: "html", name: "menu_view" }]
  },
  survey_function: survey => {
    selectedTask = null;
    shouldExitSession = false;

    const bannerHtml = PREVIEW_MODE
      ? `<div class="preview-banner">【デザイン確認用プレビューモード】API通信は行われません（本番時は PREVIEW_MODE = false に戻してください）</div>`
      : "";

    const taskCardsHtml = TASKS.map((task, index) => {
      const isDone = completedTaskIds.has(task.task_id);
      const cardClass = isDone ? "task-card is-done" : "task-card";
      const badgeHtml = isDone
        ? `<span class="task-status-badge done">実施済み</span>`
        : `<span class="task-status-badge pending">未実施</span>`;
      const btnText = isDone ? "もう一度開く" : "この課題を開始";

      return `
        <div class="${cardClass}">
          <div class="task-card-info">
            <span class="task-card-title">${escapeHtml(task.task_label)}</span>
            ${badgeHtml}
          </div>
          <button type="button" class="task-start-btn" data-task-index="${index}">${btnText}</button>
        </div>
      `;
    }).join("");

    survey.getQuestionByName("menu_view").html = `
      ${bannerHtml}
      <div class="menu-container">
        <div class="menu-header">
          <h2 class="menu-title">課題選択メニュー</h2>
          <p class="menu-subtitle">実験参加者 識別NOを入力し、実施する課題を選択してください。</p>
        </div>

        <div class="participant-id-box">
          <label for="input-participant-id" class="participant-id-label">
            実験参加者 識別NO <span class="participant-id-required">必須</span>
          </label>
          <input type="text" id="input-participant-id" class="participant-id-input"
            value="${escapeHtml(participantId)}"
            placeholder="例: P01 または 101" autocomplete="off">
          <div id="menu-id-error" class="menu-error-msg">※ 課題を開始する前に「実験参加者 識別NO」を入力してください。</div>
        </div>

        <div class="task-list-heading">課題一覧（実施する課題を選択）</div>
        <div class="task-card-list">
          ${taskCardsHtml}
        </div>

        <div class="menu-footer">
          <span class="menu-progress-text">完了状況: ${completedTaskIds.size} / ${TASKS.length} 課題</span>
          <button type="button" id="btn-menu-exit" class="menu-finish-btn">すべての実験を終了する</button>
        </div>
      </div>
    `;

    const bindMenuControls = () => {
      const idInput = document.getElementById("input-participant-id");
      const idError = document.getElementById("menu-id-error");
      const startButtons = document.querySelectorAll(".task-start-btn");
      const exitButton = document.getElementById("btn-menu-exit");

      if (idInput && !idInput.dataset.bound) {
        idInput.dataset.bound = "1";
        idInput.addEventListener("input", () => {
          participantId = idInput.value.trim();
          if (participantId && idError) {
            idError.style.display = "none";
          }
        });
      }

      startButtons.forEach(btn => {
        if (btn.dataset.bound) return;
        btn.dataset.bound = "1";
        btn.addEventListener("click", () => {
          const currentId = idInput ? idInput.value.trim() : "";
          if (!currentId) {
            if (idError) idError.style.display = "block";
            if (idInput) idInput.focus();
            return;
          }
          participantId = currentId;
          jsPsych.data.addProperties({ participant_id: participantId });

          const taskIndex = Number(btn.getAttribute("data-task-index"));
          selectedTask = TASKS[taskIndex];
          currentAttemptId += 1;
          shouldExitSession = false;
          survey.completeLastPage();
        });
      });

      if (exitButton && !exitButton.dataset.bound) {
        exitButton.dataset.bound = "1";
        exitButton.addEventListener("click", () => {
          const remaining = TASKS.length - completedTaskIds.size;
          const confirmMsg = remaining > 0
            ? `まだ未実施の課題が ${remaining} 件あります。実験を終了してもよろしいですか？`
            : "すべての実験を終了しますか？";
          if (!window.confirm(confirmMsg)) return;

          const currentId = idInput ? idInput.value.trim() : participantId;
          if (currentId) {
            participantId = currentId;
            jsPsych.data.addProperties({ participant_id: participantId });
          }
          selectedTask = null;
          shouldExitSession = true;
          survey.completeLastPage();
        });
      }
    };

    survey.onAfterRenderPage.add(bindMenuControls);
    setTimeout(bindMenuControls, 50);
  },
  on_finish: data => {
    data.participant_id = participantId || null;
    data.menu_action = shouldExitSession ? "exit_experiment" : "select_task";
    data.selected_task_id = selectedTask ? selectedTask.task_id : null;
    data.selected_task_label = selectedTask ? selectedTask.task_label : null;
    data.attempt_id = selectedTask ? currentAttemptId : null;
    data.selected_at = new Date().toISOString();
    delete data.response;
  }
};

// 5. 課題画像の事前確認
const taskIntro = {
  type: jsPsychSurvey,
  min_width: "0px",
  data: { feedback_phase: "task_intro" },
  survey_json: {
    showQuestionNumbers: "off", showCompletedPage: false, completeText: "AIに初期フィードバックを生成させる",
    elements: [{ type: "html", name: "task_image_view" }]
  },
  survey_function: survey => {
    survey.getQuestionByName("task_image_view").html = buildTaskImageHtml(
      selectedTask.task_label,
      selectedTask.image_path,
      "task-intro-box"
    );
  },
  on_finish: data => {
    data.participant_id = participantId;
    data.attempt_id = currentAttemptId;
    data.task_id = selectedTask.task_id;
    data.task_label = selectedTask.task_label;
    data.image_path = selectedTask.image_path;
    data.viewed_at = new Date().toISOString();
    delete data.response;
  }
};

// 6. AI生成（1ターン目のみ画像送信＋文字起こし、2ターン目以降はテキスト履歴のみ送信）
const generation = {
  type: jsPsychCallFunction,
  async: true,
  on_load: () => {
    clearLoadingTimer();
    const count = jsPsych.data.get().filter({ feedback_phase: "generation", attempt_id: currentAttemptId }).count();
    const baseMsg = count === 0
      ? "課題画像を読み取り、文字起こしと初期フィードバックを生成しています..."
      : "追質問に対するAIの回答を生成しています...";
    const startMs = Date.now();
    const renderWait = () => {
      const sec = Math.floor((Date.now() - startMs) / 1000);
      jsPsych.getDisplayElement().innerHTML = `
        <div style="text-align:center; padding: 2rem 1rem;">
          <div class="ai-spinner"></div>
          <p style="font-weight:600; color:#1e293b; margin: 0.75rem 0 0.25rem;">${baseMsg}</p>
          <p style="font-size:0.88rem; color:#64748b; margin:0;">経過時間: ${sec}秒</p>
        </div>
      `;
    };
    renderWait();
    loadingTimerId = setInterval(renderWait, 1000);
  },
  data: { feedback_phase: "generation" },
  func: done => {
    const pastGenerations = jsPsych.data.get().filter({ feedback_phase: "generation", attempt_id: currentAttemptId }).values();
    const pastReviews = jsPsych.data.get().filter({ feedback_phase: "review", attempt_id: currentAttemptId }).values();
    const turnIndex = pastGenerations.length + 1;
    const isFirstTurn = turnIndex === 1;

    let apiInputText = "添付した課題画像の文章をすべて正確に文字起こししたうえで、学習者への初期フィードバック案を作成してください。";
    let userPromptInTurn = null;

    if (!isFirstTurn) {
      const historyLines = ["以下は、1回目に読み取った課題画像の文字起こしおよびこれまでのやり取りの履歴です。"];
      for (let i = 0; i < pastGenerations.length; i++) {
        historyLines.push(`【AIの回答（${i + 1}回目）】\n${pastGenerations[i].ai_feedback}`);
        if (pastReviews[i] && pastReviews[i].followup_prompt) {
          historyLines.push(`【教員からの追質問・修正指示（${i + 1}回目）】\n${pastReviews[i].followup_prompt}`);
        }
      }
      userPromptInTurn = pastReviews[pastReviews.length - 1].followup_prompt;
      historyLines.push("上記の【画像内の文章の文字起こし】とこれまでのやり取りを踏まえ、最新の教員からの追質問・修正指示に対して新たな回答を提示してください。");
      apiInputText = historyLines.join("\n\n");
    }

    const record = {
      participant_id: participantId,
      attempt_id: currentAttemptId,
      task_id: selectedTask.task_id,
      task_label: selectedTask.task_label,
      image_path: selectedTask.image_path,
      turn_index: turnIndex,
      image_sent: isFirstTurn,
      user_prompt: userPromptInTurn,
      system_prompt: SYSTEM_PROMPT,
      api_input: apiInputText,
      model: SETTINGS.model,
      reasoning_effort: SETTINGS.reasoningEffort,
      temperature: SETTINGS.temperature,
      max_output_tokens: SETTINGS.maxOutputTokens,
      generated_at: new Date().toISOString()
    };

    // プレビューモード時はダミー応答を即座に返す
    if (PREVIEW_MODE) {
      setTimeout(() => {
        const dummyText = isFirstTurn
          ? `【画像内の文章の文字起こし】\n私が最も印象に残っている本は、夏目漱石の「こころ」です。最初は難しい言葉が多くて読み進めるのが大変でしたが、後半になるにつれて登場人物の気持ちの変化が分かり、とても面白くなりました。\n\n特に「私」と先生の関係がどうなるのか気になって最後まで一気に読みました。人間の弱さや優しさについて考えさせられる一冊でした。\n\n【フィードバック案】\n作品を読み進める中で気持ちが引き込まれていった様子が素直な言葉で書けており、読み手に熱意が伝わる良い文章です。\n\n■ 改善のポイント\n1. 「面白くなりました」という表現を、どのような感情や気づきがあったのか具体的に書き換えると、より説得力が増します。\n2. 後半の展開に触れる際は、一番心が動いた場面を1つ挙げて理由を添えてみましょう。`
          : `ご指示（「${userPromptInTurn}」）を踏まえて調整したダミー応答です。\n\n■ 修正フィードバック案\n生徒が自信を持って書き直せるよう、まずは良い点を具体的に褒めたうえで、「一番印象に残った場面を1つだけ詳しく書いてみよう」と声かけをする構成に整えました。`;
        done({ ...record, api_error: null, ai_feedback: dummyText, generation_attempt: 1 });
      }, 350);
      return;
    }

    if (isFirstTurn) {
      generateInitialWithImage(
        { systemPrompt: SYSTEM_PROMPT, text: apiInputText, imagePath: selectedTask.image_path },
        result => done({ ...record, ...result })
      );
    } else {
      FeedbackUtils.generate(
        { ...SETTINGS, systemPrompt: SYSTEM_PROMPT, text: apiInputText },
        result => done({ ...record, ...result })
      );
    }
  },
  on_finish: data => {
    clearLoadingTimer();
    Object.assign(data, data.value);
    delete data.value;
  }
};

// 7. 左右2カラム対話画面（終了時に全会話履歴を自動集約して記録し、トップ画面へ戻る）
const reviewAndRefine = {
  type: jsPsychSurvey,
  min_width: "0px",
  data: { feedback_phase: "review" },
  survey_json: {
    widthMode: "responsive",
    showQuestionNumbers: "off",
    showCompletedPage: false,
    showNavigationButtons: false,
    elements: [
      { type: "html", name: "collaborative_workspace" }
    ]
  },
  survey_function: survey => {
    pendingReviewAction = null;
    pendingFollowupText = null;

    const generations = jsPsych.data.get().filter({ feedback_phase: "generation", attempt_id: currentAttemptId }).values();
    const pastReviews = jsPsych.data.get().filter({ feedback_phase: "review", attempt_id: currentAttemptId }).values();

    const bannerHtml = PREVIEW_MODE
      ? `<div class="preview-banner">【プレビューモード】参加者ID: ${escapeHtml(participantId)} ／ ${escapeHtml(selectedTask.task_label)}（API通信なし）</div>`
      : "";
    const workspaceClass = PREVIEW_MODE ? "split-workspace has-preview-banner" : "split-workspace";
    const leftColumnHtml = buildTaskImageHtml(selectedTask.task_label, selectedTask.image_path);
    const chatThreadHtml = buildChatThreadHtml(generations, pastReviews);
    const composerHtml = `
      <div class="chat-composer-wrapper">
        <div id="chat-input-error" class="chat-input-error">追質問または修正指示を入力してください。</div>
        <div class="chat-composer">
          <textarea id="chat-followup-input" rows="2" placeholder="AIに追質問や修正指示を送る..."></textarea>
          <button type="button" id="btn-chat-send" class="chat-send-btn" title="送信">
            <span>送信</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>
          </button>
        </div>
        <div class="chat-footer-bar">
          <span class="chat-hint-text">※ 右の「送信」ボタン（または Ctrl+Enter）で追質問を送信できます</span>
          <button type="button" id="btn-chat-finish" class="chat-btn-finish">対話を終了して課題選択へ戻る</button>
        </div>
      </div>
    `;

    survey.getQuestionByName("collaborative_workspace").html = `
      ${bannerHtml}
      <div class="${workspaceClass}">
        <div class="workspace-left">
          ${leftColumnHtml}
        </div>
        <div class="workspace-right">
          ${chatThreadHtml}
          ${composerHtml}
        </div>
      </div>
    `;

    const bindControls = () => {
      scrollToLatestMessage();
      const inputEl = document.getElementById("chat-followup-input");
      const btnSend = document.getElementById("btn-chat-send");
      const btnFinish = document.getElementById("btn-chat-finish");
      const errBox = document.getElementById("chat-input-error");

      const submitFollowup = () => {
        const text = inputEl ? inputEl.value.trim() : "";
        if (!text) {
          if (errBox) errBox.style.display = "block";
          if (inputEl) inputEl.focus();
          return;
        }
        if (errBox) errBox.style.display = "none";
        pendingReviewAction = "refine";
        pendingFollowupText = text;
        survey.completeLastPage();
      };

      if (inputEl && !inputEl.dataset.bound) {
        inputEl.dataset.bound = "1";
        inputEl.addEventListener("input", () => {
          inputEl.style.height = "auto";
          inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + "px";
        });
        inputEl.addEventListener("keydown", e => {
          if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
            e.preventDefault();
            submitFollowup();
          }
        });
      }

      if (btnSend && !btnSend.dataset.bound) {
        btnSend.dataset.bound = "1";
        btnSend.addEventListener("click", submitFollowup);
      }

      if (btnFinish && !btnFinish.dataset.bound) {
        btnFinish.dataset.bound = "1";
        btnFinish.addEventListener("click", () => {
          const unsentText = inputEl ? inputEl.value.trim() : "";
          if (unsentText && !window.confirm("入力欄に未送信のメッセージがあります。送信せずに対話を終了して課題選択へ戻りますか？")) {
            return;
          }
          pendingReviewAction = "finish";
          pendingFollowupText = null;
          survey.completeLastPage();
        });
      }
    };

    survey.onAfterRenderPage.add(bindControls);
    setTimeout(bindControls, 50);
  },
  on_finish: data => {
    const generations = jsPsych.data.get().filter({ feedback_phase: "generation", attempt_id: currentAttemptId }).values();
    const pastReviews = jsPsych.data.get().filter({ feedback_phase: "review", attempt_id: currentAttemptId }).values();
    const currentGen = generations[generations.length - 1];
    const action = pendingReviewAction || "finish";
    const followupPrompt = action === "refine" ? pendingFollowupText : null;

    data.participant_id = participantId;
    data.attempt_id = currentAttemptId;
    data.task_id = selectedTask.task_id;
    data.task_label = selectedTask.task_label;
    data.image_path = selectedTask.image_path;
    data.turn_index = generations.length;
    data.ai_feedback_reviewed = currentGen.ai_feedback;
    data.action = action;
    data.followup_prompt = followupPrompt;
    data.reviewed_at = new Date().toISOString();

    if (action === "finish") {
      completedTaskIds.add(selectedTask.task_id);

      const allReviews = [...pastReviews, { action, followup_prompt: null, rt: data.rt }];
      const structuredHistory = generations.map((gen, idx) => {
        const rev = allReviews[idx] || {};
        return {
          turn: gen.turn_index,
          image_sent: gen.image_sent,
          user_prompt: gen.user_prompt || "（初回生成依頼：文字起こし＋初期FB）",
          ai_feedback: gen.ai_feedback,
          action: rev.action || null,
          followup_prompt: rev.followup_prompt || null,
          generation_rt_ms: gen.rt,
          review_rt_ms: rev.rt || null
        };
      });

      const readableHistory = structuredHistory.map(item => {
        const lines = [
          `=== ターン ${item.turn}（画像送信: ${item.image_sent ? "あり" : "なし"}） ===`,
          `[教員の指示] ${item.user_prompt}`,
          `[AIの応答]\n${item.ai_feedback}`
        ];
        if (item.followup_prompt) lines.push(`[教員の追質問] ${item.followup_prompt}`);
        return lines.join("\n");
      }).join("\n\n");

      data.task_completed = true;
      data.total_turns = generations.length;
      data.followup_count = generations.length - 1;
      data.initial_ai_output = generations[0].ai_feedback;
      data.final_ai_output = currentGen.ai_feedback;
      data.interaction_history_json = JSON.stringify(structuredHistory);
      data.interaction_history_text = readableHistory;
    }

    delete data.response;
  }
};

// 生成失敗時の案内
const generationFailure = {
  type: jsPsychHtmlButtonResponse,
  data: { feedback_phase: "generation_failure_notice" },
  stimulus: () => {
    const lastGen = jsPsych.data.get().filter({ feedback_phase: "generation", attempt_id: currentAttemptId }).last(1).values()[0];
    return `<p>AIの応答を取得できませんでした。課題選択画面に戻ります。</p>
      <p style="font-size:0.85rem; color:#64748b;">詳細: ${escapeHtml(lastGen?.api_error || "不明なエラー")}</p>`;
  },
  choices: ["課題選択へ戻る"],
  on_finish: data => {
    data.participant_id = participantId;
    data.attempt_id = currentAttemptId;
    data.task_id = selectedTask ? selectedTask.task_id : null;
  }
};

// 「対話を終了して課題選択へ戻る」が押されるまでループ
const collaborativeLoop = {
  timeline: [
    generation,
    {
      timeline: [reviewAndRefine],
      conditional_function: () => {
        const lastGen = jsPsych.data.get().filter({ feedback_phase: "generation", attempt_id: currentAttemptId }).last(1).values()[0];
        return !lastGen.api_error;
      }
    },
    {
      timeline: [generationFailure],
      conditional_function: () => {
        const lastGen = jsPsych.data.get().filter({ feedback_phase: "generation", attempt_id: currentAttemptId }).last(1).values()[0];
        return Boolean(lastGen.api_error);
      }
    }
  ],
  loop_function: () => {
    const lastGen = jsPsych.data.get().filter({ feedback_phase: "generation", attempt_id: currentAttemptId }).last(1).values()[0];
    if (lastGen.api_error) return false;

    const lastReview = jsPsych.data.get().filter({ feedback_phase: "review", attempt_id: currentAttemptId }).last(1).values()[0];
    return lastReview.action === "refine";
  }
};

// 選択された1つの課題を実行するサブタイムライン
const runSelectedTaskTimeline = {
  timeline: [taskIntro, collaborativeLoop],
  conditional_function: () => !shouldExitSession && Boolean(selectedTask)
};

// トップ画面（課題選択）と選択課題の実行を繰り返すメインループ
const taskMenuLoop = {
  timeline: [taskMenu, runSelectedTaskTimeline],
  loop_function: () => !shouldExitSession,
  conditional_function: () => {
    if (PREVIEW_MODE) return true;
    const consentRow = jsPsych.data.get().filter({ feedback_phase: "consent" }).last(1).values()[0];
    if (!consentRow || consentRow.response !== 0) return false;
    const authRow = jsPsych.data.get().filter({ feedback_phase: "authentication" }).last(1).values()[0];
    return Boolean(authRow && authRow.authentication_succeeded);
  }
};

// 8. 終了画面
const sessionFinish = {
  type: jsPsychHtmlButtonResponse,
  data: { feedback_phase: "session_end" },
  stimulus: () => {
    if (PREVIEW_MODE) {
      return `<p>プレビュー表示の確認が完了しました（参加者ID: ${escapeHtml(participantId || "未入力")}）。</p>
        <p style="font-size:0.9rem; color:#475569;">本番で実験を行う際は、コード先頭の <code>const PREVIEW_MODE = false;</code> に変更してください。</p>`;
    }
    const consentRow = jsPsych.data.get().filter({ feedback_phase: "consent" }).last(1).values()[0];
    if (consentRow.response !== 0) return "<p>実験を終了します。</p>";
    const auth = jsPsych.data.get().filter({ feedback_phase: "authentication" }).last(1).values()[0];
    if (!auth || !auth.authentication_succeeded) {
      const reason = auth?.authentication_error || auth?.error || "パスワードが違うか、APIキーの復号に失敗しました。";
      return `<p>実験を開始できませんでした。実験者にお知らせください。</p><p style="font-size:0.85rem; color:#64748b;">理由: ${escapeHtml(reason)}</p>`;
    }
    return "<p>ご協力ありがとうございました。</p>";
  },
  choices: ["終了"]
};

const timeline = [consentTimeline, authenticationTimeline, taskMenuLoop, sessionFinish];

const surveyStylesheet = document.createElement("link");
surveyStylesheet.rel = "stylesheet";
surveyStylesheet.href = "https://unpkg.com/@jspsych/plugin-survey@4.0.0/css/survey.min.css";
const feedbackUtilsScript = document.createElement("script");
feedbackUtilsScript.src = "https://cdn.jsdelivr.net/gh/kishiyamat/jspsych-openai-utils@1eb526cda0aad424f3efb4ddb1da926d099f5df1/dist/feedback-utils.js";
feedbackUtilsScript.onload = () => jsPsych.run(timeline);
feedbackUtilsScript.onerror = () => {
  if (PREVIEW_MODE) {
    jsPsych.run(timeline);
  } else {
    document.body.textContent = "共通ライブラリを読み込めませんでした。ページを再読み込みしてください。";
  }
};
surveyStylesheet.onload = () => {
  document.head.append(experimentStyle);
  document.head.append(feedbackUtilsScript);
};
surveyStylesheet.onerror = () => {
  document.body.textContent = "Surveyのスタイルを読み込めませんでした。ページを再読み込みしてください。";
};
document.head.append(surveyStylesheet);