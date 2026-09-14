# @deepseek-ai/dsh-client-ui-modes

[English](README.md) | 中文

Saddle Web GUI 的工作区布局：让屏幕的形状去适配工作、设备与当下的时刻。一个布局就是一条基于外壳已有布局事实的配方，因此整个能力等于数据加一个应用器——新增一个只需一条目录记录和它的文案，永远不需要在外壳里另开一条代码路径。node 半边是空 apply（用于 roster 行）。

## 叫布局，不叫 mode

产品里已经有 **agent preset**（Standard、Creator……）——那是助手能做什么——会话头部会把它显示成一枚 pill。这里说的是另一件事：助手工作时屏幕的形状。两者都叫「mode」会让同一个头部出现两枚同名 chip、同一个侧边栏出现两行同一个词，因此这个能力在所有用户可见之处都叫 **布局**：侧边栏行、选择器标题、chip、工具，以及会话事件。

## 这个包拥有什么

**布局目录**（`src/client/catalogue.ts`）：每个布局 id 对应一种排布，用 `ctx.layout` 接受的面板形状表达（`closed` / `default` / `wide`）。宽度契约留在 `ui-layout` 的 columns 里：布局只说形状，像素由外壳决定。

**按设备类别的记忆**（`src/client/store.ts`）：当前布局持久化在以设备类别（`phone`、`tablet`、`desktop`）为作用域的键下，因此手机与笔记本可以各自持有不同的形状；刷新后恢复的是该设备类别离开时的形状，而不是默认形状。

**应用器**（`src/client/apply.ts`）：两次写入，没有生命周期变化。面板经 `ctx.layout.setPanels` 写入（列宽重算；详情子树以 0 宽度保持挂载），`data-workspace-layout` 落在根元素上，供 `layouts-chrome.module.css` 取用。由于不挂载也不卸载，切换会保住草稿、滚动位置和正在运行的任务。

**三个入口**：侧边栏底部、Deployments 与 Scheduled Tasks 旁边的「布局」行；会话头部显示当前布局、一键退出的 chip（与侧边栏行使用同一个图形）；以及 agent 自己的工具。

| 布局 | 排布 | 用途 |
| --- | --- | --- |
| `default` | 会话列表打开，详情列收起 | 应用最初的形状 |
| `focus` | 收起会话列表，放宽详情列 | 一份文档加一个面板 |
| `zen` | 两侧面板收起，对话收成 760px 阅读宽度 | 写与读 |

## agent 入口

agent 通过调用 `set_workspace_layout` 工具应用布局，该调用会追加由 [`@deepseek-ai/dsh-workspace-modes`](../../interaction/workspace-modes/README.zh.md) 拥有的 `workspace/layout` 事件。宿主把该事件折叠成 `workspaceLayout` 会话投影（`{ layout, at }`），头部 chip 消费它：一条指令按其序号只被应用一次，因此「重新进入一个用户已经退出的布局」依然生效，而「退出」不会被当初进入它的那条指令撤销。用户自己的切换直接写入 store，不经过日志往返。

## Model Experience

间接相关：本包只负责渲染、排布与记忆；模型能做什么——工具名、描述、参数枚举与持久记录——属于 `@deepseek-ai/dsh-workspace-modes`。这里不新增任何模型可见文本。

#### KV Cache effect

本包不产生缓存影响。切换只重排面板与列宽，不触碰系统提示词或工具目录，因此不会让任何请求前缀失效。工具目录由会话的 agent preset 固定——这也正是本插件不随布局增删工具的原因。

## Known Limitations and Deferred Work

- **一次只能一个布局。** 布局不能叠加；Focus 目前还不是其他布局的子状态。
- **记录下来的指令由会话头部消费。** 在未打开的会话中应用的布局，会在该会话被打开时生效。
- **目前只有工作类布局。** Pillar B 目录中的 Play、Share、Morning Briefing、World Builder 以及 Party / Field Capture 尚未构建；Play 与 Share 是接下来的两个。
- **没有按工作区或按会话的覆盖。** 记忆只按设备类别。
- **包名仍叫 `ui-modes`。** 真正要改的是人读到的名字；包名、slot id 与宿主包名保持原样，以免牵动每一条 bundle 行与 tsconfig 引用。
- **chip 的退出没有回执。** 退出布局是一次本地写入，因此排布失败表现为「没有变化」，而不是一条错误。
