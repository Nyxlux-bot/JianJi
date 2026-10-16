# 六神剪纸图标

参考现有五行图标，以内置 image_gen 生成。六张均为 1254 × 1254 透明 RGBA PNG 原始素材；页面实际使用的是下方 `ui/` 目录里的裁边版本。

| 六神 | 文件 | 配色 |
| --- | --- | --- |
| 青龙 | qinglong.png | 青绿 |
| 朱雀 | zhuque.png | 朱红 |
| 勾陈 | gouchen.png | 土黄 |
| 螣蛇 | tengshe.png | 赭色 |
| 白虎 | baihu.png | 象牙白 |
| 玄武 | xuanwu.png | 墨色 |

检查：已查看造型并抽样验证透明通道。生成图仍有边缘和镂空区域杂点，白虎尤为明显；接入页面前需继续清理并检查深浅背景。白虎使用透明清理版本，其余使用初始生成版本以保持与五行素材接近的配色。

完整生成及清理提示词见 generation-prompts.md。

## 页面用图（ui/）

`ui/` 下是接入页面用的 96 × 96 版本：按透明通道裁去四周留白后居中缩放。由 `src/components/LiuShenIcon.tsx` 按主题选图。

| 文件 | 用途 |
| --- | --- |
| qinglong / zhuque / gouchen / tengshe / baihu / xuanwu.png | 原图裁边后缩放 |
| baihu-yang.png | 阳（浅色）主题的白虎：象牙白压暗为银灰并加暗描边，避免在宣纸底上隐没 |
| xuanwu-yin.png | 阴（深色）主题的玄武：墨色提亮为青灰并加浅描边，避免在暗底上隐没 |

更新上面的原图后，需要同步重新生成 `ui/` 下对应的文件。
