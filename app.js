const $ = (selector) => document.querySelector(selector);

const elements = {
  incoming: $("#incoming"),
  context: $("#context"),
  relation: $("#relation"),
  goal: $("#goal"),
  charCount: $("#charCount"),
  generate: $("#generateButton"),
  copy: $("#copyButton"),
  save: $("#saveButton"),
  draft: $("#draftText"),
  alternate: $("#alternateText"),
  alternateBox: $("#alternateBox"),
  useAlternate: $("#useAlternate"),
  savedPanel: $("#savedPanel"),
  savedList: $("#savedList"),
  showSaved: $("#showSaved"),
  closeSaved: $("#closeSaved"),
  fact: $("#factText"),
  unknown: $("#unknownText"),
  next: $("#nextText"),
  badge: $("#signalBadge"),
  privacyButton: $("#privacyButton"),
  privacyPanel: $("#privacyPanel"),
  clearSaved: $("#clearSaved"),
  clearAccessCodePrivacy: $("#clearAccessCodePrivacy"),
  clearAccessCode: $("#clearAccessCode"),
  accessCode: $("#accessCode"),
  accessBox: $("#accessBox"),
  modelNote: $("#modelNote"),
  processingNote: $("#processingNote"),
  answerSource: $("#answerSource"),
  generateLabel: $("#generateLabel"),
  requestStatus: $("#requestStatus"),
  installTip: $("#installTip"),
  showInstall: $("#showInstall"),
  dismissInstall: $("#dismissInstall"),
  toast: $("#toast"),
  brandSubtitle: $("#brandSubtitle"),
  connectionBanner: $("#connectionBanner"),
};

let currentDraft = "";
let currentAlternate = "";
let activeRequest = 0;
const apiUrl = window.GOUTOUJUNSHI_CONFIG?.apiUrl?.trim() || "";
const availableProviders = window.GOUTOUJUNSHI_CONFIG?.availableProviders || [];
const providerNames = { deepseek: "DeepSeek", openai: "ChatGPT", offline: "离线应急" };
elements.brandSubtitle.textContent = availableProviders.length ? "AI / 离线，随时切换" : "离线可用 · AI 接入中";
elements.connectionBanner.hidden = availableProviders.length > 0;

function provider() {
  return document.querySelector('input[name="provider"]:checked')?.value || "offline";
}

function setStatus(message, error = false) {
  elements.requestStatus.textContent = message;
  elements.requestStatus.classList.toggle("is-error", error);
}

function updateProviderUi(resetStatus = true) {
  const selected = provider();
  const online = selected !== "offline";
  const ready = online && !!apiUrl && availableProviders.includes(selected);
  elements.accessBox.hidden = !ready;
  elements.processingNote.textContent = ready ? "联机会发送给所选 AI 服务" : "当前只在本机处理";
  elements.modelNote.textContent = online
    ? ready ? `已选 ${providerNames[selected]} · 内容会发送到该服务处理` : `${providerNames[selected]} 尚未接通；目前可用离线应急。`
    : "离线建议不调用 AI，适合没网络时应急。";
  elements.generateLabel.textContent = online ? ready ? `用 ${providerNames[selected]} 生成回复` : `${providerNames[selected]} 待接通` : "给我一条能直接发的";
  elements.generate.disabled = online && !ready;
  if (!currentDraft) elements.answerSource.textContent = `首选回复 · ${online ? providerNames[selected] : "离线建议"}`;
  if (resetStatus) setStatus("");
  try { localStorage.setItem("goutoujunshi.provider", selected); } catch {}
}

