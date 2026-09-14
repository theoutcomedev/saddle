# @deepseek-ai/dsh-client-ui-modes

[English](README.md) | 中文

Saddle Web GUI 的工作区模式：让屏幕的形状去适配工作、设备与当下的时刻。一个模式就是一条基于外壳已有布局事实的配方，因此整个能力等于数据加一个应用器——新增一个模式只需一条目录记录和它的文案，永远不需要在外壳里另开一条代码路径。node 半边是空 apply（用于 roster 行）。

## 这个包拥有什么

**模式目录**（`src/client/catalogue.ts`）：每个模式 id 对应一种排布，用 `ctx.layout` 接受的面板形状表达（`closed` / `default` / `wide`）。宽度契约留在 `ui-layout` 的 columns 里：模式只说形状，像素由外壳决定。

**按设备类别的记忆**（`src/client/store.ts`）：当前模式持久化在以设备类别（`phone`、`tablet`、`desktop`）为作用域的键下，因此手机与笔记本可以各自持有不同的形状；刷新后恢复的是该设备类别离开时的形状，而不是默认形状。

**应用器**（`src/client/apply.ts`）：两次写入，没有生命周期变化。面板经 `ctx.layout.setPanels` 写入（列宽重算；详情子树以 0 宽度保持挂载），`data-workspace-mode` 落在根元素上，供 `modes-chrome.module.css` 取用。由于不挂载也不卸载，切换会保住草稿、滚动位置和正在运行的任务。

**三个入口**：侧边栏底部、Deployments 与 Scheduled Tasks 旁边的「模式」行；会话头部显示当前模式、一键退出的 chip；以及 agent 自己的工具。

| 模式 | 排布 | 用途 |
| --- | --- | --- |
| `standard` | 会话列表打开，详情列收起 | 应用最初的形状 |
| `focus` | 收起会话列表，放宽详情列 | 一份文档加一个面板 |
| `zen` | 两侧面板收起，对话收成 760px 阅读宽度 | 写与读 |

## agent 入口

agent 通过调用 `set_workspace_mode` 工具应用模式，该调用会追加由 [`@deepseek-ai/dsh-workspace-modes`](../../interaction/workspace-modes/README.zh.md) 拥有的 `workspace/mode` 事件。宿主把该事件折叠成 `workspaceMode` 会话投影（`{ mode, at }`），头部 chip 消费它：一条指令按其序号只被应用一次，因此「重新进入一个用户已经退出的模式」依然生效，而「退出」不会被当初进入它的那条指令撤销。用户自己的切换直接写入 store，不经过日志往返。

## Model Experience

间接相关：本包只负责渲染、排布与记忆；模型能做什么——工具名、描述、参数枚举与持久记录——属于 `@deepseek-ai/dsh-workspace-modes`。这里不新增任何模型可见文本。

#### KV Cache effect

本包不产生缓存影响。切换只重排面板与列宽，不触碰系统提示词或工具目录，因此不会让任何请求前缀失效。工具目录由会话的 agent preset 固定——这也正是本插件不随模式增删工具的原因。

## Known Limitations and Deferred Work

- **一次只能一个模式。** 模式不能叠加；Focus 目前还不是其他模式的子状态。
- **记录下来的指令由会话头部消费。** 在未打开的会话中应用的模式，会在该会话被打开时生效。
- **目前只有工作类模式。** Pillar B 目录中的 Play、Share、Morning Briefing、World Builder 以及 Party / Field Capture 尚未构建；Play 与 Share 是接下来的两个，在本包证明的机制就位后，它们各自只是一条目录记录加一处 slot 贡献。
- **没有按工作区或按会话的覆盖。** 记忆只按设备类别。
- **chip 的退出没有回执。** 退出模式是一次本地写入，因此排布失败表现为「没有变化」，而不是一条错误；`ctx.layout.setPanels` 只在根入口接线之前抛出，而已挂载的 chip 不会遇到这种情况。
