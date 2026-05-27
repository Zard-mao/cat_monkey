import { json, loadPosts, publicPost, verifyReviewerToken } from "./_shared/moments-store.js";

export default async (req) => {
  if (req.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }
  if (!verifyReviewerToken(req)) {
    return json({ error: "未登录或登录已失效" }, 401);
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status") || "pending";
  const posts = await loadPosts();
  const filtered = posts
    .filter((post) => post.status === status)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((post) => publicPost(post));
  const counts = {
    pending: posts.filter((post) => post.status === "pending").length,
    approved: posts.filter((post) => post.status === "approved").length,
    rejected: posts.filter((post) => post.status === "rejected").length
  };

  return json({ posts: filtered, counts });
};
