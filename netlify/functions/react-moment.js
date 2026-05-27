import { json, loadPosts, publicPost, reactionTypes, savePosts } from "./_shared/moments-store.js";

export default async (req) => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const body = await req.json();
  const postId = String(body.postId || "");
  const reactionType = String(body.reactionType || "");
  const visitorId = String(body.visitorId || "");

  if (!postId || !visitorId || !reactionTypes.includes(reactionType)) {
    return json({ error: "参数不完整" }, 400);
  }

  const posts = await loadPosts();
  const post = posts.find((item) => item.id === postId && item.status === "approved");
  if (!post) return json({ error: "内容不存在或尚未公开" }, 404);

  post.reactions ||= {};
  post.reactions[visitorId] ||= {};
  post.reactionCounts ||= { favorite: 0, like: 0, dislike: 0 };

  const current = Boolean(post.reactions[visitorId][reactionType]);
  const next = typeof body.selected === "boolean" ? body.selected : !current;
  if (current === next) {
    return json({ post: publicPost(post, visitorId) });
  }

  post.reactions[visitorId][reactionType] = next;
  post.reactionCounts[reactionType] = Math.max(0, (post.reactionCounts[reactionType] || 0) + (next ? 1 : -1));
  await savePosts(posts);

  return json({ post: publicPost(post, visitorId) });
};
