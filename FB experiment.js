// =========================================================================
// ★ プレビュー切り替えスイッチ ★
// true  : APIキーなしで「トップ画面〜AIとの会話画面」の流れを即座に確認できます
// false : 本番モード（同意確認 → パスワード認証 → トップ画面 → AI対話）で動作します
// =========================================================================
const PREVIEW_MODE = false;

// Cognition の Source code に貼り付ける jsPsych 8 / Survey 4 のコード（OpenAI API版・課題選択トップ画面付き）
// External JS: OpenAI APIキーを暗号化した encrypted-api-key.js をアップロードしてください。
// External CSS: FB experiment.css の内容を Cognition.run に登録してください。
// Plugins: survey / html-button-response / call-function を有効にしてください。
// TASKS: 研究者が作成した作文を essay_text に登録してください（画像・OCRは使用しません）。

// ① 初期FBは表層的な誤りを優先し、後続対話は教師の指示に柔軟に対応
const SYSTEM_PROMPT = `あなたは教員の文章指導を支援するAIです。
【1回目の応答】
提示された学習者の文章を原文とし、日本語で【フィードバック案】の見出しを使って回答してください。
初期フィードバックでは文法・語彙・スペリングなど表層的な誤りを優先し、改善点と具体的な改善案（書き換え例を含む）を簡潔に提示してください。
内容・構成についても必要に応じて指摘して構いません。学習者の意図を根拠なく断定しないでください。

【2回目以降の応答】
最初に提示された学習者の文章を原文として参照し、これまでのやり取りと教員からの最新の追質問・修正指示を踏まえて、日本語で簡潔に応答してください。教員の指示に応じて内容・構成・文脈に関する改善にも対応してください。`;

// OpenAI の生成設定（必要に応じて model を "gpt-4o" や "gpt-4o-mini" 等に変更してください）
const SETTINGS = {
  model: "gpt-6-luna",
  reasoningEffort: "none",
  temperature: 0.3,
  maxOutputTokens: 8000
};

// 課題ごとに研究者が作成した作文を設定する（同じessay_textを教師画面とAIで使用）
const TASKS = [
  { task_id: "task_1", task_label: "課題 1", essay_id: "essay_1", essay_text: null },
  { task_id: "task_2", task_label: "課題 2", essay_id: "essay_2", essay_text: null },
  { task_id: "task_3", task_label: "課題 3", essay_id: "essay_3", essay_text: null }
];

// スタイルは Cognition.run の External CSS（FB experiment.css）に登録してください。

