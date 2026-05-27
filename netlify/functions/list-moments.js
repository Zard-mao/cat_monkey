import { json, loadPosts, publicPost } from "./_shared/moments-store.js";

export default async (req) => {
  if (req.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }

  const url = new URL(req.url);
  const visitorId = url.searchParams.get("visitorId") || "";
  const posts = await loadPosts();
  const approved = posts
    .filter((post) => post.status === "approved")
    .sort((a, b) => new Date(b.reviewedAt || b.createdAt) - new Date(a.reviewedAt || a.createdAt))
    .map((post) => publicPost(post, visitorId));

  return json({ posts: approved });
};
