# PictureRepair Testing Guide

本文件记录当前项目在本地 mock 模式下的回归测试方法，供后续开发和联调时复用。

## 1. 测试目标

当前文档覆盖以下可本地验证的能力：

- mock 微信登录
- mock 微信手机号绑定
- mock 图片生成
- 余额不足时禁止导出
- mock 充值加次
- 导出扣次
- 同一任务重复导出不重复扣费
- 订单记录查询
- 交易流水查询
- 小程序前端“余额不足 -> 跳充值 -> 支付成功 -> 自动继续下载”链路

当前文档不覆盖以下真实环境能力：

- 真实微信支付拉起
- 真实微信支付回调
- 真机图片权限、相册保存、微信容器行为
- 真实微信 AppID / Secret 联调

## 2. 前置条件

### 2.1 `.env` 建议配置

本地 UI 与业务联调建议至少开启以下配置：

```env
MOCK_IMAGE_GENERATION=true
MOCK_WECHAT_LOGIN=true
```

说明：

- `MOCK_IMAGE_GENERATION=true` 时，修复任务不会调用真实模型，结果图直接返回上传图 URL。
- `MOCK_WECHAT_LOGIN=true` 时，后端不会请求微信服务器，可直接在开发环境跑通登录和手机号绑定相关流程。

如需把充值金额临时调成几分钱做真机演练，可额外开启：

```env
PAYMENT_USE_TEST_PRICES=true
PAYMENT_TEST_PRICE_SINGLE_1_CENTS=1
PAYMENT_TEST_PRICE_BUNDLE_30_CENTS=2
PAYMENT_TEST_PRICE_BUNDLE_90_CENTS=3
```

说明：

- 默认 `PAYMENT_USE_TEST_PRICES=false`，接口返回正式测试价：`2.99 / 50 / 100`
- 开启后，套餐次数不变，只把价格切成测试分价
- 修改后需要重启后端

### 2.2 启动后端

```powershell
cd D:\mycode\PictureRepair
python -m uvicorn app.main:app --app-dir backend --reload --host 0.0.0.0 --port 8000
```

如果刚修改过 `.env`，需要先重启后端再测试。

### 2.3 小程序端配置

- 微信开发者工具打开 `D:\mycode\PictureRepair\miniprogram`
- 开发环境关闭“校验合法域名”
- `miniprogram\utils\config.js` 指向当前可访问的后端地址

## 3. 后端回归测试

建议按以下顺序执行。

### 3.1 登录与用户

验证点：

- `POST /api/v1/auth/login/mock` 可以返回 token
- `POST /api/v1/auth/login/wechat` 在 mock 模式下可以返回 token
- `POST /api/v1/auth/phone/wechat` 在 mock 模式下可以绑定 mock 手机号
- `GET /api/v1/auth/me` 可以读到当前余额

预期结果：

- 新用户初始导出次数为 `0`
- `auth/me` 返回用户基本信息和 `mileage_balance`

### 3.2 套餐

验证点：

- `GET /api/v1/payments/packages`

预期结果：

- `single_1`: `1` 次，`2.99` 元
- `bundle_30`: `30` 次，`50` 元
- `bundle_90`: `90` 次，`100` 元

### 3.3 修复任务

验证点：

- `POST /api/v1/repair/tasks`
- `GET /api/v1/repair/tasks/{task_id}`
- `GET /api/v1/tasks`

预期结果：

- 接口返回字段统一使用 `task_id`，不再对外返回 `id`
- `MOCK_IMAGE_GENERATION=true` 时，任务最终状态应为 `completed`
- `result_url` 应等于提交时的 `image_url`

建议至少验证两种任务：

- `mode=enhance`
- `mode=colorize`

### 3.4 导出扣次

验证点：

- 未充值时调用 `POST /api/v1/repair/tasks/{task_id}/export`
- 充值后再次调用导出接口
- 同一个任务连续导出两次

