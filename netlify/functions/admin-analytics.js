import { json, loadPosts, publicPost, verifyReviewerToken } from "./_shared/moments-store.js";

const VALID_STATUSES = new Set(["all", "pending", "approved", "rejected"]);
const VALID_SORTS = new Set(["createdAt", "favorite", "like", "dislike", "totalInteractions"]);
const VALID_ORDERS = new Set(["asc", "desc"]);

function chinaDateKey(value) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(value));
}

function reactionCount(post, type) {
  return Number(post.reactionCounts?.[type] || 0);
}

function totalInteractions(post) {
  return reactionCount(post, "favorite") + reactionCount(post, "like") + reactionCount(post, "dislike");
}

function sortValue(post, sortBy) {
  if (sortBy === "createdAt") return new Date(post.createdAt).getTime();
  if (sortBy === "totalInteractions") return totalInteractions(post);
  return reactionCount(post, sortBy);
}

function summaryFor(posts) {
  return posts.reduce(
    (summary, post) => {
      summary.totalPosts += 1;
      summary[post.status] += 1;
      summary.favorite += reactionCount(post, "favorite");
      summary.like += reactionCount(post, "like");
      summary.dislike += reactionCount(post, "dislike");
      summary.totalInteractions += totalInteractions(post);
      return summary;
    },
    {
      totalPosts: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
      favorite: 0,
      like: 0,
      dislike: 0,
      totalInteractions: 0
    }
  );
}

function dailyStatsFor(posts) {
  const grouped = new Map();
  posts.forEach((post) => {
    const date = chinaDateKey(post.createdAt);
    const item =
      grouped.get(date) ||
      {
        date,
        totalPosts: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        favorite: 0,
        like: 0,
        dislike: 0,
        totalInteractions: 0
      };
    item.totalPosts += 1;
    item[post.status] += 1;
    item.favorite += reactionCount(post, "favorite");
    item.like += reactionCount(post, "like");
    item.dislike += reactionCount(post, "dislike");
    item.totalInteractions += totalInteractions(post);
    grouped.set(date, item);
  });

  return [...grouped.values()].sort((a, b) => b.date.localeCompare(a.date));
}

export default async (req) => {
  if (req.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }
  if (!verifyReviewerToken(req)) {
    return json({ error: "未登录或登录已失效" }, 401);
  }

  const url = new URL(req.url);
  const dateFrom = url.searchParams.get("dateFrom") || "0000-01-01";
  const dateTo = url.searchParams.get("dateTo") || "9999-12-31";
  const nickname = (url.searchParams.get("nickname") || "").trim().toLowerCase();
  const status = VALID_STATUSES.has(url.searchParams.get("status")) ? url.searchParams.get("status") : "all";
  const sortBy = VALID_SORTS.has(url.searchParams.get("sortBy")) ? url.searchParams.get("sortBy") : "createdAt";
  const sortOrder = VALID_ORDERS.has(url.searchParams.get("sortOrder")) ? url.searchParams.get("sortOrder") : "desc";

  const posts = await loadPosts();
  const filtered = posts.filter((post) => {
    const date = chinaDateKey(post.createdAt);
    const matchesDate = date >= dateFrom && date <= dateTo;
    const matchesNickname = !nickname || String(post.nickname || "").toLowerCase().includes(nickname);
    const matchesStatus = status === "all" || post.status === status;
    return matchesDate && matchesNickname && matchesStatus;
  });

  const direction = sortOrder === "asc" ? 1 : -1;
  const sorted = [...filtered].sort((a, b) => {
    const left = sortValue(a, sortBy);
    const right = sortValue(b, sortBy);
    if (left === right) return new Date(b.createdAt) - new Date(a.createdAt);
    return (left > right ? 1 : -1) * direction;
  });

  return json({
    filters: { dateFrom, dateTo, nickname, status, sortBy, sortOrder },
    summary: summaryFor(filtered),
    dailyStats: dailyStatsFor(filtered),
    posts: sorted.map((post) => ({
      ...publicPost(post),
      createdDate: chinaDateKey(post.createdAt),
      totalInteractions: totalInteractions(post)
    }))
  });
};