const categoryRules = [
  { id: "stop", pattern: /别(再)?联系|不(要|想)(再)?联系|不想发展|没感觉|不合适|到此为止|别来找我|请你停止/ },
  { id: "conflict", pattern: /生气|失望|烦|不想说|累了|受够|难受|吵|冷静一下/ },
  { id: "apology", pattern: /对不起|抱歉|不好意思|我错了|原谅/ },
  { id: "busy", pattern: /最近.*忙|加班|没空|晚点|改天|过段时间|下次再说|抽不开身/ },
  { id: "cancel", pattern: /去不了|来不了|取消|临时有事|改天吧|放鸽子/ },
  { id: "late", pattern: /刚看到|忘(记)?回|睡着|没看手机|才看到/ },
  { id: "invite", pattern: /有空吗|一起|出来|吃饭|喝咖啡|看电影|周末|见面/ },
  { id: "affection", pattern: /想你|喜欢你|爱你|可爱|漂亮|好看|帅|心动/ },
];

function classify(text) {
  const hit = categoryRules.find((rule) => rule.pattern.test(text));
  if (hit) return hit.id;
  if (text.replace(/[\s，。！？,.!?~～]/g, "").length <= 4) return "cold";
  if (/[？?]$/.test(text.trim())) return "question";
  return "general";
}

function tone() {
  return document.querySelector('input[name="tone"]:checked')?.value || "稳妥";
}

