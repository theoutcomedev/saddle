# Agent Note: 预览卡片的创意主题适配，以及窄视口抽屉的收起

Status: implemented

[English](2026-09-12-creative-theme-conformance-and-narrow-drawer.md) | 中文

## Problem

有两处界面按固定值绘制而非按调色板绘制，因此只有内置的 `light` 与 `dark` 主题显示正常：

1. 侧边栏的会话／工作区预览卡片由组件 CSS 绘制 `#2C2C2E` 表面色，以及 `#FFFFFF`／`#CFD3D6`／`#ADB2B8` 的标签色阶。在创意调色板下，卡片仍保持中性灰，压在有主题的外壳之上。
2. 在窄视口下，侧边栏是一个全高浮层，但在其中点击会话后，抽屉仍会盖住刚刚打开的对话。

## Decision

1. **预览卡片改为由 token 驱动。** `--dsw-specific-hovercard-bg`、`-label`、`-label-secondary` 与 `-label-tertiary` 取代了组件里的字面颜色，卡片因此由 token 绘制，而不再由 `ui-primitives`／`ui-workspace` 的 CSS 绘制。两个内置调色板都在 `design-platform.css` 中声明它们；各自取名哪些取值由[浅色调色板卡片 Agent Note](../bug-fix/2026-09-14-light-palette-hover-card-surface.zh.md)拥有。`ui-primitives/HoverCard.module.css` 与 `ui-workspace/Rows.module.css` 通过原本就属于它们的 CSS Module 类消费这些 token，两者都不再读取字面颜色。
2. **创意调色板覆盖这些 token。** `ui-theme/src/client/index.ts` 中的 `HOVER_CARD_TOKENS` 组把这四个名字指向调色板自身的 `--dsw-alias-bg-layer-3` 与标签别名。它与 `CHAT_CONTENT_TOKENS` 一起并入 `CREATIVE_TOKENS` 组，由六个调色板共同展开，因此第七个调色板只要展开该组即可继承这套派生。
3. **抽屉的收起是布局策略，而不是点击处理器。** `createLayoutStore` 新增 `closeSidebar`：它清除 `narrowExpanded`，并且与 `toggleSidebar` 不同，绝不写入宽屏宽度偏好。`AppFrame` 在选中会话 id 变化的 layout effect 中调用它（blank 会话同样包含在内），这与既有 `closeDetails` 策略使用的是同一个变化信号。

## Alternatives considered

- **为卡片写死各调色板的字面十六进制值。** 否决：每个调色板要多维护四个字面量，而且一旦某调色板改用自己的层级命名，卡片会静默退回中性值。
- **在组件 CSS 中直接复用既有的别名（`--dsw-alias-bg-layer-3`）。** 否决：在组件里这么做会同时重绘 `light` 与 `dark` 下的卡片。该方案中浅色的那一半后来在样式表中被采纳，并被限定为 `dark` 仍保持 figma 色阶——见[浅色调色板卡片 Agent Note](../bug-fix/2026-09-14-light-palette-hover-card-surface.zh.md)。
- **在每个行的打开处理器里调用收起。** 否决：内容搜索结果、命令面板与"新建会话"按钮都不经过树行就打开了会话，因此点击位置并不是完整集合。
- **复用 `toggleSidebar` 完成收起。** 否决：在窄视口下它翻转的是覆盖标志，因此会把已收起的抽屉重新打开；在宽视口下它则会关闭侧边栏列。

## Consequences

- `dark` 保持 figma 卡片原样不变；`light` 与六个创意调色板都用自身的层级绘制卡片，其标签色阶跟随调色板的对比度，而不再使用固定的白／灰取值。
- 卡片表面现在是主题 token，调色板作者覆盖一个名字即可重新定位它。
- 触发条件是会话选中变化而非点击，因此点击已处于当前状态的会话不会收起抽屉。
- `closeSidebar` 保留在布局 store 内部；`ctx.layout` 的公开接口没有变化。
- 卡片的投影仍来自所有调色板共用的中性样式表。

## Files

- `packages/client/ui-theme/src/styles/design-platform.css`：两个内置调色板的四个 `--dsw-specific-hovercard-*` token。
- `packages/client/ui-theme/src/client/index.ts`：`HOVER_CARD_TOKENS` 与合并后的 `CREATIVE_TOKENS` 组。
- `packages/client/ui-primitives/src/HoverCard.module.css`、`packages/client/ui-workspace/src/client/rows/Rows.module.css`：消费这些 token。
- `packages/client/ui-layout/src/client/stores.ts` 与 `AppFrame.tsx`：`closeSidebar` 及其仅窄视口生效的 effect。
- 测试：`ui-theme/tests/theme.client.spec.ts`、`ui-layout/tests/layout-store.client.spec.ts`、`ui-layout/tests/app-frame.client.spec.tsx`。

## Deferred

- **手势级收起。** 通过每行的回调（即 `expandSidebar` 那条 owner-prop 路径）也能覆盖"点击当前会话"的情形，代价是要把布局回调穿过 `sidebar.workspaces` 传下去。
- **由调色板自有的投影。** 创意调色板没有命名投影，因此卡片仍使用中性的 `--dsw-shadow-lv3`。
