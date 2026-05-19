# PictureRepair 上线执行清单

这份清单面向第一次正式上线，按顺序执行可降低漏项概率。

当前已知部署参数：

- 域名：`repairpic.51time.com`
- 部署目录：`/www/repairpic`
- Linux 运行用户：`root`
- admin-web：同域部署
- 后端监听端口：`8000`

## 1. 服务器准备

- 创建项目目录，例如 `/opt/picturerepair`
- 创建 Python 虚拟环境，例如 `/opt/picturerepair/.venv`
- 安装 `Nginx`
- 准备 `PostgreSQL`、`Redis`
- 确认服务器可访问对象存储和外部模型服务

## 2. 部署代码

- 上传或拉取仓库代码到服务器
- 安装后端依赖
- 安装前端依赖
- 确认 `backend/requirements.txt` 和 `admin-web/package-lock.json` 与当前代码一致

## 3. 准备环境变量

- 从 [`.env.production.example`](file:///d:/mycode/PictureRepair/.env.production.example) 复制为服务器 `.env`
- 至少替换以下值：
  - `POSTGRES_*`
  - `REDIS_*`
  - `OSS_*`
  - `ARK_API_KEY`
  - `WECHAT_APPID`
  - `WECHAT_SECRET`
  - `SECRET_KEY`
  - `ADMIN_INITIAL_USERNAME`
  - `ADMIN_INITIAL_PASSWORD`
- 再次确认以下开关：
  - `ENVIRONMENT=production`
  - `AUTO_CREATE_TABLES=false`
  - `MOCK_IMAGE_GENERATION=false`
  - `MOCK_WECHAT_LOGIN=false`
  - `PAYMENT_USE_TEST_PRICES=false`
  - `BACKEND_CORS_ORIGINS=https://admin.example.com`

## 4. 数据库处理

- 执行 Alembic 迁移
- 检查管理员表、审计表是否存在
- 首次启动后确认管理员账号已自动初始化

示例：

```bash
cd /opt/picturerepair
. .venv/bin/activate
alembic -c backend/alembic.ini upgrade head
```

## 5. 构建管理台

- 从 [admin-web/.env.production.example](file:///d:/mycode/PictureRepair/admin-web/.env.production.example) 生成 `.env.production`
- 根据部署方式确认 `VITE_API_BASE_URL`
- 执行构建
- 将 `admin-web/dist` 发布到 Nginx `root`

示例：

```bash
cd /opt/picturerepair/admin-web
cp .env.production.example .env.production
npm ci
npm run build
```

## 6. 配置 FastAPI 服务

- 复制 [picturerepair-api.service.example](file:///d:/mycode/PictureRepair/deploy/systemd/picturerepair-api.service.example) 到 `/etc/systemd/system/picturerepair-api.service`
- 按服务器实际目录修改：
  - `User`
  - `Group`
  - `WorkingDirectory`
  - `EnvironmentFile`
  - `ExecStart`
- 重新加载并启动服务

示例：

```bash
sudo systemctl daemon-reload
sudo systemctl enable picturerepair-api
sudo systemctl restart picturerepair-api
sudo systemctl status picturerepair-api
```

## 7. 配置 Nginx

- 复制 [admin-web-https.conf.example](file:///d:/mycode/PictureRepair/deploy/nginx/admin-web-https.conf.example) 到 Nginx 站点配置目录
- 替换：
  - `server_name`
  - 证书路径
  - `root`
- 测试并重载配置

示例：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 8. 证书与域名

- 域名已解析到服务器 IP
- 80/443 端口已放通
- HTTPS 证书已签发并安装
- 浏览器访问 `https://admin.example.com` 无证书告警

## 9. 上线后验证

- 管理台首页能打开
- 管理员能登录
- 仪表盘可加载
- 用户、任务、订单、流水、审计日志列表可打开
- 任务详情页、订单详情页可打开
- 审计日志筛选可用
- 刷新提示和分页正常
- 后端 `/docs` 仅用于内部排障，不对公网直接暴露为主要入口

## 10. 回滚准备

- 保留上一个可用版本的 `admin-web/dist`
- 保留上一个可用版本的 `.env`
- 确保数据库迁移变更可审查
- 记录本次上线时间、操作人和变更范围
