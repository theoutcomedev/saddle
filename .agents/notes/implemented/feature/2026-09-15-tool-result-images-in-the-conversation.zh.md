# Agent Note: 工具结果在对话中显示其图像

Status: implemented

[English](2026-09-15-tool-result-images-in-the-conversation.md) | 中文

## Problem

一个以图片作答的工具——`read_image`、`browser_screenshot`——到达客户端时本就带着这张图。调用结果的 `ToolResultNode.content` 里放着模型在下一步会读到的那个 `image` 块（本地的 `tool/code-dispatch` 事件会为子调用投影它；直接调用则把它放在根结果上），所以要把它显示出来，无需重新抓取、解码或推导任何东西。

但没有任何地方渲染它。对话的图片画廊服务于*消息*内容：`AssistantMarkdown` 把 `kind: 'image'` 的助手块经由 `renderMessageImages` 渲染出来，`MessageItem` 对用户图片同样如此。工具调用从不索取。Chat 节点渲染器其实已经在其 owner currency 上收到了 `renderMessageImages`，但原子调用行自己的 owner（`ToolCallOwnerProps`）根本没有携带图片加载器，因此内置的工具视图无从绘制。

于是读者看到的是一句描述图片的话——"Screenshot captured (visual image attached to this turn)"——而看不到图片本身，尽管这段对话自始至终都握着那些字节。

## Decision

`ToolCallTree` 把某个已结束调用的自身结果内容中的图像，经由既有的 `conversation.message.images` 画廊渲染出来，位置在该调用行之下、其子调用之上。

- `resultImages(block)` 从调用的 `content` 块中收集 `type` 为 `image` 的 `{ attachment }`；调用仍在运行时返回空（`RunningToolCall` 没有内容）。
- `ToolCall` 用 `renderMessageImages({ images, align: 'start' })` 绘制它们，也就是助手与用户路径所用的同一个槽位渲染器，因此图片得到真正的 `MessageImage` 尺寸计算与共享的 `ImageLightbox`，而 ui-tool 无需导入任何附件实现。
- `renderMessageImages` 从节点入口经 `ToolCallBranch` 一路传到每个 `ToolCall`，递归子调用亦然。

只渲染调用**自身**的块。子调用会在自己的行上绘制自己的画廊，因此把子项折进父级会让同一张图出现两次。

## Alternatives considered

**为什么不给工具行它自己的图片加载器？** `ToolCallOwnerProps` 是原子视图的契约；在那里加一个加载器，等于在客户端制造第二套图片契约，与 `conversation.message.images` 并列——而后者的存在正是为了这一场景：它自己的类型就把 `RenderMessageImages` 记作"供聊天节点使用的槽位渲染器，无需导入附件实现"。

**为什么不在服务端把工具图像提升为助手消息内容？** 助手内容路径是画廊已经生效的地方，因此把它们放到那里很诱人。但那同样会改变模型在历史中读回的内容，并为一种呈现需求去触碰持久化日志内容。

**为什么不为工具维护一份显式白名单？** 图像块是工具自己声明"我以图片作答"的方式；一份名称清单会与真正产出图像的工具逐渐脱节。

## Consequences

每个带图的工具结果现在都会画进对话记录，包括 `run_code` 子调用里的 `browser_screenshot` 与 `read_image`。这正是意图，也是代价：在循环中调用的工具会把每次截图都重绘进消息流，而在此之前记录保持纯文本，读者需打开浏览器面板或文件才能看到。

同一张图被插件拼接进来的那份副本——harness 还会把它作为下一步的 `user/message`（`source.kind: 'plugin'`）收进来——仍然只渲染文本。那份副本会变成一行上下文注入行，其正文遵循生产者声明的形式而非消息图片路径，因此只显示信封文本（`<path>…</path>`）而没有旁边的图片。既然工具行已经会绘制，它已是冗余，故保持原样，而不是为它再教一条图片路径。

## Testing

`packages/client/ui-tool/tests/tool-call-tree.client.spec.tsx` 钉住三个答案：已结束的图像带着其附件与 `start` 对齐方式抵达画廊；运行中的调用与无图结果不渲染画廊；子调用的图像只渲染一次，在子调用行上，不会在父级重复——正是这一用例抓住了最初实现的递归错误。
