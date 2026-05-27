import { json, loadPosts, momentsStore, normalizeTags, savePosts } from "./_shared/moments-store.js";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export default async (req) => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const form = await req.formData();
  const file = form.get("image");
  const visitorId = String(form.get("visitorId") || "");
  const description = String(form.get("description") || "").trim().slice(0, 120);
  const nickname = String(form.get("nickname") || "").trim().slice(0, 20);
  const tags = normalizeTags(String(form.get("tags") || ""));

  if (!file || typeof file.arrayBuffer !== "function" || !visitorId || !description || !nickname) {
    return json({ error: "投稿信息不完整" }, 400);
  }
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return json({ error: "仅支持 jpg、png、webp 图片" }, 400);
  }
  if (file.size > MAX_IMAGE_SIZE) {
    return json({ error: "图片超过 5MB，请换一张更轻的 Monkey。" }, 400);
  }

  const posts = await loadPosts();
  const today = todayKey();
  const todayCount = posts.filter((post) => post.uploaderId === visitorId && todayKey(new Date(post.createdAt)) === today).length;
  if (todayCount >= 3) {
    return json({ error: "今天已经投稿 3 次，明天再来捕捉 Monkey。" }, 429);
  }

  const id = `post_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const imageKey = `uploads/${id}`;
  const imageBuffer = await file.arrayBuffer();
  await momentsStore().set(imageKey, imageBuffer, {
    metadata: {
      contentType: file.type,
      uploadedAt: new Date().toISOString()
    }
  });

  const post = {
    id,
    imageKey,
    description,
    nickname,
    tags,
    status: "pending",
    uploaderId: visitorId,
    reactionCounts: { favorite: 0, like: 0, dislike: 0 },
    reactions: {},
    createdAt: new Date().toISOString(),
    reviewedAt: null,
    reviewedBy: null,
    rejectReason: null
  };
  posts.unshift(post);
  await savePosts(posts);

  return json({ post, quota: { used: todayCount + 1, limit: 3 } }, 201);
};