// セッション状態管理変数
let password = null;
let participantId = "";
let selectedTask = null;
let currentAttemptId = 0;
let currentAttemptUid = null;
const sessionId = (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function")
  ? crypto.randomUUID()
  : `session_${Date.now()}_${Math.random().toString(36).slice(2)}`;
let shouldExitSession = false;
const completedTaskIds = new Set();

let pendingReviewAction = null;
let pendingFollowupText = null;
let teacherFinalDraft = "";
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

jsPsych.data.addProperties({ session_id: sessionId });

// プレビュー専用の例文。研究用のTASKSには使用しない。
const PREVIEW_ESSAY = "I likes English because it is very interesting. I study English every days.";

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function getEssayText(task) {
  return (typeof task.essay_text === "string" && task.essay_text.trim())
    ? task.essay_text
    : (PREVIEW_MODE ? PREVIEW_ESSAY : "");
}

function buildTaskEssayHtml(task, extraClass = "") {
  const cls = extraClass ? `task-essay-box ${extraClass}` : "task-essay-box";
  return `<div class="${cls}">
    <div class="task-essay-heading">${escapeHtml(task.task_label)}：作文</div>
    <div class="task-essay-text">${escapeHtml(getEssayText(task))}</div>
  </div>`;
}

// ChatGPT風の時系列チャットHTMLを生成
function buildChatThreadHtml(generations, pastReviews) {
  const latestIdx = generations.length - 1;
  const messageBlocks = [];

  for (let i = 0; i < generations.length; i++) {
    const isLatest = i === latestIdx;
    const aiLabel = i === 0 ? "AI（初期フィードバック）" : `AI（応答 ${i + 1}回目）`;
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
    <p>研究者が作成した作文に対してAIがフィードバック案を生成します。教師がAIとの対話を参考に最終フィードバックを作成します。チャット形式で自由にAIへ追質問や修正指示を送り、任意のタイミングで対話を終了して次の課題へ進んでください。</p>
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
        if (participantId) idInput.readOnly = true;
        idInput.addEventListener("input", () => {
          if (idInput.value.trim() && idError) idError.style.display = "none";
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
          if (participantId && currentId !== participantId) {
            window.alert("参加者IDはこの実験中に変更できません。");
            return;
          }
          const taskIndex = Number(btn.getAttribute("data-task-index"));
          const nextTask = TASKS[taskIndex];
          if (!PREVIEW_MODE && !(typeof nextTask.essay_text === "string" && nextTask.essay_text.trim())) {
            window.alert("この課題の作文が未設定です。研究者がTASKSのessay_textを設定してください。");
            return;
          }
          if (!participantId) {
            participantId = currentId;
            jsPsych.data.addProperties({ participant_id: participantId });
          }
          selectedTask = nextTask;
          teacherFinalDraft = "";
          currentAttemptId += 1;
          currentAttemptUid = (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function")
            ? crypto.randomUUID()
            : `${sessionId}_attempt_${currentAttemptId}`;
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
          if (!participantId && currentId) {
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
    data.attempt_uid = selectedTask ? currentAttemptUid : null;
    data.selected_at = new Date().toISOString();
    delete data.response;
  }
};

// 5. 作文の事前確認
const taskIntro = {
  type: jsPsychSurvey,
  min_width: "0px",
  data: { feedback_phase: "task_intro" },
  survey_json: {
    showQuestionNumbers: "off", showCompletedPage: false, completeText: "AIに初期フィードバックを生成させる",
    elements: [{ type: "html", name: "task_essay_view" }]
  },
  survey_function: survey => {
    survey.getQuestionByName("task_essay_view").html = buildTaskEssayHtml(selectedTask, "task-intro-box");
  },
  on_finish: data => {
    data.participant_id = participantId;
    data.attempt_id = currentAttemptId;
    data.attempt_uid = currentAttemptUid;
    data.task_id = selectedTask.task_id;
    data.task_label = selectedTask.task_label;
    data.essay_id = selectedTask.essay_id;
    data.essay_text = getEssayText(selectedTask);
    data.viewed_at = new Date().toISOString();
    delete data.response;
  }
};

// 6. AI生成（初回は作文テキスト、2ターン目以降は原文と対話履歴を送信）
const generation = {
  type: jsPsychCallFunction,
  async: true,
  on_load: () => {
    clearLoadingTimer();
    const count = jsPsych.data.get().filter({ feedback_phase: "generation", attempt_id: currentAttemptId }).count();
    const baseMsg = count === 0
      ? "課題の文章に対する初期フィードバックを生成しています..."
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

    const essayText = getEssayText(selectedTask);
    let apiInputText = `【学習者の文章】\n${essayText}\n\n上記の文章に対する初期フィードバック案を作成してください。`;
    let userPromptInTurn = null;

    if (!isFirstTurn) {
      const historyLines = [`【学習者の文章】\n${essayText}`, "以下は、これまでのやり取りの履歴です。"];
      for (let i = 0; i < pastGenerations.length; i++) {
        historyLines.push(`【AIの回答（${i + 1}回目）】\n${pastGenerations[i].ai_feedback}`);
        if (pastReviews[i] && pastReviews[i].followup_prompt) {
          historyLines.push(`【教員からの追質問・修正指示（${i + 1}回目）】\n${pastReviews[i].followup_prompt}`);
        }
      }
      userPromptInTurn = pastReviews[pastReviews.length - 1].followup_prompt;
      historyLines.push("上記の学習者の文章とこれまでのやり取りを踏まえ、最新の教員からの追質問・修正指示に対して新たな回答を提示してください。");
      apiInputText = historyLines.join("\n\n");
    }

    const record = {
      participant_id: participantId,
      attempt_id: currentAttemptId,
      attempt_uid: currentAttemptUid,
      task_id: selectedTask.task_id,
      task_label: selectedTask.task_label,
      essay_id: selectedTask.essay_id,
      essay_text: essayText,
      turn_index: turnIndex,
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
          ? `【フィードバック案】\n作品を読み進める中で気持ちが引き込まれていった様子が素直な言葉で書けており、読み手に熱意が伝わる良い文章です。\n\n■ 改善のポイント\n1. 「面白くなりました」という表現を、どのような感情や気づきがあったのか具体的に書き換えると、より説得力が増します。\n2. 後半の展開に触れる際は、一番心が動いた場面を1つ挙げて理由を添えてみましょう。`
          : `ご指示（「${userPromptInTurn}」）を踏まえて調整したダミー応答です。\n\n■ 修正フィードバック案\n生徒が自信を持って書き直せるよう、まずは良い点を具体的に褒めたうえで、「一番印象に残った場面を1つだけ詳しく書いてみよう」と声かけをする構成に整えました。`;
        done({ ...record, api_error: null, ai_feedback: dummyText, generation_attempt: 1 });
      }, 350);
      return;
    }

    if (!essayText.trim()) {
      done({ ...record, api_error: "作文が未設定です。", ai_feedback: null, generation_attempt: 0 });
      return;
    }
    FeedbackUtils.generate(
      { ...SETTINGS, systemPrompt: SYSTEM_PROMPT, text: apiInputText },
      result => done({ ...record, ...result })
    );
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
    const essayPanelHtml = buildTaskEssayHtml(selectedTask);
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

    const teacherFeedbackHtml = `
      <div class="teacher-final-box">
        <label class="teacher-final-label" for="teacher-final-feedback">最終FB（教師が作成）</label>
        <textarea id="teacher-final-feedback" class="teacher-final-textarea" placeholder="AIとの対話を参考に、教師自身の最終フィードバックを入力してください。">${escapeHtml(teacherFinalDraft)}</textarea>
        <div id="teacher-final-error" class="chat-input-error">最終FBを入力してください。</div>
      </div>
    `;

    survey.getQuestionByName("collaborative_workspace").html = `
      ${bannerHtml}
      <div class="${workspaceClass}">
        <div class="workspace-left">
          ${chatThreadHtml}
          ${composerHtml}
        </div>
        <div class="workspace-right">
          ${essayPanelHtml}
          ${teacherFeedbackHtml}
        </div>
      </div>
    `;

    const bindControls = () => {
      scrollToLatestMessage();
      const inputEl = document.getElementById("chat-followup-input");
      const btnSend = document.getElementById("btn-chat-send");
      const btnFinish = document.getElementById("btn-chat-finish");
      const errBox = document.getElementById("chat-input-error");
      const finalInputEl = document.getElementById("teacher-final-feedback");
      const finalError = document.getElementById("teacher-final-error");
      if (finalInputEl && !finalInputEl.dataset.bound) {
        finalInputEl.dataset.bound = "1";
        finalInputEl.addEventListener("input", () => {
          teacherFinalDraft = finalInputEl.value;
          if (teacherFinalDraft.trim() && finalError) finalError.style.display = "none";
        });
      }

      const submitFollowup = () => {
        const text = inputEl ? inputEl.value.trim() : "";
        if (!text) {
          if (errBox) errBox.style.display = "block";
          if (inputEl) inputEl.focus();
          return;
        }
        if (errBox) errBox.style.display = "none";
        if (finalInputEl) teacherFinalDraft = finalInputEl.value;
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
          if (finalInputEl) teacherFinalDraft = finalInputEl.value;
          if (!teacherFinalDraft.trim()) {
            if (finalError) finalError.style.display = "block";
            if (finalInputEl) finalInputEl.focus();
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
    data.essay_id = selectedTask.essay_id;
    data.essay_text = getEssayText(selectedTask);
    data.attempt_uid = currentAttemptUid;
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
          user_prompt: gen.user_prompt || "（初回生成依頼：初期FB）",
          ai_feedback: gen.ai_feedback,
          action: rev.action || null,
          followup_prompt: rev.followup_prompt || null,
          generation_rt_ms: gen.rt,
          review_rt_ms: rev.rt || null
        };
      });

      const readableHistory = structuredHistory.map(item => {
        const lines = [
          `=== ターン ${item.turn} ===`,
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
      data.teacher_final_feedback = teacherFinalDraft.trim();
      data.interaction_history_json = JSON.stringify(structuredHistory);
      data.interaction_history_text = readableHistory;
      teacherFinalDraft = "";
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
    data.attempt_uid = currentAttemptUid;
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
  document.head.append(feedbackUtilsScript);
};
surveyStylesheet.onerror = () => {
  document.body.textContent = "Surveyのスタイルを読み込めませんでした。ページを再読み込みしてください。";
};
document.head.append(surveyStylesheet);