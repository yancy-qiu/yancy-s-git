# Apple 平台与桌面小组件决策

> 状态：已确认
>
> 版本：V1.0
>
> 日期：2026-09-17
>
> 决策人：Yancy

## 决策结果

- “轻记”首发聚焦 Apple 平台，覆盖 iPhone 与 Mac。
- 小组件是核心入口，而不是发布后的附加功能。
- 用户可以在 iPhone 主屏幕或 Mac 桌面快速查看记录，并直接执行适合小组件的轻量操作。
- 新增或修改正文时，从小组件直接进入主应用的极简编辑界面。
- Android 和 Web 暂不进入首版。

## 平台能力边界

WidgetKit 支持在 iPhone 主屏幕、Mac 桌面和通知中心展示小组件。交互式小组件可以通过按钮、开关和 App Intents 执行操作，例如完成、恢复或置顶。

小组件不支持通用文本输入、滚动编辑器等完整应用交互。因此：

- 查看、完成、恢复、置顶等操作可以直接在小组件中完成。
- 编辑标题、正文、会议纪要等文本时，点击对应内容并打开主应用的极简编辑界面。
- 小组件始终显示本地已保存的数据，不依赖一次实时网络请求后才出现内容。

## 初步技术方向

```text
iPhone / Mac SwiftUI App
        │
        ├── 共享领域模型与业务规则
        ├── 极简快速编辑界面
        ├── AI 服务层
        │
WidgetKit Extension
        ├── Timeline / 本地快照
        └── App Intents 快速操作
        │
App Group Shared Container
        └── SwiftData 本地存储（候选）
        │
CloudKit 跨设备同步（是否进入首版待确认）
```

选择 Apple 原生技术栈的原因是 SwiftUI、WidgetKit、App Intents、App Group 和 CloudKit 可以直接覆盖 iPhone 与 Mac 的小组件、共享数据和后续同步需求，减少跨平台框架与系统扩展之间的桥接成本。

## 隐私要求

- 用户记录默认按隐私数据处理。
- 锁屏或桌面小组件需要提供内容隐藏、脱敏或占位显示策略。
- AI 服务不得由小组件直接调用；主应用处理完成后只把必要结果保存到共享数据层。
- 错误日志不得包含用户记录正文。

## 待确认事项

1. iPhone 与 Mac 是否在同一 MVP 版本同时交付。
2. 最低支持的 iOS 与 macOS 版本。
3. 是否通过 iCloud 在 iPhone 与 Mac 之间同步数据。
4. 小组件首版需要支持完成、恢复、置顶、延后中的哪些操作。
5. 小组件显示哪些记录，以及隐私内容默认是否隐藏。

## 参考

- [Apple：Widgets and watch complications](https://developer.apple.com/documentation/widgetkit/widgets-and-complications-collection)
- [Apple：Adding interactivity to widgets and Live Activities](https://developer.apple.com/documentation/widgetkit/adding-interactivity-to-widgets-and-live-activities)
- [Apple：Developing a WidgetKit strategy](https://developer.apple.com/documentation/widgetkit/developing-a-widgetkit-strategy)
- [Apple：Configuring app groups](https://developer.apple.com/documentation/xcode/configuring-app-groups)