预期结果：

- 未充值先导出：返回 `402`
- 充值后首次导出：`charged=true`
- 同一任务再次导出：`charged=false`
- 第二次导出不再重复扣次

### 3.5 订单与流水

验证点：

- `GET /api/v1/payments/orders`
- `GET /api/v1/payments/transactions`

预期结果：

- 充值后能看到 `orders` 记录
- 订单状态为 `mock_paid`
- 交易流水里至少有：
  - `purchase`
  - `export`

## 4. 推荐后端回归场景

建议至少覆盖以下 3 组套餐回归：

### 场景 A：单次套餐

步骤：

1. 新建用户
2. 创建 1 个修复任务
3. 先导出，确认返回 `402`
4. 购买 `single_1`
5. 首次导出
6. 再次导出同一任务

预期：

- 充值后余额 `1`
- 首次导出后余额 `0`
- 再次导出不重复扣费

### 场景 B：50 元 30 次套餐

步骤同上，只是购买套餐改为 `bundle_30`

预期：

- 充值后余额 `30`
- 首次导出后余额 `29`
- 再次导出不重复扣费

### 场景 C：100 元 90 次套餐

建议创建 2 个任务并各导出一次。

预期：

- 充值后余额 `90`
- 第 1 张导出后余额 `89`
- 第 2 张导出后余额 `88`
- 两张图重复导出都不重复扣费

## 5. 小程序前端回归测试

### 5.1 首页

验证点：

- 上传图片
- 创建修复任务
- 结果预览
- 导出高清

预期结果：

- 任务完成后可看到结果图
- 点击“下载高清”时，如果余额不足，会进入充值页
- 充值成功后返回首页，会自动继续下载

### 5.2 修复记录页

验证点：

- 任务列表加载
- “查看”跳转
- “再次下载”导出

预期结果：

- 列表能正确显示状态、日期、模式
- “查看”可进入查看页
- “再次下载”余额不足时会跳充值页
- 充值成功后返回列表页，会自动继续下载

### 5.3 查看页

验证点：

- 原图/结果图预览
- “下载修复后的照片”

预期结果：

- 余额不足时会跳充值页
- 充值成功后返回查看页，会自动继续下载

### 5.4 个人中心

验证点：

- 用户信息刷新
- 当前余额显示
- 已修复数量显示
- 进入充值页
- 进入充值记录页

预期结果：

- 余额与 `auth/me` 返回一致
- 已修复数量与已完成任务数一致

### 5.5 充值记录页

验证点：

- 首屏加载
- 点击“查看更多充值记录”

预期结果：

- 能正确显示充值记录时间和金额
- 分页不会报错
- 没有更多数据时，按钮进入“没有更多了”状态

## 6. 本轮已验证通过的关键规则

截至当前仓库状态，以下规则已实际验证通过：

- 任务接口统一返回 `task_id`
- mock 充值会写入 `orders`
- mock 充值和导出都会写入 `credit_transactions`
- 同一任务重复导出不会重复扣费
- 余额不足时会跳充值页
- 充值成功后会自动回到原页面并继续导出

## 7. 回归时的重点风险

后续改代码时，优先回归以下高风险点：

- `task_id` / `id` 字段是否再次不一致
- 充值成功后是否仍能自动继续下载
- 重复导出是否仍保持幂等
- 个人中心余额是否和后端扣次一致
- 充值记录页分页是否受接口变更影响

## 8. 建议的最短回归清单

每次改动后，至少完成以下 8 项：

1. mock 登录成功
2. 创建 `enhance` 任务成功
3. 创建 `colorize` 任务成功
4. `/repair/tasks` 和 `/tasks` 返回 `task_id`
5. 未充值导出返回 `402`
6. 购买一个套餐后首次导出扣次成功
7. 同一任务再次导出不重复扣费
8. 小程序里走一遍“余额不足 -> 充值 -> 自动继续下载”