function resultFor({ incoming, relation, goal, tone: selectedTone, context = "" }) {
  const category = classify(incoming);
  const wantsExit = goal === "退出";
  const wantsRepair = goal === "修复";
  const boundary = selectedTone === "有边界";
  const repeated = /多次|反复|连续|好几次|总是|第三次|一再|一直不/.test(context);

  if (category === "stop") {
    return {
      badge: "明确停止信号",
      stop: true,
      draft: "收到，我尊重你的决定。之后我不会再打扰你，祝你一切顺利。",
      alternate: "明白，谢谢你说清楚。我会把边界留好，也祝你之后顺利。",
      fact: "对方表达了不想继续联系或发展的明确边界。",
      unknown: "无需把拒绝解释成欲擒故纵，也不需要证明自己。",
      next: "发出一次确认后停止联系，不再追加解释或追问。",
    };
  }

  if (wantsExit) {
    return {
      badge: "体面收线",
      draft: "谢谢你坦诚说这些。我想了想，我们现在的节奏不太适合我，就先走到这里吧。祝你之后一切顺利。",
      alternate: "我理解你的处境，不过我更需要一段有回应、能落地的关系。所以我先不继续投入了，保重。",
      fact: "你已经把这次目标设为退出，而不是继续争取。",
      unknown: "无需判断谁对谁错，重点是这段互动是否适合你。",
      next: "发出后不进入拉扯；若对方挽回，只看是否提出具体改变。",
    };
  }

  const replies = {
    busy: {
      稳妥: "理解，你先忙好手上的事。等你缓下来，如果还想见面，就给我一个你方便的具体时间。",
      会撩: "好，那先把你借给工作一阵子。等你忙完，记得带着具体时间回来找我。",
      有边界: "理解你忙，我就先不反复打扰了。你确定有时间、也想继续的话，再约一个具体日期。",
      fact: "对方表达了忙或把安排推迟，但暂时没有给出明确的新时间。",
      unknown: "忙可能是真的，也可能代表优先级有限；仅凭这一句不能定性。",
      next: "先停下追问，观察对方是否主动带着具体时间回来。",
    },
    cancel: {
      稳妥: "没关系，临时有事可以理解。你方便后重新定个时间，我们再约。",
      会撩: "这次先记在小本本上。等你忙完，补我一个你认真选的时间就好。",
      有边界: "收到。这次我先不继续改时间了，你确定能安排好时再主动约我。",
      fact: "原定安排发生变化，关键要看对方是否主动补约。",
      unknown: "一次取消不能说明态度，连续取消且不补约才更有判断价值。",
      next: "不立即提供多个备选时间，把重新安排的动作交给取消方。",
    },
    apology: {
      稳妥: wantsRepair ? "我听到了你的道歉。对我来说，重要的不只是这句话，而是之后我们能不能把同样的问题处理得更好。" : "谢谢你愿意道歉，我收到了。我们可以慢一点，把之后怎么避免再发生说清楚。",
      会撩: "道歉收到，不过我更喜欢行动版。下次做得更好，这一篇就有机会翻过去。",
      有边界: "我接受你愿意道歉，但这件事对我确实有影响。接下来我会看实际改变，再决定怎么继续。",
      fact: "对方已经表达歉意，但道歉是否有效还要看理解、补救和后续行动。",
      unknown: "暂时不能仅凭一句道歉判断问题已经解决。",
      next: "确认对方是否理解具体伤害，并观察相同行为是否停止。",
    },
    conflict: {
      稳妥: "我听得出你现在很难受。我不想在情绪最满的时候争输赢，我们先缓一缓，等都能好好说话时把这件事讲清楚。",
      会撩: "我先不和情绪抢话。你缓一缓，等我们都不带刺了，再把真正介意的那部分说给我听。",
      有边界: "我愿意沟通，但不接受互相攻击。我们先暂停，等能尊重彼此地说话时再继续。",
      fact: "对方正在表达强烈负面情绪，此刻继续辩解容易升级冲突。",
      unknown: "情绪背后的具体诉求仍不清楚，先别替对方下结论。",
      next: "暂停争论，约定稍后再谈；若出现辱骂或威胁，优先拉开距离。",
    },
    late: {
      稳妥: "没事，看到就好。你现在方便的话，我们接着聊刚才那个话题。",
      会撩: "批准你这次补交回复。那刚才的问题，现在轮到你认真答了。",
      有边界: "收到。偶尔没看到可以理解，不过我更喜欢有来有回的沟通节奏。",
      fact: "对方解释了延迟回复，但这一次本身不足以判断投入程度。",
      unknown: "不用从单次回复间隔推测喜欢或不喜欢。",
      next: "继续正常交流，关注长期是否稳定主动，而不是盯一次间隔。",
    },
    invite: {
      稳妥: "可以呀，我也想见你。把时间和地点定具体一点，我看看安排。",
      会撩: "可以，终于等到你把聊天升级成见面了。时间地点交给你，我来验收。",
      有边界: "可以考虑。你把具体时间和安排发我，确定后我们再算约好。",
      fact: "对方释放了见面或共同活动的信号，可以用具体安排验证意愿。",
      unknown: "口头邀约不等于已经确定，仍要看时间、地点和兑现。",
      next: "把邀约具体化；未确定时间前不为它空出整天。",
    },
    affection: {
      稳妥: "这句话我很喜欢听。其实我也在认真感受我们之间的靠近。",
      会撩: "这么会说，是想让我今天一直想着你吗？不过巧了，我也有一点想你。",
      有边界: "谢谢你坦白表达。我也有好感，不过我更想让关系在了解和行动里慢慢落地。",
      fact: "对方表达了欣赏或好感，这是积极信号。",
      unknown: "好听的话需要和持续投入、兑现及尊重边界一起看。",
      next: "给出同等强度的真实回应，再推动一次具体见面或交流。",
    },
    cold: {
      稳妥: "感觉你现在不太想展开聊，我先不追着问。等你想说的时候再告诉我。",
      会撩: "今天是惜字如金模式吗？那我先把话题存着，等你有兴致再继续。",
      有边界: "如果你现在不想聊可以直接说，我会尊重；我也不会靠猜来维持对话。",
      fact: "回复很短，能确认的信息有限。",
      unknown: "短回复可能来自情绪、忙碌或兴趣下降，不能只凭一次判断。",
      next: "减少连续追问，观察之后是否主动恢复交流。",
    },
    question: {
      稳妥: "可以，我愿意认真回答。对我来说，更重要的是我们都把真实想法说清楚，不用互相猜。",
      会撩: "这个问题值得认真答，不过我也想听你的答案。我们公平一点，一人一次。",
      有边界: "我可以坦诚回答，也希望这是双向沟通，而不是只有我一个人在交代。",
      fact: "对方提出了问题，适合直接回应而不是绕开。",
      unknown: "问题背后的动机暂时未知，先就问题本身沟通。",
      next: "一次只回答一个核心问题，并邀请对方表达同等信息。",
    },
    general: {
      稳妥: goal === "确认" ? "我挺在意我们现在的关系，也想听听你的真实想法。你是愿意继续认真了解，还是更想停在现在的位置？" : "我明白你的意思了。对我来说，舒服的关系应该是有回应、也能把话说清楚，我们可以按这个节奏慢慢来。",
      会撩: "这句话我先收下，不过我更想看行动版。你准备怎么让我相信？",
      有边界: "我听到了。我的态度也很明确：愿意沟通，但希望回应和投入是双向的。",
      fact: `对方给出了一段关于你们“${relation}”状态下的回应。`,
      unknown: "目前只能依据字面信息，不能直接推断真实动机。",
      next: "用一个清楚的小动作验证：具体邀约、明确问题，或给出观察窗口。",
    },
  };

  const selected = replies[category];
  if (repeated && (category === "busy" || category === "cancel")) {
    return {
      badge: "注意重复模式",
      stop: false,
      draft: selected["有边界"],
      alternate: selected["稳妥"],
      fact: "你补充说类似情况已反复出现；这是你的背景描述，仍需看具体记录。",
      unknown: "还不能确定对方的原因，但反复没有具体安排值得认真对待。",
      next: "先停止单方面改期或追问；只在对方主动提出并兑现具体安排时重新投入。",
    };
  }
  const secondaryTone = boundary ? "稳妥" : "有边界";
  return {
    badge: category === "affection" || category === "invite" ? "积极信号" : "保持观察",
    stop: false,
    draft: selected[selectedTone],
    alternate: selected[secondaryTone],
    fact: selected.fact,
    unknown: selected.unknown,
    next: selected.next,
  };
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  window.setTimeout(() => elements.toast.classList.remove("show"), 1800);
}

