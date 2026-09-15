# Agent Note: 定时任务可编辑，并可固定其运行所用的模型

Status: implemented

[English](2026-09-15-scheduled-task-editing-and-model-pin.md) | 中文

## Problem

定时任务编排器可以创建任务、暂停与恢复、立即触发、查看运行历史并删除——但无法编辑。要改一段提示词、一个名称或一个周期，就得删掉任务再重建，而这同时丢掉了它的运行历史与上次运行状态。

编辑所需的一半接线其实早已存在。自写下之初，`schedules.update` 就接受 `name`、`prompt`、`cadenceType`、`cadenceValue`、`targetMode` 与 `enabled`，而客户端 store 只用了其中一项：`enabled`，供暂停/恢复开关使用。其余字段只能直接调用 wire 才能触达。

选择模型则在整条路径上都不存在。任务的运行会把一个 agent 回合派发进其目标会话，并继承该会话解析出的任何路由——这次运行没有任何办法说"用这个模型"，无论请求、已存储的视图还是派发本身都没有。

## Decision

**wire 携带一条可选路由。** `ScheduledTaskView`、`schedules.create` 与 `schedules.update` 各自获得一对可选的 `provider` 与 `model`，并在视图、创建与更新三个 schema 上配上对应的 zod 字段。

**主机存储它，运行遵守它。** `api-proxy` 在创建时持久化裁剪后的这一对；在更新时把省略的字段视为"保留已存值"，而显式传入空值则清除该固定。`executeTaskRun` 在派发提示词之前，给它刚刚解析出的 agent 钉上路由：

```ts
selectionFor(turn.agent).current = { provider: task.provider, model: task.model }
```

未固定路由的任务会整行跳过，转而继承会话自身的选择，这正是所有既有任务一直以来的行为。

**表单同时服务两种模式。** 一个表单既创建也编辑；卡片上的编辑操作会以已存储任务预填打开它，store 的 `updateTask` 发送被编辑的字段，并从主机的列表重新绘制，而不是依据乐观副本。

**模型选择器读取主机目录。** `ScheduledTasksStore.listModels` 把 `llm.models` 的分组投影为扁平的 provider/model 选项——即与会话无关的目录，因为 `new-session` 任务在被编辑时还没有任何会话。默认选项是"Session default（每次运行解析）"，也就是未改变的行为。

**未被触碰的周期不会被发送。** 表单能表达 `interval` 与 `cron`；已存储的任务可能持有 `once`，而表单无法表示它。只有当读者触碰某个周期控件之后，周期字段才会加入更新载荷，因此保存一次无关的编辑——一段提示词、一个模型——不会把一次性任务悄悄改写成循环任务。

## Alternatives considered

**为什么不在任务派发进入的会话上存储模型？** 固定必须属于任务本身。在 `new-session` 模式下每次运行都会铸造新的会话 id，因此写在某次运行会话上的选择，到下一次就不在了。

**为什么不在创建时解析并存储已解析的路由？** 目录是参考性的，而 provider 目录会在长寿命任务的存续期间变化；存储读者选定的那一对，能让已存值如实反映曾经要求的是什么，而适配器已消失的路由会使运行以会话自身选择同样的方式失败（`model-unavailable`）。

**为什么不在保存时发送整个表单？** 那正是让 `once` 任务无法被表示的原因——见上文的周期决策。

**为什么不为模型单开一个端点？** 编辑是一次用户动作。第二个端点会让任务在两次可能各自失败的调用之间处于半更新状态。

## Consequences

现在任务可以就地修正，保留其历史、上次运行状态与 id；运行也可以固定到某个模型，而不必继承目标会话恰好解析出的路由。

已存储的任务不受影响，也无需迁移：两个字段都是可选的，缺失即代表先前的行为。位于 `~/.dsh/schedules.json` 的 JSON 存储保存已写入的内容，外加这对可选字段。

选择器显示的是主机所公告的内容。当某个 provider 的目录查询失败时，它的模型只是从列表中缺席——界面提供的路由可能少于实际可运行的路由，这也正是"Session default"保持为默认值、而不是某个目录条目的原因。

## Testing

`packages/client/ui-settings-general/tests/schedules-store.client.spec.ts` 钉住 store 的编辑路径：每个字段都走 wire（包括被清除的固定）；成功的编辑会从主机列表刷新；被拒绝时透出主机的消息且不刷新任何内容；目录投影为 provider/model 对（或空列表）而不抛错。同一套件的模态测试在目录调用被桩替的情况下，保持其覆盖层包含关系的结论。
