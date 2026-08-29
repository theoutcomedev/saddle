# dsh-connections

[English](README.md) | 中文

DeepSeek Harness 的服务连接：一个通用的 `api-key` 授权流程，加上面向模型的
`request_credential` 工具，用于在聊天中接入外部服务。

## 作用

- `registerApiKeyConnection(ctx, { id, label, docsUrl })` 为一个服务注册授权流程。
  该流程通过[授权](../authorization/README.zh.md)接缝的掩码 `secret` 提示（不会进入
  日志或截屏）向用户索取密钥，并将其作为 `api-key` 记录提交到凭证存储。
- `request_credential`（工具）按需注册该流程并运行它，因此模型可以在聊天中提议
  “连接 Supabase？”，用户则在掩码提示中作答。密钥落入加密的凭证存储；工具从不
  回显它。

## 安全

密钥通过掩码输入进入，并由本地凭证提供器静态加密（信封加密）存储。工具只返回
尝试的状态，从不返回值。静态保障见
[credentials-local](../credentials-local/README.zh.md)。

## 服务

| 服务 | 用途 |
|---|---|
| `ctx.authorization` | 注册并运行流程 |
| `ctx.credentials` | 提交 api-key 记录 |
| `ctx.tools` | 注册 `request_credential` |
| `ctx.userQuestions` | 呈现掩码提示 |

## 已知限制

- 目前只提供 `api-key` 方法；`device-flow` 与 `oauth-app` 是授权接缝的其他方法，
  需要各自添加流程。
- 列出流程与已连接记录的侧边栏 “Connections” 页面是另一个客户端包，不属于本
  主机包。
