# Agent Note: The light palette's preview card follows the light shell

Status: implemented

[English](2026-09-14-light-palette-hover-card-surface.md) | 中文

## Problem

鼠标悬停侧边栏的 Session 或 Workspace 行会弹出浮层预览卡片。在内置 `light` 主题下，这张卡片绘制的却是 figma 的深色中性色——`#2C2C2E` 表面配白／灰标签色阶——盖在白色外壳之上，于是浅色外壳唯一会显示的浮动表面用了反色。内置 `dark` 主题与所有创意调色板都正常，只有 `light` 成为唯一不跟随外壳的调色板。

## Decision

`design-platform.css` 中的四个 `--dsw-specific-hovercard-*` token 由每个内置调色板各自给出。`body` 规则（light）从该调色板自身的层级与标签别名推导：表面取 `--dsw-alias-bg-layer-3`，色阶取三个 `--dsw-alias-label-*` 层级；`body[data-ds-dark-theme]` 规则则固定 figma 中性色阶（bluish-850/00/300/400，即改动前的确切取值）。`ui-theme/src/client/index.ts` 中的 `HOVER_CARD_TOKENS` 继续为创意调色板覆盖这四个名字，因此凡调色板给出层级，卡片就跟随该层级；而 dark 调色板有意不跟随的位置，卡片保持 figma 色阶。

`packages/client/ui-theme/tests/hover-card-styles.client.spec.ts` 针对样式表文本固定这两种取值，并拒绝只声明其中三个 token 的调色板——未声明的那个会继承另一调色板的值。

## Alternatives considered

- **在 `light` 下保留 figma 中性色卡片。** 否决：这是唯一忽略浅色调色板的界面表面——菜单、tip、代码表面与侧边栏本身都从该调色板推导——而报告的症结正是这一不一致。
- **两个内置调色板都改为推导、彻底去掉 figma 色阶。** 否决：这会重绘 `dark` 卡片，而它当前显示正常且不属于本次缺陷；深色调色板的改动应自成一个决策，而不是搭这次的车。
- **把 `HOVER_CARD_TOKENS` 放到内置 `light`／`dark` 主题定义上，而不是样式表里。** 否决：两个内置主题的 token 表都是空的，且 light 调色板就是未加属性的 `body` 默认值，这么做会让浅色卡片成为唯一依赖“呈现器已应用主题”才有颜色的卡片，同时让 dark 调色板的 figma 色阶失去归属。
- **把别名推导限定为侧边栏专用的覆盖。** 否决：卡片 portal 到 `document.body`，调色板变量正是从那里继承的，限定作用域的覆盖必须重新声明在 portal 宿主上——调色板本来就是正确的归属方。

## Consequences

- 在 `light` 下，卡片是该调色板自身的浅色表面与标签色阶，与它悬浮其上的菜单保持一致。
- `dark` 与六个创意调色板保持不变，卡片仍然绘制共享的中性 `--dsw-shadow-lv3`（该遗留项由[创意主题 Agent Note](../feature/2026-09-12-creative-theme-conformance-and-narrow-drawer.zh.md)拥有）。
- 切换配色方案的主题现在会连同卡片一起翻转，因为两个调色板都声明了这四个 token 中的每一个。

## Files

- `packages/client/ui-theme/src/styles/design-platform.css`：按调色板给出的 `--dsw-specific-hovercard-*` 声明。
- `packages/client/ui-theme/src/client/index.ts`：`HOVER_CARD_TOKENS` 的文档注释。
- `packages/client/ui-theme/tests/hover-card-styles.client.spec.ts`：调色板约定。
- `packages/client/ui-primitives/src/HoverCard.module.css`、`packages/client/ui-workspace/src/client/rows/Rows.module.css`，以及 `ui-primitives`／`ui-theme` 的 README：陈述旧取值的注释与说明文字。

## Verification

`pnpm exec vitest run packages/client/ui-theme packages/client/ui-primitives packages/client/ui-workspace` 在既有客户端测试套件之外覆盖调色板约定。报告的缺陷在真实浏览器中对运行中的 Web GUI 以 1600×900 复检：在两种内置调色板下悬停同一 Session 行，都得到 244px 的卡片——`light` 下表面为 `rgb(255, 255, 255)`、标题为 `rgb(15, 17, 21)`，`dark` 下表面保持 `rgb(44, 44, 46)`、标题为 `rgb(255, 255, 255)`。
