import { createReviewerToken, json, reviewerPassword, reviewerUsername } from "./_shared/moments-store.js";

export default async (req) => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const configuredPassword = reviewerPassword();
  if (!configuredPassword) {
    return json({ error: "审核密码未配置" }, 500);
  }

  const body = await req.json();
  const username = String(body.username || "").trim();
  const password = String(body.password || "");

  if (username !== reviewerUsername() || password !== configuredPassword) {
    return json({ error: "账号或密码不正确" }, 401);
  }

  return json({ token: createReviewerToken(username), username });
};
