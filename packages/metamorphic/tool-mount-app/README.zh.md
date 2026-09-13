# @deepseek-ai/dsh-tool-mount-app

[English](README.md) | 中文

面向模型的 `mount_app` 工具。智能体传入标题与虚拟文件映射，工具将它们保存到
`<会话 cwd>/.saddle/apps/<slug>/`，并作为 `presentationMeta` 返回，由客户端在沙箱 iframe 中
渲染为可交互的实时应用：对话中的内联卡片，以及 Workbench 中的停靠面板。

客户端构建的画布是刻意封闭的——React 18 及其 hooks、lucide 图标与 Tailwind，由单个入口模块
编译，且没有包解析（参见[运行时内部说明](../../../.agents/skills/saddle-apps/references/runtime-internals.md)）。
工具 schema 只描述这套能力：入口为 `/App.tsx`，或一份自包含的 `/index.html`（画布会将其
直接作为文档返回）。这里没有 `dependencies`，也没有 `template` 字段，因为画布不支持它们。

磁盘持久化是尽力而为的：没有可用 cwd 的会话依然可以挂载，此时返回的 `savedDir` 缺省。

## 模型体验

### 变形应用

#### 模型看到什么

一段系统提示词（`saddle:metamorphic-apps`，顺序 195）说明何时应当使用 `mount_app`，以及画布
提供什么：React 18、其 hooks、lucide 图标与 Tailwind 工具类、单个入口文件、无包解析、图表使用
原生 SVG，以及 React 路径无法表达时改用 `/index.html`。工具描述重复同样的边界，schema 包含
`title`、`description`、`target`、`entryFile` 与 `files`。

#### Token 影响

每次请求都有固定的 schema 与提示词开销。调用时应用源码作为参数提交，因此挂载的应用按其源码
计费；返回结果是一行确认信息，外加作为呈现元数据回传的完整文件映射。

#### KV 缓存影响

提示词段落与工具 schema 稳定，因此随请求前缀一同缓存。挂载不会改写此前的对话轮次：工具参数与
结果像其他调用一样追加。唯一的例外是体量很大的应用文件——这些增长位于对话尾部，会从该点起使
前缀缓存失效。

## 已知限制与后续工作

- **没有模块图。** 只有单个入口模块会被执行；额外的 `files` 键会被保存并显示在应用的代码视图
  中，但无法被 import，画布不提供的任何 import 都会以诊断信息被拒绝，而不是被解析。多文件应用
  需要使用 `/index.html` 形态。
- **画布从公共 CDN 加载其编译器与框架。** 网络、代理或 Content-Security-Policy 的拦截会导致所有
  应用无法编译；画布会报告缺失的资源而不是显示空白画面，但尚未自托管这些资源。
- **刻意不支持 npm 包。** 图表库、动画库等必须用原生 SVG／CSS 替代，或让应用以自带文档的
  `/index.html` 形态发布。
- **挂载卡片是快照。** 之后修改已保存的文件不会更新对话中已有的卡片；用户需重新挂载，或从 Apps
  入口打开应用。
