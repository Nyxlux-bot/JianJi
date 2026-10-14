# 五行剪纸图标

- 统一采用传统五行配色，不再区分阴阳主题，5 张图片均直接保存在此目录。
- 统一为 512 × 512 透明 RGBA PNG，等比例居中并留白；页面实际使用的是下方 `ui/` 目录里的裁边版本。

| 文件名 | 五行 | 图案 | 配色 |
| --- | --- | --- | --- |
| metal.png | 金 | 元宝 | 象牙白 |
| wood.png | 木 | 树木 | 青绿 |
| water.png | 水 | 浪纹 | 墨黑 |
| fire.png | 火 | 火焰 | 朱红 |
| earth.png | 土 | 山峦与地层 | 土黄 |

由内置 imagegen 生成，保留原剪纸剪影风格。最新源图、提示词和深浅底色预览位于 `output/imagegen/wuxing-papercut/`，文件名以 `wuxing-five-colors` 开头。

## 页面用图（ui/）

`ui/` 下是接入页面用的 96 × 96 版本：已裁去四周留白，在 11–16pt 的小尺寸下也能看清图案。由 `src/components/WuXingIcon.tsx` 按主题选图。

| 文件 | 用途 |
| --- | --- |
| wood / fire / earth / metal / water.png | 原图裁边后缩放 |
| metal-yang.png | 阳（浅色）主题的金：银白填充加暗银描边，避免象牙白在宣纸底上隐没 |
| water-yin.png | 阴（深色）主题的水：墨色提亮加浅描边，避免在暗底上隐没 |

更新上面的原图后，需要同步重新生成 `ui/` 下对应的文件。
