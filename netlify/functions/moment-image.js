import { json, momentsStore } from "./_shared/moments-store.js";

export default async (req, context) => {
  if (req.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }

  const url = new URL(req.url);
  const uploadMatch = url.pathname.match(/\/uploads\/([^/?#]+)/);
  const id = context.params?.id || (uploadMatch ? decodeURIComponent(uploadMatch[1]) : "") || url.searchParams.get("id");
  if (!id) return json({ error: "缺少图片 ID" }, 400);

  const result = await momentsStore().getWithMetadata(`uploads/${id}`, { type: "arrayBuffer" });
  if (!result) return json({ error: "图片不存在" }, 404);

  return new Response(result.data, {
    headers: {
      "Content-Type": result.metadata?.contentType || "image/jpeg",
      "Cache-Control": "public, max-age=31536000, immutable"
    }
  });
};

export const config = {
  path: ["/uploads/:id", "/.netlify/functions/moment-image"]
};