function readSaved() {
  try {
    const value = JSON.parse(localStorage.getItem("goutoujunshi.saved") || "[]");
    return Array.isArray(value) ? value.filter((entry) => entry && typeof entry.reply === "string") : [];
  } catch {
    return [];
  }
}

function renderSaved() {
  elements.savedList.replaceChildren();
  const saved = readSaved();
  if (!saved.length) {
    const empty = document.createElement("p");
    empty.className = "saved-empty";
    empty.textContent = "还没有保存的回复。生成后点“保存到本机”即可留在这台设备。";
    elements.savedList.append(empty);
    return;
  }
  for (const entry of saved) {
    const article = document.createElement("article");
    article.className = "saved-entry";
    const reply = document.createElement("p");
    reply.textContent = entry.reply;
    const date = document.createElement("small");
    date.textContent = new Date(entry.at).toLocaleString("zh-CN", { dateStyle: "medium", timeStyle: "short" });
    const button = document.createElement("button");
    button.className = "text-action";
    button.type = "button";
    button.textContent = "复制";
    button.addEventListener("click", async () => {
      await copyText(entry.reply);
      showToast("回复已复制");
    });
    article.append(reply, date, button);
    elements.savedList.append(article);
  }
}

function render(result, source) {
  currentDraft = result.draft;
  currentAlternate = result.alternate;
  elements.answerSource.textContent = `首选回复 · ${source}`;
  elements.draft.textContent = result.draft;
  elements.alternate.textContent = result.alternate;
  elements.fact.textContent = result.fact;
  elements.unknown.textContent = result.unknown;
  elements.next.textContent = result.next;
  elements.badge.textContent = result.badge;
  elements.badge.className = `signal-badge ${result.stop ? "is-stop" : "is-ready"}`;
  elements.alternateBox.hidden = !result.alternate || result.alternate === result.draft;
  elements.copy.disabled = false;
  elements.save.disabled = false;
  if (window.innerWidth <= 820) elements.draft.scrollIntoView({ behavior: "smooth", block: "center" });
}

