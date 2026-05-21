# SSL 证书与 Nginx 维护文档

## 域名信息

| 项目 | 值 |
|---|---|
| 域名 | `repairpic.lstcloud.com` |
| 服务器内网 IP | `10.0.31.2` |
| 公网 IP（负载均衡） | `103.6.4.2` |
| 证书管理工具 | acme.sh + Let's Encrypt |
| Web 服务器 | Nginx |

## 目录结构

```
/etc/nginx/
├── sites-available/repairpic.lstcloud.com.conf   # Nginx 站点配置
├── sites-enabled/repairpic.lstcloud.com.conf     # 符号链接（启用状态）
└── ssl/repairpic.lstcloud.com/
    ├── fullchain.pem    # 证书链
    ├── cert.pem         # 证书
    └── privkey.pem      # 私钥

/root/.acme.sh/                                  # acme.sh 安装目录
/www/PictureRepair/deploy/
├── setup-ssl.sh                                 # 一键申请证书脚本
├── nginx/repairpic.lstcloud.com.conf            # Nginx 配置备份
└── SSL维护文档.md                                # 本文档
```

## 前置条件

### 1. 云平台端口转发

本机在负载均衡后面，需要在云服务商控制台配置：

- **80 端口**（TCP） → 转发到 `10.0.31.2:80`
- **443 端口**（TCP） → 转发到 `10.0.31.2:443`

### 2. DNS 解析

确保 `repairpic.lstcloud.com` 的 A 记录指向公网 IP `103.6.4.2`。

验证：
```bash
dig +short repairpic.lstcloud.com
# 应返回 103.6.4.2
```

## 首次申请证书

端口转发和 DNS 都配置好后，执行：

```bash
cd /www/PictureRepair
sudo bash deploy/setup-ssl.sh
```

脚本会自动完成：
1. 切换 acme.sh 到 Let's Encrypt
2. 临时配置 nginx 用于域名验证
3. 申请 SSL 证书
4. 安装证书到 nginx SSL 目录
5. 应用完整的 HTTPS nginx 配置
6. 重载 nginx

验证：
```bash
curl -I https://repairpic.lstcloud.com/
```

## 证书续期

acme.sh 安装时已自动配置 cron 任务，证书到期前 30 天自动续期。

查看 cron 任务：
```bash
crontab -l | grep acme
```

手动续期测试：
```bash
/root/.acme.sh/acme.sh --renew -d repairpic.lstcloud.com --ecc --force
```

## Nginx 常用操作

```bash
# 测试配置语法
nginx -t

# 重载配置（不断开连接）
systemctl reload nginx

# 重启服务
systemctl restart nginx

# 查看状态
systemctl status nginx

# 查看错误日志
tail -f /var/log/nginx/error.log

# 查看访问日志
tail -f /var/log/nginx/access.log
```

## 修改 Nginx 配置

配置文件位置：`/etc/nginx/sites-available/repairpic.lstcloud.com.conf`

编辑后生效步骤：
```bash
nginx -t                    # 先测试语法
systemctl reload nginx      # 语法无误后重载
```

## 常见问题

### 证书申请失败：端口不通

症状：acme.sh 报 `Invalid response: 404` 或超时

排查：
```bash
# 从外部测试 80 端口
curl -v http://repairpic.lstcloud.com/.well-known/acme-challenge/test

# 检查本机 nginx 是否在运行
systemctl status nginx

# 检查本机 80 端口是否在监听
ss -tlnp | grep ':80'
```

解决：确认云平台 80 端口已转发到 `10.0.31.2:80`。

### HTTPS 无法访问

排查：
```bash
# 检查 443 端口
ss -tlnp | grep ':443'

# 检查证书文件是否存在
ls -la /etc/nginx/ssl/repairpic.lstcloud.com/

# 检查 nginx 配置
nginx -t
```

### 证书过期

```bash
# 查看证书到期时间
openssl x509 -in /etc/nginx/ssl/repairpic.lstcloud.com/fullchain.pem -noout -dates

# 手动续期
/root/.acme.sh/acme.sh --renew -d repairpic.lstcloud.com --ecc --force
systemctl reload nginx
```

### 更换域名

如需更换域名，需要：
1. 更新 DNS 解析
2. 修改 nginx 配置中的 `server_name`
3. 重新申请证书：
   ```bash
   /root/.acme.sh/acme.sh --issue -d 新域名 --webroot /var/www/html --force
   ```
4. 更新本文档中的域名信息

## 架构说明

```
用户浏览器
    │
    ▼
[云平台负载均衡] 103.6.4.2:80/443
    │
    ▼ (端口转发)
[Nginx] 10.0.31.2:80/443
    ├── 静态文件: /www/PictureRepair/admin-web/dist
    └── /api/ → proxy_pass http://127.0.0.1:8000
                    │
                    ▼
            [FastAPI 后端] 127.0.0.1:8000
```

- 用户访问 `https://repairpic.lstcloud.com/` → 返回管理台前端
- 用户访问 `https://repairpic.lstcloud.com/api/v1/*` → 转发到 FastAPI 后端
- HTTP 请求自动 301 跳转到 HTTPS
