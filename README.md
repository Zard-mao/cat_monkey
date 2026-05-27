# Monkey 黑猫个人主页

一个关于黑猫 Monkey 的个人主页和朋友圈投稿系统。项目包含首页、朋友圈公开页、审核后台，以及基于 Netlify Functions 和 Netlify Blobs 的投稿、审核、互动和图片读取能力。

## 功能

- Monkey 赛博猫档案首页
- 朋友圈照片墙投稿
- 每个访客每天最多投稿 3 次
- 审核后台登录、通过、拒绝和状态互转
- 喜欢、点赞、点踩互动
- 投稿图片通过 Netlify Image CDN 输出轻量 WebP 展示图
- 手机 H5 适配

## 本地运行

先安装依赖：

```bash
npm install
```

复制环境变量示例：

```bash
cp .env.example .env
```

然后在 `.env` 中填写审核后台账号和密码：

```bash
REVIEWER_USERNAME=your_reviewer_username
REVIEWER_PASSWORD=your_reviewer_password
```

启动本地预览：

```bash
npm run dev
```

默认页面：

- 首页：`http://localhost:8888/`
- 朋友圈：`http://localhost:8888/moments.html`
- 审核后台：`http://localhost:8888/admin.html`

## Netlify 部署

项目已配置 `netlify.toml`，部署时需要在 Netlify 后台配置环境变量：

- `REVIEWER_USERNAME`
- `REVIEWER_PASSWORD`

这些变量只保存在 Netlify 或本地 `.env` 中，不应提交到 GitHub。

## 版本记录

版本号记录在 `VERSION`，详细变更见 `CHANGELOG.md`。
