# 十二生肖剪纸素材

- `yang/`：阳主题，朱红动作版。
- `yin/`：阴主题，暖金版；龙已替换为每只可见龙爪五趾的修正版。
- 每套 12 张，均为 512 × 512 RGBA PNG，透明背景，等比例居中并留白。
- 两套使用相同文件名，方便主题切换时对应加载；已由 `src/components/ZodiacPaperCut.tsx` 接入八字结果页头部（按主题取图，朝右的生肖会镜像成朝左）。

| 文件名 | 生肖 |
| --- | --- |
| rat.png | 鼠 |
| ox.png | 牛 |
| tiger.png | 虎 |
| rabbit.png | 兔 |
| dragon.png | 龙 |
| snake.png | 蛇 |
| horse.png | 马 |
| goat.png | 羊 |
| monkey.png | 猴 |
| rooster.png | 鸡 |
| dog.png | 狗 |
| pig.png | 猪 |

素材由内置 imagegen 生成，拆分源图与预览保存在 `output/imagegen/zodiac-papercut/`。
