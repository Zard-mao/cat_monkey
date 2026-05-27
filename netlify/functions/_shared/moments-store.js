import { getStore } from "@netlify/blobs";
import { createHmac, timingSafeEqual } from "node:crypto";

const STORE_NAME = "monkey-moments";
const POSTS_KEY = "posts/index.json";
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const reactionTypes = ["favorite", "like", "dislike"];

export const seedPosts = [
  {
    id: "post_seed_reading",
    imageUrl: "素材/新增/躺着读最坏的猫的Monkey.png",
    description: "Monkey 今天认真研究一本书，看起来像是在做一场严格的自我评审。",
    nickname: "档案员",
    tags: ["读书"],
    status: "approved",
    reactionCounts: { favorite: 24, like: 18, dislike: 1 },
    reactions: {},
    createdAt: "2026-05-25T10:00:00+08:00",
    reviewedAt: "2026-05-25T10:18:00+08:00",
    reviewedBy: "monkey_reviewer",
    rejectReason: null
  },
  {
    id: "post_seed_office",
    imageUrl: "素材/新增/办公室坐姿观察的Monkey.jpg",
    description: "它在办公室坐得很端正，像是下一秒就要点评整个项目节奏。",
    nickname: "工位目击者",
    tags: ["办公室", "巡逻"],
    status: "approved",
    reactionCounts: { favorite: 16, like: 21, dislike: 0 },
    reactions: {},
    createdAt: "2026-05-25T10:22:00+08:00",
    reviewedAt: "2026-05-25T10:35:00+08:00",
    reviewedBy: "monkey_reviewer",
    rejectReason: null
  },
  {
    id: "post_seed_ai",
    imageUrl: "素材/AI奇幻职业/B站程序员-泡咖啡找bugMonkey-v2.png",
    description: "疑似 AI 生成的隐藏职业照：Monkey 正在泡咖啡找 bug。",
    nickname: "想象力投稿人",
    tags: ["AI生成", "办公室"],
    status: "approved",
    reactionCounts: { favorite: 31, like: 28, dislike: 2 },
    reactions: {},
    createdAt: "2026-05-25T11:00:00+08:00",
    reviewedAt: "2026-05-25T11:12:00+08:00",
    reviewedBy: "monkey_reviewer",
    rejectReason: null
  },
  {
    id: "post_pending_teaser",
    imageUrl: "素材/新增/盯着逗猫棒的Monkey.jpg",
    description: "目标锁定，注意力已经进入战斗模式。",
    nickname: "玩具管理员",
    tags: ["可爱瞬间"],
    status: "pending",
    reactionCounts: { favorite: 0, like: 0, dislike: 0 },
    reactions: {},
    createdAt: "2026-05-25T11:30:00+08:00",
    reviewedAt: null,
    reviewedBy: null,
    rejectReason: null
  }
];

export function momentsStore() {
  return getStore({ name: STORE_NAME, consistency: "strong" });
}

export async function loadPosts() {
  const store = momentsStore();
  const posts = await store.get(POSTS_KEY, { type: "json" });
  if (posts) return posts;
  await store.setJSON(POSTS_KEY, seedPosts);
  return seedPosts;
}

export async function savePosts(posts) {
  await momentsStore().setJSON(POSTS_KEY, posts);
}

export function publicPost(post, visitorId = "") {
  const own = visitorId && post.reactions ? post.reactions[visitorId] || {} : {};
  return {
    id: post.id,
    imageUrl: post.imageKey ? `/.netlify/functions/moment-image?id=${encodeURIComponent(post.id)}` : post.imageUrl,
    imageKey: post.imageKey || null,
    description: post.description,
    nickname: post.nickname,
    tags: post.tags || [],
    status: post.status,
    reactionCounts: post.reactionCounts || { favorite: 0, like: 0, dislike: 0 },
    currentReaction: own,
    createdAt: post.createdAt,
    reviewedAt: post.reviewedAt,
    reviewedBy: post.reviewedBy,
    rejectReason: post.rejectReason
  };
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

export function methodNotAllowed() {
  return json({ error: "Method not allowed" }, 405);
}

export function reviewerUsername() {
  return Netlify.env.get("REVIEWER_USERNAME") || "monkey_reviewer";
}

export function reviewerPassword() {
  return Netlify.env.get("REVIEWER_PASSWORD") || "";
}

export function createReviewerToken(username) {
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const payload = `${username}.${expiresAt}`;
  const signature = createHmac("sha256", reviewerPassword()).update(payload).digest("hex");
  return `${payload}.${signature}`;
}

export function verifyReviewerToken(req) {
  const header = req.headers.get("authorization") || "";
  const token = header.replace(/^Bearer\s+/i, "");
  const [username, expiresAt, signature] = token.split(".");
  if (!username || !expiresAt || !signature) return false;
  if (username !== reviewerUsername()) return false;
  if (Number(expiresAt) < Date.now()) return false;
  const expected = createHmac("sha256", reviewerPassword()).update(`${username}.${expiresAt}`).digest("hex");
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function normalizeTags(tags) {
  if (!tags) return ["其他"];
  const list = Array.isArray(tags) ? tags : String(tags).split(",");
  const clean = list.map((tag) => String(tag).trim()).filter(Boolean).slice(0, 6);
  return clean.length ? clean : ["其他"];
}
