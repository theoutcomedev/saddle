# Agent Note: pi-ai 0.85.1 的模型目录刷新，以及优先于 pi-ai 分类的调用方中止

Status: implemented

[English](2026-09-12-pi-ai-0-85-catalog-refresh.md) | 中文

## Problem

已安装的 `@earendil-works/pi-ai` 目录就是 catalog 路由所提供的完整模型列表：`discoverModels` 不发起任何网络请求，直接以已安装条目作答；`catalogModels` 在每个请求背后物化的也是同一批条目。因此，在锁定版本之后发布的模型既不会出现在选择器中，也无法按 id 解析，无论提供方自己的列表怎么说。

跨过两个版本（0.82.1 → 0.85.1）之后，目录中带上了促成此次升级的模型：`claude-fable-5-1`（Claude Fable 5.1）与 `gpt-6-astra`（GPT-6 Astra），此外还有一条被修订的 deepseek 条目和一条被删除的条目。同一版本还改动了 harness 所依赖的两件事：在抵达提供方之前就被取消的请求，如今以普通 `error` 事件返回、消息即中止原因，而不再是 `stopReason: "aborted"`；同时停止原因联合类型新增了 `pending` 与 `deferred`。

## Decision

1. **锁定 `^0.85.1`**：在 `dsh-llm-pi-ai` 中更新版本，并把该版本同步到 `minimumReleaseAgeExclude` 条目——其注释本就说明"新鲜的 pi-ai 发布正是这次升级的意义"。
2. **由调用方自己的信号决定中止。** `toStreamChunks` 接收调用方的信号，并在该信号已中止时，把映射为 error 的终止事件改写为 `aborted`。这与适配器对"捕获到的错误（而非收到的事件）"所用的规则一致，两条投递路径由此统一。
3. **新的停止原因映射为带专属错误码的错误。** `deferred` 只有在调用方请求持久句柄（`SimpleStreamOptions.deferred`）时才可能出现，而本适配器从不请求；`pending` 则表示流在一轮中途结束。两者若被映射为正常停止，都会静默截断这一轮。
4. **0.85.1 新增的九个 compat 字段一律先置为 withhold**，各自在其协议的漂移门中具名：把一个字段改为 offer，意味着要为其补充文档化的 profile 字段与此举换来的线上效果，而当前没有任何部署会因它们改变请求。harness 已经能够触及的两个新*取值*——`baseten` 思考格式与 `thinking.budget` 聊天模板占位符——则加入各自的门，因而可被 profile 引用。
5. **llm 测试套件中的目录预期跟随已安装目录**：deepseek 的输出上限字段拼写（`max_tokens`）、新增的 `low` 等级，以及混合协议的 compat 用例——后者改为自动发现同时提供两种 OpenAI 协议的路由，而不再点名 `xai`。

## Alternatives considered

- **维持锁定，手工声明这两个模型。** 否决：这样只服务两个模型而非整套目录，且手工录入的模型在声明 `input` 之前只被当作纯文本，也拿不到目录中的容量信息。
- **在同一次改动中把这九个新 compat 字段全部 offer。** 暂缓否决：目前没有任何消费方需要它们，而每个 offer 字段都意味着一个文档化的 profile 字段、一条 schema 以及一项需要维护的线上效果（见[包级规则](../../../../packages/AGENTS.md)）。
- **把 `deferred` 停止当作正常停止。** 否决：该响应是可续取的，报成已完成会静默丢弃这一轮剩余内容。
- **为了让预中止用例变绿而放宽断言。** 否决：把一次中止上报为提供方错误是用户可见的误报，而不是应当挪动的测试预期。

## Consequences

- Models 页面会提供 Fable 5.1 与 GPT-6 Astra，两者都能按 id 解析；`claude-opus-4-1` 及其带日期变体已从目录消失，因此把路由或默认模型指向它们的配置需要改换模型。
- DeepSeek 的 pi-ai 路由如今发送 `max_tokens`（而非 `max_completion_tokens`），并上报 `low` 等级——两者都取自已安装条目，而非配置。
- 预中止的请求重新以 `aborted` 结束；流中途的中止从未受影响。
- 那九个被 withhold 的能力在有人 offer 之前不可配置，而漂移门会在下次升级时把这一状态显式暴露出来。

## Files

- `packages/llm/llm-pi-ai/package.json`、`pnpm-workspace.yaml`：版本锁定及其发布年龄豁免。
- `packages/llm/llm-pi-ai/src/stream.ts`：调用方中止规则与 `deferred`／`pending` 原因；`src/adapter.ts` 负责传递信号。
- `packages/llm/llm-pi-ai/src/catalog.ts`：两个新增可引用取值与九个 withhold 字段。
- 测试：`tests/convert.spec.ts`、`tests/adapter.spec.ts`、`tests/catalog.spec.ts`。

## Deferred

- **被 withhold 的能力**——`supportsFinishReason`、`chatTemplateArgs`、`thinkingTokenBudgetField`、`supportsThinkingTokenBudget`、`vllmPriority`、`supportsAdditionalTools`、`supportsMaxOutputTokens`、`supportsMidConvoEffort`、`allowedFallbackModels`。其中最可能先被 offer 的是推理 token 预算这一对：适配器本已提供 `thinkingBudgets`，而这些字段正是基于 token 的端点把推理与答案分开限流的方式。
- **本检出中六项既有失败**（两项 llm-deepseek 目录预期、一项休眠挂载的提供方列表、两项组合超时）在旧锁定版本下同样失败，不属于本次改动。
