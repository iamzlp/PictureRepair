# PictureRepair

老照片修复微信小程序项目。当前包含 FastAPI 后端和微信小程序前端骨架，后端复用了 BudTrip 中已验证可用的 OSS、数据库、图片生成任务流和大模型配置。

测试与回归说明见 [TESTING.md](file:///d:/mycode/PictureRepair/TESTING.md)。

正式部署准备见 [DEPLOYMENT.md](file:///d:/mycode/PictureRepair/DEPLOYMENT.md)。

正式上线执行顺序见 [GO_LIVE_CHECKLIST.md](file:///d:/mycode/PictureRepair/deploy/GO_LIVE_CHECKLIST.md)。

## Backend

先准备 `.env`（可参考 `.env.example`），并启动本地依赖（Postgres/Redis/MinIO）：

```powershell
docker compose up -d
```

默认映射端口见 `.env.example`（Postgres 15432、Redis 16379、MinIO 19000/19001），如本机端口冲突可自行调整。

安装后端依赖并启动：

```powershell
cd D:\mycode\PictureRepair
pip install -r backend\requirements.txt
python backend\scripts\init_db.py
python -m uvicorn app.main:app --app-dir backend --reload --port 8000
```

常用接口：

- `POST /api/v1/auth/login/mock?phone=13800138000`
- `POST /api/v1/auth/login/wechat`
- `POST /api/v1/auth/phone/wechat`
- `GET /api/v1/auth/me`
- `POST /api/v1/photos/upload`
- `POST /api/v1/repair/tasks`
- `GET /api/v1/repair/tasks/{task_id}`
- `POST /api/v1/repair/tasks/{task_id}/export`
- `GET /api/v1/payments/packages`
- `POST /api/v1/payments/mock-purchase`
- `GET /api/v1/payments/orders`
- `GET /api/v1/payments/transactions`

`.env` 位于 `D:\mycode\PictureRepair\.env`，后端会自动读取它。

## Mini Program

用微信开发者工具打开：

```text
D:\mycode\PictureRepair\miniprogram
```

本地联调注意事项：

- 后端保持运行在 `http://127.0.0.1:8000`。
- 微信开发者工具里关闭“校验合法域名”。
- 真机测试时，把 `miniprogram\utils\config.js` 里的 `apiBaseUrl` 改成电脑局域网 IP 或正式 HTTPS 域名。
- UI 联调阶段建议设置 `.env`：`MOCK_IMAGE_GENERATION=true`，避免消耗真实模型额度。
- 没有正式微信 AppID/Secret 时，设置 `.env`：`MOCK_WECHAT_LOGIN=true`，可以先用开发者工具跑通微信登录 UI。

当前小程序流程：

1. 使用微信登录，或使用手机号 mock 登录作为开发备用。
2. 选择并上传一张老照片。
3. 选择“黑白上色”或“照片清晰”。
4. 创建修复任务。
5. 轮询任务进度。
6. 预览生成结果。
7. 如次数不足，使用 mock 套餐购买次数。
8. 导出高清图并扣除 1 次。

## Billing Notes

- 当前只有 mock 支付：`mock-purchase` 会直接给用户增加测试次数。
- 新用户默认导出次数为 0。
- 套餐价格按需求预设为：单次 2.99 元、50 元 30 次、100 元 90 次。
- mock 购买会写入 `orders` 和 `credit_transactions`。
- 导出会扣除 1 次并写入 `credit_transactions`。
- 同一个修复任务重复导出不会重复扣次。
- 真实微信支付、真实微信手机号登录和退款/失败返还还未接入。

## Model Notes

- `MOCK_IMAGE_GENERATION=true` 时，修复任务不会调用真实大模型，结果图会直接返回上传图 URL。
- `MOCK_IMAGE_GENERATION=false` 时，修复任务会复用后端图片生成链路并调用真实模型 API，可能消耗额度。

## WeChat Login Notes

- 小程序端已接入 `wx.login`，后端接口为 `POST /api/v1/auth/login/wechat`。
- 后端会用微信 code 换取 `openid`，创建或复用用户，并返回本系统 JWT。
- 用户表已新增 `openid`、`unionid`，手机号改为后绑定。
- 手机号授权接口为 `POST /api/v1/auth/phone/wechat`，对应小程序 `open-type="getPhoneNumber"`。
- `MOCK_WECHAT_LOGIN=true` 时，后端不会请求微信服务器，会用本地 mock openid 和 mock 手机号，适合开发者工具联调。
- 真机/正式测试时需要配置 `WECHAT_APPID`、`WECHAT_SECRET`，并把 `MOCK_WECHAT_LOGIN=false`。
