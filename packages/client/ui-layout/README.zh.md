# @deepseek-ai/dsh-client-ui-layout

[English](README.md) | 中文

外壳插件：三栏 AppFrame（拖动手柄与让步链）、`ctx.layout` 面板几何服务，以及 `ctx.device`——浏览器对人面前这台机器的说法。它注册到运行时拥有的 `root` slot，并声明 `sidebar`、`conversation`、`details`、`shell.overlay` 和 `shell.mobile_trigger`。侧边栏的缩放边界是不可见命中条带，详情栏边界则保留其浮动胶囊；让步期间只有详情栏会收缩并随后自动关闭。关闭的侧边栏仍保留 56px 控制栏，详情栏则关闭到零宽度。该包还提供主题呈现器：它消费解析后的 `ctx.theme` 快照，并将其投影到 document（用 `html { color-scheme }` 驱动原生 UA 控件，依据当前配色方案设置 `body[data-ds-dark-theme]`，并将主题的别名 token 设为 body 上的内联变量，同时拥有一个 `<meta name="theme-color">`，其内容随计算后的 body 背景色更新）。在应用调色板和 token 后进行测量，可确保渲染后的背景成为唯一的颜色依据；呈现器在 dispose（资源释放）时会移除其自有的元数据节点，并一并清除其写入的其他全局状态。

**设备模型**按视口的最短边分类——`phone`、`tablet`、`laptop`、`desktop`——并把输入方式作为独立的一条轴，因此横屏的 1366px 平板是笔记本尺寸、却依然没有指针。类别、方向、输入方式，以及面板能否并排停靠，都以 `data-device`、`data-input`、`data-panes` 发布在根元素上，而 `ctx.device` 会跟随窗口变化：组件与点击处理读这些答案，而不是各自推导断点。

**求解**（`resolveShell`）把布局的要求变成真正渲染出来的样子：请求永不被丢弃，只会被替换——在无法并排停靠面板的设备上，`column` 变成盖在工作之上的 `sheet`；而当布局要求在正文旁边放面板、列宽又装不下两者时，先让会话列表退到它的控制栏，而不是把面板变成抽屉。两种退让都不会改写已存储的面板宽度，因此窗口变宽后恢复的是用户自己的几何。

AppFrame 始终挂载会话栏和详情栏；已连接 Session 通过 `SessionProvider` 渲染。布局 store 是瞬时状态，侧边栏以默认宽度启动，详情栏则保持关闭，且该 store 从不读写 `localStorage`。hero 和其他未选中状态也会将详情栏的渲染宽度派生为零，但不会改变存储的宽度偏好。AppFrame 会跨越这些状态保留最后一个非 blank 会话 id：首个会话保持关闭；显式打开详情栏的操作会使用约定默认宽度；返回同一会话时恢复其未改变的宽度；选择不同会话时，详情栏会在绘制前关闭，并收起发起选择的抽屉（抽屉不同于宽屏列，它是覆盖在所替换会话之上的浮层；宽度偏好保持不变）。在设备无法并排停靠某个面的地方，侧边栏与详情栏渲染为覆盖式抽屉，而不是网格轨道，frame 元素会发布 `data-panes`、`data-density`、`data-details-open` 供外壳级样式取用。会话 owner share 携带当前布局的界面形态（`detailsOpen`、`composer`、`header`、`density`、`measure`），侧边栏 owner share 携带 `collapsed`、`width` 和 `sheet`；注册方通过标准钩子获取业务数据，并从各自的 inject 接口获取操作。

`/client` 导出表层包含插件主体（`apply`／`inject`）、`LayoutController`、`DeviceController`、owner-share 接口，以及其他插件据以求解的设备与外壳约定（`ShellSpec`、`resolveShell`、`DeviceFacts`、`classifyDevice`、`panesAreSheets`，以及三个已发布的属性名）。AppFrame、面板 store、让步求解器与主题呈现器仍属于包内部。

## 模型体验

无。布局外壳管理浏览器查看状态；这里没有任何内容进入模型请求。

#### KV Cache 影响

无；该包既不组装也不发送提供方请求。

## 已知限制与暂缓事项

- **面板几何信息是瞬时状态**：重新加载会恢复侧边栏默认值，并使详情栏保持关闭；在不同会话 id 之间切换同样会关闭详情栏，并忘记拖动后的宽度，而未选中表面会以零宽度渲染详情栏，但不会修改几何信息。
- **让步链自动关闭通过推导零宽度实现，不会改动宽度偏好**：窗口变宽时面板会自行恢复；消费方禁止把 store 中的详情宽度当作实际渲染状态。
- **求解可能把会话列表退到控制栏**：在两者都放不下的地方，要求「面板在正文旁边」的布局会把导航渲染成 56px 控制栏；此后的一次拖动是用户的答案，而不是新规则。
- **挤压重排期间不提供滚动锚定**：布局变化可能移动读者的 viewport。
