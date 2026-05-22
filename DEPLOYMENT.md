# PictureRepair 正式部署说明

本文档面向后台管理台和后端 API 的正式部署准备，目标是把本地联调配置拆分为可上线的环境变量、构建方式和 Nginx 反向代理方案。

## 1. 部署建议

- 后端：`FastAPI + Uvicorn`
- 管理台：`Vite build` 后产出静态文件，由 `Nginx` 托管
- 反向代理：`Nginx` 统一提供 HTTPS，并把 `/api/` 转发到后端
- 数据层：生产环境使用独立 `PostgreSQL`、`Redis`、`OSS`

推荐使用同域部署：

- 管理台域名：`https://admin.example.com`
- 后端 API：同域下走 `/api/`
- 优点：`admin-web` 默认可直接使用 `VITE_API_BASE_URL=/api/v1/admin`，不需要额外处理跨域和 Cookie 域问题

如果按当前已提供的服务器参数部署：

- 域名：`repairpic.51time.com`
- 部署目录：`/www/repairpic`
- Linux 运行用户：`root`
- 同域部署：admin-web 与 API 共用同一域名
- 当前建议后端监听端口：`8000`

已按这组参数生成可直接参考的文件：

- `systemd`：[repairpic-api.service](file:///d:/mycode/PictureRepair/deploy/systemd/repairpic-api.service)
- `Nginx`：[repairpic.51time.com.conf](file:///d:/mycode/PictureRepair/deploy/nginx/repairpic.51time.com.conf)

## 2. 后端环境变量

可从 [`.env.production.example`](file:///d:/mycode/PictureRepair/.env.production.example) 复制为正式环境 `.env`，至少确认以下项：

- `ENVIRONMENT=production`
- `AUTO_CREATE_TABLES=false`
- `BACKEND_CORS_ORIGINS=https://admin.example.com`
- `POSTGRES_*`
- `REDIS_*`
- `OSS_*`
- `ARK_API_KEY`
- `WECHAT_APPID` / `WECHAT_SECRET`
- `MOCK_IMAGE_GENERATION=false`
- `MOCK_WECHAT_LOGIN=false`
- `SECRET_KEY`
- `ADMIN_INITIAL_USERNAME`
- `ADMIN_INITIAL_PASSWORD`

说明：

- `AUTO_CREATE_TABLES=false` 表示生产环境不再依赖应用启动时自动建表，应优先执行 Alembic 迁移。
- `BACKEND_CORS_ORIGINS` 支持逗号分隔，例如：

```env
BACKEND_CORS_ORIGINS=https://admin.example.com,https://staging-admin.example.com
```

- `ADMIN_INITIAL_USERNAME` 和 `ADMIN_INITIAL_PASSWORD` 用于首次启动时自动创建管理员。首个管理员创建完成后，建议保留用户名、清空密码，或改由更安全的初始化流程管理。

## 3. 管理台环境变量

`admin-web` 已支持用环境变量指定 API 地址。

开发环境样例见 [`.env.example`](file:///d:/mycode/PictureRepair/admin-web/.env.example)：

```env
VITE_API_BASE_URL=/api/v1/admin
VITE_DEV_API_PROXY_TARGET=http://127.0.0.1:8000
```

生产环境样例见 [`.env.production.example`](file:///d:/mycode/PictureRepair/admin-web/.env.production.example)：

```env
VITE_API_BASE_URL=/api/v1/admin
```

说明：

- 如果 `Nginx` 把 `/api/` 反代到 FastAPI，生产环境推荐继续使用相对地址 `/api/v1/admin`
- 如果管理台与 API 分域部署，可改为：

```env
VITE_API_BASE_URL=https://api.example.com/api/v1/admin
```

## 4. 后端启动顺序

1. 准备生产 `.env`
2. 执行数据库迁移
3. 启动 FastAPI
4. 构建并发布 `admin-web`
5. 配置 Nginx 与 HTTPS

示例命令：

```powershell
cd D:\mycode\PictureRepair
pip install -r backend\requirements.txt
alembic -c backend\alembic.ini upgrade head
python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
```

生产中建议改为进程守护方式，例如 `systemd`、`supervisor` 或容器编排。

`systemd` 示例文件见 [picturerepair-api.service.example](file:///d:/mycode/PictureRepair/deploy/systemd/picturerepair-api.service.example)。

## 5. 管理台构建发布

```powershell
cd D:\mycode\PictureRepair\admin-web
copy .env.production.example .env.production
npm install
npm run build
```

构建产物输出在 `admin-web/dist`。

## 6. Nginx 反向代理

HTTP 示例配置见 [admin-web.conf.example](file:///d:/mycode/PictureRepair/deploy/nginx/admin-web.conf.example)。

HTTPS 更完整的生产样例见 [admin-web-https.conf.example](file:///d:/mycode/PictureRepair/deploy/nginx/admin-web-https.conf.example)。

这个配置做了两件事：

- 直接托管 `admin-web/dist` 静态资源
- 把 `/api/` 请求反代到 `http://127.0.0.1:8000`

这样管理台和 API 就能共享同一域名：

- `https://admin.example.com/`
- `https://admin.example.com/api/v1/admin/*`

## 7. HTTPS 与域名接入

建议流程：

1. 域名解析到服务器公网 IP
2. 放通 `80/443`
3. 安装 `Nginx`
4. 先使用 HTTP 验证站点可访问
5. 再用 `Certbot` 或云厂商证书配置 HTTPS
6. 启用证书后，把 `server_name` 和证书路径替换到 Nginx 配置

## 8. 上线前检查清单

- `SECRET_KEY` 已替换为强随机值
- `ADMIN_INITIAL_PASSWORD` 不再使用默认弱口令
- `MOCK_IMAGE_GENERATION=false`
- `MOCK_WECHAT_LOGIN=false`
- `PAYMENT_USE_TEST_PRICES=false`
- `BACKEND_CORS_ORIGINS` 已限制为正式域名
- `AUTO_CREATE_TABLES=false`
- 数据库已执行迁移
- `admin-web/dist` 已重新构建
- HTTPS 已生效

完整执行顺序见 [GO_LIVE_CHECKLIST.md](file:///d:/mycode/PictureRepair/deploy/GO_LIVE_CHECKLIST.md)。

## 9. 当前代码中的部署相关入口

- 后端配置：[config.py](file:///d:/mycode/PictureRepair/backend/app/core/config.py)
- 后端启动与管理员初始化：[main.py](file:///d:/mycode/PictureRepair/backend/app/main.py)
- 管理台 API 地址：[api.ts](file:///d:/mycode/PictureRepair/admin-web/src/utils/api.ts)
- 管理台 Vite 代理：[vite.config.ts](file:///d:/mycode/PictureRepair/admin-web/vite.config.ts)
