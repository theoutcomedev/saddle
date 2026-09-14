# Agent Note: Workbench 浏览器面板只保留一个导航来源

Status: implemented

[English](2026-09-13-browser-pane-single-navigation-source.md) | 中文

## Problem

每次 `browser_*` 工具调用都会让它所在的对话行派发 `workbench:open-browser`，并附带一个在浏览器里用页面 hostname 拼出的 Steel 调试 URL。因此 dock 会把读者正在看的内容替换成 Steel 的查看器，而该查看器自身的界面在可调整宽度的面板里是一块固定尺寸的表面。随后 `browser-pane.tsx` 会优先使用这个 stream 端点而不是地址栏里的地址；提交新地址时又会把仍然持有的端点重新广播，于是输入的页面永远不会成为 iframe 里的页面。Steel 容器还在 `steel.<ip>.sslip.io` 上发布了 Traefik 路由，而该 API 在未设置 `STEEL_API_KEY` 时不校验任何身份：未认证的调用方可以在部署自身的网络上创建并操控浏览器会话。没有任何客户端代码读取浏览器工具已经返回的 `viewerUrl`，该字段只是被打印给读者。

## Decision

工具行只渲染本次调用，不派发任何事件；打开链接仍然是读者自己的动作，经由现在只携带 URL 的 `workbench:open-browser` 完成。浏览器面板的地址栏是唯一的导航来源：owner 传入的 URL 只作初始值，标签页只保存 URL，提交处理器执行导航而不再重新广播。Steel 查看器、接管控制，以及 `WorkbenchPaneParams` 上的 stream 字段都已删除。

Steel 继续为 agent 自身的浏览服务，但不再有 Traefik 路由，只以 `saddle-steel:3000` 在 `saddle-network` 上应答。浏览器工具仅在部署设置了 `STEEL_PUBLIC_VIEWER_URL` 时返回查看器 URL，否则返回空字符串，模型不会再拿到无法解析的链接。

## Alternatives considered

**保留接管控制并默认显示页面。** 该控件只有在 stream 端点存在时才有意义，而端点本身就是缺陷：它替换了读者请求的页面，并让面板宽度对其显示内容毫无影响。保留控件就会保留端点、重新广播和公开路由。

**通过 Saddle 的认证路由代理 Steel 查看器。** 这是实时视图最终应该采取的形式，但它是一个新的 host 表面，需要自己的会话归属、授权和 frame 策略；自动打开移除后，面板并不需要它。现在拆掉这座桥，决定仍然是开放的，而不是再交付一个未认证的入口。

**保留公开的 Steel 路由并设置 API 密钥。** 要让查看器可用，密钥必须到达浏览器，这会把一个覆盖整个网络的凭据放进客户端代码，而且该查看器在面板宽度下本来也不可用。

**保留无用的 stream 管道。** 无人写入的参数在评审中看起来像是受支持的能力；一个没有生产者的参数是面板无法兑现的承诺。

## Consequences

agent 浏览会话运行时不再在屏幕上可见，模型也拿不到查看器 URL，因此用户无法从 GUI 观察或接管该会话。换来的是：dock 继续显示读者打开的内容，面板尊重自己的地址栏，部署不再暴露未认证的浏览器自动化 API，被删除的字段、文案和样式也不再宣称一个在面板尺寸下不可行的能力。重新引入实时视图意味着一个经过认证、尺寸正确的表面，而不是把 Steel 调试页面塞进 iframe。

## Related

[browser-pane.client.spec.tsx](../../../../packages/client/ui-workbench/tests/browser-pane.client.spec.tsx) 固化地址栏是唯一导航来源，[tool-row.client.spec.tsx](../../../../packages/client/ui-tool/tests/tool-row.client.spec.tsx) 固化 `browser_navigate` 行不派发任何事件。
