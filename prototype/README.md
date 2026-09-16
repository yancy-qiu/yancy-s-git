# 轻记浏览器交互原型

这是正式 Mac 应用开发前的产品验证版本，覆盖：

- 快速记录与类型选择
- 自动分类与模拟 AI 整理
- 记录编辑、完成和筛选
- Mac 桌面小组件体验预览
- 本地体验反馈收集

原型使用纯 HTML、CSS 和 JavaScript，数据仅保存在当前浏览器的 `localStorage` 中。视觉与交互参考 [Godly](https://godly.design/) 的编辑式排版、留白、圆角卡片和克制动效。

本地预览：

```bash
python3 -m http.server 4173 --directory dist
```

然后打开 `http://127.0.0.1:4173/`。
