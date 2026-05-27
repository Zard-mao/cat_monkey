import { json, loadPosts, reviewerUsername, savePosts, verifyReviewerToken } from "./_shared/moments-store.js";

export default async (req) => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }
  if (!verifyReviewerToken(req)) {
    return json({ error: "未登录或登录已失效" }, 401);
  }

  const body = await req.json();
  const id = String(body.id || "");
  const action = String(body.action || "");
  if (!id || !["approve", "reject"].includes(action)) {
    return json({ error: "参数不完整" }, 400);
  }

  const posts = await loadPosts();
  const post = posts.find((item) => item.id === id);
  if (!post) return json({ error: "投稿不存在" }, 404);

  post.status = action === "approve" ? "approved" : "rejected";
  post.reviewedAt = new Date().toISOString();
  post.reviewedBy = reviewerUsername();
  post.rejectReason = action === "reject" ? String(body.rejectReason || "审核人员标记为不公开") : null;
  await savePosts(posts);

  return json({ post });
};