async function generate(inputOverride) {
  const incoming = (inputOverride?.incoming ?? elements.incoming.value).trim();
  if (!incoming) {
    elements.incoming.focus();
    showToast("先放入对方的原话");
    return null;
  }
  const input = {
    incoming,
    relation: inputOverride?.relation ?? elements.relation.value,
    goal: inputOverride?.goal ?? elements.goal.value,
    tone: inputOverride?.tone ?? tone(),
    context: inputOverride?.context ?? elements.context.value.trim(),
  };
  if (incoming.length > 500 || input.context.length > 180) {
    setStatus("原话或背景太长，请缩短后重试。", true);
    return null;
  }
  if (inputOverride) {
    elements.incoming.value = input.incoming;
    elements.relation.value = input.relation;
    elements.goal.value = input.goal;
    const radio = document.querySelector(`input[name="tone"][value="${input.tone}"]`);
    if (radio) radio.checked = true;
    elements.context.value = input.context || "";
  }
  const selectedProvider = provider();
  if (selectedProvider === "offline") {
    const result = resultFor(input);
    render(result, "离线建议");
    setStatus("已用本机规则生成；复杂情况请自行核对。");
    return { reply: result.draft, signal: result.badge, next: result.next };
  }
  if (!apiUrl || !availableProviders.includes(selectedProvider)) {
    setStatus(`${providerNames[selectedProvider]} 尚未接通。当前只能使用“离线应急”。`, true);
    return null;
  }
  const accessCode = elements.accessCode.value.trim();
  if (!accessCode) {
    elements.accessCode.focus();
    setStatus("先填写私人访问码，之后这台手机会记住。", true);
    return null;
  }
  const requestId = ++activeRequest;
  elements.generate.disabled = true;
  elements.generateLabel.textContent = `${providerNames[selectedProvider]} 正在思考…`;
  setStatus("正在结合原话生成，通常需要几秒钟。");
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 40000);
  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      mode: "cors",
      credentials: "omit",
      cache: "no-store",
      headers: { "Content-Type": "application/json", "X-App-Access-Code": accessCode },
      body: JSON.stringify({ ...input, provider: selectedProvider }),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (requestId !== activeRequest) return null;
    if (!response.ok) {
      const messages = {
        invalid_access_code: "访问码不正确，请核对后再试。",
        provider_not_configured: `${providerNames[selectedProvider]} 尚未配置 API 密钥。`,
        server_not_configured: "私人接口尚未配置完成。",
        provider_unavailable: "AI 服务暂时无法生成，请稍后重试，或切换另一模型。",
      };
      setStatus(messages[data.error] || "联机请求失败，请稍后重试。", true);
      return null;
    }
    if (!data.result?.draft || !data.result?.fact) throw new Error("bad_response");
    try { localStorage.setItem("goutoujunshi.accessCode", accessCode); } catch {}
    render(data.result, providerNames[selectedProvider]);
    setStatus(`已由 ${providerNames[selectedProvider]} 生成。发送前请确认符合你的真实意思。`);
    return { reply: data.result.draft, signal: data.result.badge, next: data.result.next };
  } catch (error) {
    if (requestId === activeRequest) setStatus(error.name === "AbortError" ? "等待超时，请重试或切换模型。" : "网络或接口异常，请检查连接后重试。", true);
    return null;
  } finally {
    window.clearTimeout(timeout);
    if (requestId === activeRequest) {
      elements.generate.disabled = false;
      updateProviderUi(false);
    }
  }
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const helper = document.createElement("textarea");
    helper.value = text;
    document.body.appendChild(helper);
    helper.select();
    document.execCommand("copy");
    helper.remove();
  }
}

