const VISITOR_KEY = "monkeyMoments.visitorId";
const SESSION_KEY = "monkeyMoments.reviewerToken";
const QUOTA_KEY = "monkeyMoments.submitQuotaHint";
const TAGS = ["全部", "办公室", "读书", "巡逻", "可爱瞬间", "AI生成", "其他"];
const page = document.body.dataset.page;
const $ = (selector) => document.querySelector(selector);

let activeTag = "全部";
let currentPosts = [];
let activeAdminStatus = "pending";
const pendingReactions = new Set();

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getVisitorId() {
  let id = localStorage.getItem(VISITOR_KEY);
  if (!id) {
    id = `visitor_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    localStorage.setItem(VISITOR_KEY, id);
  }
  return id;
}

async function api(path, options = {}) {
  const response = await fetch(`/.netlify/functions/${path}`, {
    cache: "no-store",
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(options.headers || {})
    }
  });
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : null;
  if (!response.ok) {
    throw new Error(data?.error || "服务端暂时不可用");
  }
  return data;
}

function reviewerToken() {
  return localStorage.getItem(SESSION_KEY) || "";
}

function setReviewerToken(token) {
  if (token) localStorage.setItem(SESSION_KEY, token);
  else localStorage.removeItem(SESSION_KEY);
}

function formatTime(value) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function setMessage(node, text, type = "") {
  node.textContent = text;
  node.dataset.type = type;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function quotaHint() {
  const quota = JSON.parse(localStorage.getItem(QUOTA_KEY) || "{}");
  return quota[todayKey()] || 0;
}

function setQuotaHint(count) {
  const quota = JSON.parse(localStorage.getItem(QUOTA_KEY) || "{}");
  quota[todayKey()] = count;
  localStorage.setItem(QUOTA_KEY, JSON.stringify(quota));
}

function renderTags(container, selectedTag, onChange) {
  container.innerHTML = "";
  TAGS.forEach((tag) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "filter-chip";
    button.textContent = tag;
    button.dataset.active = tag === selectedTag;
    button.addEventListener("click", () => onChange(tag));
    container.appendChild(button);
  });
}

async function fetchMoments() {
  const visitorId = getVisitorId();
  const data = await api(`list-moments?visitorId=${encodeURIComponent(visitorId)}`);
  currentPosts = data.posts || [];
  renderMoments();
}

function renderMoments() {
  const feed = $("#moment-feed");
  const empty = $("#empty-state");
  if (!feed) return;

  const posts = currentPosts.filter((post) => activeTag === "全部" || post.tags.includes(activeTag));
  feed.innerHTML = "";
  empty.hidden = posts.length > 0;

  posts.forEach((post) => {
    const article = document.createElement("article");
    article.className = "moment-card";
    const image = responsiveMomentImage(post);
    article.innerHTML = `
      <img
        src="${image.src}"
        srcset="${image.srcset}"
        sizes="(max-width: 640px) 100vw, 640px"
        alt="${escapeHtml(post.description)}"
        loading="lazy"
        decoding="async"
      />
      <div class="moment-body">
        <div class="moment-meta">
          <strong>${escapeHtml(post.nickname)}</strong>
          <span>${formatTime(post.reviewedAt || post.createdAt)}</span>
        </div>
        <p>${escapeHtml(post.description)}</p>
        <div class="moment-tags">${post.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>
        <div class="reaction-row" aria-label="互动">
          ${reactionButton("favorite", "喜欢", post)}
          ${reactionButton("like", "点赞", post)}
          ${reactionButton("dislike", "点踩", post)}
        </div>
      </div>
    `;
    article.querySelectorAll("[data-reaction]").forEach((button) => {
      button.addEventListener("click", () => toggleReaction(post.id, button.dataset.reaction));
    });
    feed.appendChild(article);
  });
}

function reactionButton(type, label, post) {
  const emoji = {
    favorite: "❤️",
    like: "👍",
    dislike: "👎"
  }[type];
  const selected = post.currentReaction?.[type] ? "true" : "false";
  const count = post.reactionCounts?.[type] || 0;
  const pending = pendingReactions.has(reactionKey(post.id, type));
  const effect = pending ? type : "";
  return `<button type="button" data-post-id="${post.id}" data-reaction="${type}" data-selected="${selected}" data-syncing="${pending}" data-effect="${effect}" ${pending ? "disabled" : ""}><span class="reaction-emoji" aria-hidden="true">${emoji}</span><span>${label}</span><strong>${count}</strong><span class="reaction-burst" aria-hidden="true">${emoji}</span></button>`;
}

function reactionKey(postId, type) {
  return `${postId}:${type}`;
}

function updatePostReaction(post, type, selected) {
  const current = Boolean(post.currentReaction?.[type]);
  if (current === selected) return post;

  const reactionCounts = {
    favorite: 0,
    like: 0,
    dislike: 0,
    ...(post.reactionCounts || {})
  };
  const currentReaction = {
    ...(post.currentReaction || {}),
    [type]: selected
  };

  reactionCounts[type] = Math.max(0, (reactionCounts[type] || 0) + (selected ? 1 : -1));
  return { ...post, reactionCounts, currentReaction };
}

async function toggleReaction(postId, type) {
  const key = reactionKey(postId, type);
  if (pendingReactions.has(key)) return;

  const before = currentPosts.find((post) => post.id === postId);
  if (!before) return;

  const selected = !Boolean(before.currentReaction?.[type]);
  currentPosts = currentPosts.map((post) => (post.id === postId ? updatePostReaction(post, type, selected) : post));
  pendingReactions.add(key);
  renderMoments();

  try {
    const data = await api("react-moment", {
      method: "POST",
      body: JSON.stringify({
        postId,
        reactionType: type,
        selected,
        visitorId: getVisitorId()
      })
    });
    currentPosts = currentPosts.map((post) => (post.id === postId ? data.post : post));
  } catch (error) {
    currentPosts = currentPosts.map((post) => (post.id === postId ? before : post));
    window.alert(`互动同步失败：${error.message}`);
  } finally {
    pendingReactions.delete(key);
    renderMoments();
  }
}

function imageCdnUrl(url, width) {
  if (!url) return "";
  if (url.startsWith("data:") || /^https?:\/\//i.test(url)) return url;
  const normalized = url.startsWith("/") ? url : `/${url}`;
  return `/.netlify/images?url=${encodeURIComponent(normalized)}&w=${width}&q=72&fit=contain&fm=webp`;
}

function responsiveMomentImage(post) {
  if (post.imageKey) {
    const source = `/uploads/${encodeURIComponent(post.id)}`;
    return {
      src: `/.netlify/images?url=${encodeURIComponent(source)}&w=640&q=72&fit=contain&fm=webp`,
      srcset: [
        `/.netlify/images?url=${encodeURIComponent(source)}&w=360&q=68&fit=contain&fm=webp 360w`,
        `/.netlify/images?url=${encodeURIComponent(source)}&w=640&q=72&fit=contain&fm=webp 640w`,
        `/.netlify/images?url=${encodeURIComponent(source)}&w=960&q=76&fit=contain&fm=webp 960w`
      ].join(", ")
    };
  }

  return {
    src: imageCdnUrl(post.imageUrl, 640),
    srcset: [
      `${imageCdnUrl(post.imageUrl, 360)} 360w`,
      `${imageCdnUrl(post.imageUrl, 640)} 640w`,
      `${imageCdnUrl(post.imageUrl, 960)} 960w`
    ].join(", ")
  };
}

function setupMomentsPage() {
  const onFilterChange = (tag) => {
    activeTag = tag;
    renderTags($("#filter-strip"), activeTag, onFilterChange);
    renderMoments();
  };
  renderTags($("#filter-strip"), activeTag, onFilterChange);
  renderMomentForm();
  fetchMoments().catch((error) => showFeedError(error.message));
}

function showFeedError(message) {
  const feed = $("#moment-feed");
  if (!feed) return;
  feed.innerHTML = `<div class="empty-state">朋友圈服务暂时不可用：${escapeHtml(message)}</div>`;
  $("#empty-state").hidden = true;
}

function renderMomentForm() {
  const tagBox = $("#tag-options");
  const form = $("#moment-form");
  const message = $("#form-message");
  const quotaLine = $("#quota-line");
  const submitButton = $("#submit-button");
  const submitTags = TAGS.filter((tag) => tag !== "全部");

  tagBox.innerHTML = submitTags.map((tag, index) => `
    <label class="check-chip">
      <input type="checkbox" name="tags" value="${tag}" ${index === 0 ? "checked" : ""} />
      <span>${tag}</span>
    </label>
  `).join("");

  function refreshQuota(count = quotaHint()) {
    quotaLine.textContent = `今日已投稿 ${count}/3 次`;
    submitButton.disabled = count >= 3;
    if (count >= 3) setMessage(message, "今天已经投稿 3 次，明天再来捕捉 Monkey。", "warn");
  }

  refreshQuota();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    submitButton.disabled = true;
    setMessage(message, "正在提交给审核后台...", "");

    const file = $("#moment-image").files[0];
    if (!file) {
      refreshQuota();
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMessage(message, "图片超过 5MB，请换一张更轻的 Monkey。", "warn");
      refreshQuota();
      return;
    }

    const checkedTags = [...form.querySelectorAll("input[name='tags']:checked")].map((input) => input.value);
    const payload = new FormData();
    payload.set("image", file);
    payload.set("visitorId", getVisitorId());
    payload.set("description", $("#moment-description").value.trim());
    payload.set("nickname", $("#moment-nickname").value.trim());
    payload.set("tags", checkedTags.join(","));

    try {
      const data = await api("submit-moment", {
        method: "POST",
        body: payload
      });
      form.reset();
      tagBox.querySelector("input").checked = true;
      setQuotaHint(data.quota.used);
      setMessage(message, "投稿成功，审核通过后会出现在 Monkey 朋友圈。", "success");
      refreshQuota(data.quota.used);
    } catch (error) {
      setMessage(message, error.message, "warn");
      refreshQuota();
    }
  });
}

function setupAdminPage() {
  renderLoginState(Boolean(reviewerToken()));
  $("#login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const data = await api("login-reviewer", {
        method: "POST",
        body: JSON.stringify({
          username: $("#reviewer-username").value.trim(),
          password: $("#reviewer-password").value
        })
      });
      setReviewerToken(data.token);
      setMessage($("#login-message"), "", "");
      renderLoginState(true);
    } catch (error) {
      setMessage($("#login-message"), error.message, "warn");
    }
  });
  $("#logout-button").addEventListener("click", () => {
    setReviewerToken("");
    renderLoginState(false);
  });
}

function renderLoginState(isLoggedIn) {
  $("#login-view").hidden = isLoggedIn;
  $("#review-view").hidden = !isLoggedIn;
  if (isLoggedIn) {
    renderAdmin("pending").catch(() => {
      setReviewerToken("");
      renderLoginState(false);
      setMessage($("#login-message"), "登录已失效，请重新登录。", "warn");
    });
  }
}

async function renderAdmin(status = activeAdminStatus) {
  activeAdminStatus = status;
  const data = await api(`admin-list-moments?status=${encodeURIComponent(status)}`, {
    headers: { Authorization: `Bearer ${reviewerToken()}` }
  });
  renderAdminTabs(data.counts || {});
  renderReviewList(data.posts || [], status);
}

function renderAdminTabs(counts) {
  const tabs = $("#admin-tabs");
  const states = [
    ["pending", "待审核"],
    ["approved", "已通过"],
    ["rejected", "已拒绝"]
  ];
  tabs.innerHTML = "";
  states.forEach(([status, label]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "filter-chip";
    button.dataset.active = status === activeAdminStatus;
    button.textContent = `${label} ${counts[status] || 0}`;
    button.addEventListener("click", () => renderAdmin(status));
    tabs.appendChild(button);
  });
}

function renderReviewList(posts, status) {
  const list = $("#review-list");
  list.innerHTML = "";
  posts.forEach((post) => list.appendChild(renderReviewCard(post, status)));
  if (!list.children.length) {
    const labels = { pending: "待审核", approved: "已通过", rejected: "已拒绝" };
    list.innerHTML = `<div class="empty-state">当前没有${labels[status]}内容。</div>`;
  }
}

function renderReviewCard(post, status) {
  const article = document.createElement("article");
  article.className = "review-card";
  const image = responsiveMomentImage(post);
  article.innerHTML = `
    <img src="${image.src}" srcset="${image.srcset}" sizes="(max-width: 720px) 100vw, 320px" alt="${escapeHtml(post.description)}" loading="lazy" decoding="async" />
    <div class="review-copy">
      <div class="moment-meta">
        <strong>${escapeHtml(post.nickname)}</strong>
        <span>${formatTime(post.createdAt)}</span>
      </div>
      <p>${escapeHtml(post.description)}</p>
      <div class="moment-tags">${post.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>
      ${post.rejectReason ? `<p class="reject-reason">拒绝原因：${escapeHtml(post.rejectReason)}</p>` : ""}
    </div>
    <div class="review-actions"></div>
  `;

  const actions = article.querySelector(".review-actions");
  if (status === "pending") {
    actions.append(actionButton("通过", "approve", post.id));
    actions.append(actionButton("拒绝", "reject", post.id));
  } else {
    const state = document.createElement("span");
    state.className = "review-status";
    state.textContent = status === "approved" ? "已公开" : "已拒绝";
    actions.append(state);
    actions.append(
      status === "approved"
        ? actionButton("改为不通过", "reject", post.id)
        : actionButton("改为通过", "approve", post.id)
    );
  }
  return article;
}

function actionButton(label, action, id) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = action === "approve" ? "approve-button" : "reject-button";
  button.textContent = label;
  button.addEventListener("click", () => reviewPost(id, action));
  return button;
}

async function reviewPost(id, action) {
  await api("review-moment", {
    method: "POST",
    headers: { Authorization: `Bearer ${reviewerToken()}` },
    body: JSON.stringify({ id, action })
  });
  await renderAdmin(activeAdminStatus);
}

if (page === "moments") setupMomentsPage();
if (page === "admin") setupAdminPage();