elements.incoming.addEventListener("input", () => {
  elements.charCount.textContent = `${elements.incoming.value.length} / 500`;
});
elements.generate.addEventListener("click", () => generate());
for (const radio of document.querySelectorAll('input[name="provider"]')) {
  radio.addEventListener("change", () => {
    activeRequest += 1;
    elements.generate.disabled = false;
    updateProviderUi();
  });
}
function clearAccessCode() {
  elements.accessCode.value = "";
  try { localStorage.removeItem("goutoujunshi.accessCode"); } catch {}
  showToast("本机访问码已清除");
}
elements.clearAccessCode.addEventListener("click", clearAccessCode);
elements.clearAccessCodePrivacy.addEventListener("click", clearAccessCode);
elements.copy.addEventListener("click", async () => {
  await copyText(currentDraft);
  showToast("回复已复制");
});
elements.save.addEventListener("click", () => {
  const saved = readSaved();
  saved.unshift({ reply: currentDraft, at: Date.now() });
  localStorage.setItem("goutoujunshi.saved", JSON.stringify(saved.slice(0, 12)));
  if (!elements.savedPanel.hidden) renderSaved();
  showToast("已保存到这台设备");
});
elements.showSaved.addEventListener("click", () => {
  renderSaved();
  elements.savedPanel.hidden = false;
  elements.savedPanel.scrollIntoView({ behavior: "smooth", block: "start" });
});
elements.closeSaved.addEventListener("click", () => { elements.savedPanel.hidden = true; });
elements.useAlternate.addEventListener("click", () => {
  [currentDraft, currentAlternate] = [currentAlternate, currentDraft];
  elements.draft.textContent = currentDraft;
  elements.alternate.textContent = currentAlternate;
  showToast("已换成另一个版本");
});
elements.privacyButton.addEventListener("click", () => {
  const nextState = elements.privacyPanel.hidden;
  elements.privacyPanel.hidden = !nextState;
  elements.privacyButton.setAttribute("aria-expanded", String(nextState));
  if (nextState) elements.privacyPanel.scrollIntoView({ behavior: "smooth", block: "center" });
});
elements.clearSaved.addEventListener("click", () => {
  localStorage.removeItem("goutoujunshi.saved");
  renderSaved();
  showToast("本机保存已清空");
});
elements.showInstall.addEventListener("click", () => { elements.installTip.hidden = false; });
elements.dismissInstall.addEventListener("click", () => { elements.installTip.hidden = true; });

const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone;
if (isIos && !isStandalone && !sessionStorage.getItem("goutoujunshi.installDismissed")) {
  window.setTimeout(() => { elements.installTip.hidden = false; }, 1200);
}
elements.dismissInstall.addEventListener("click", () => sessionStorage.setItem("goutoujunshi.installDismissed", "1"));

try {
  elements.accessCode.value = localStorage.getItem("goutoujunshi.accessCode") || "";
  const savedProvider = localStorage.getItem("goutoujunshi.provider");
  const defaultProvider = availableProviders.includes(savedProvider) ? savedProvider : availableProviders[0] || "offline";
  const radio = document.querySelector(`input[name="provider"][value="${defaultProvider}"]`);
  if (radio) radio.checked = true;
} catch {}
updateProviderUi();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}

function registerWebMcp() {
  const context = document.modelContext;
  if (!context?.registerTool) return;
  const tones = ["稳妥", "会撩", "有边界"];
  const relations = ["刚认识", "暧昧中", "恋爱中", "闹矛盾", "分开后"];
  const goals = ["推进", "理解", "修复", "确认", "退出"];
  try {
    void Promise.resolve(context.registerTool({
      name: "compose_reply",
      title: "生成高情商回复",
      description: "根据对方原话、关系、目标和语气生成一条回复，并同步更新页面中的可复制草稿。",
      inputSchema: {
        type: "object",
        properties: {
          incoming: { type: "string", minLength: 1, maxLength: 500 },
          relation: { type: "string", enum: relations },
          goal: { type: "string", enum: goals },
          tone: { type: "string", enum: tones },
          context: { type: "string", maxLength: 180 },
        },
        required: ["incoming", "relation", "goal", "tone"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute(input) {
        if (!input || typeof input.incoming !== "string" || !input.incoming.trim()) throw new Error("incoming 不能为空");
        if (!relations.includes(input.relation) || !goals.includes(input.goal) || !tones.includes(input.tone)) throw new Error("选项无效");
        return generate(input);
      },
    })).catch(() => {});
  } catch {}
}

registerWebMcp();
