"""生成首页卡面的明暗光斑贴图：白色、只存透明度的径向渐变，颜色由 EntryDeck 用 tintColor 染。

原来每张卡两层 SVG 径向渐变，安卓上 SVG 会画成与视图一样大的位图（比卡片还大），
四张卡八张，首页贴图超过系统缓存上限，转卡时每帧重传。渐变本身是平滑的，
256px 一张拉伸到原尺寸看不出差别，只占 256KB。衰减曲线与原 SVG 的九个色标相同。

用法：python -I scripts/build-card-glow.py [输出目录]
依赖：numpy、Pillow
"""
import sys

import numpy as np
from PIL import Image

N = 256
# 明暗按高斯式曲线淡出：纯色卡面上看不出线性渐变那一圈边。（位置, 不透明度），即原 SVG 的色标
FALLOFF = [(0, 1), (0.12, 0.94), (0.25, 0.8), (0.38, 0.6), (0.5, 0.42), (0.62, 0.26), (0.75, 0.13), (0.88, 0.04), (1, 0)]
out = sys.argv[1] if len(sys.argv) > 1 else 'assets/home'

# 按像素中心取值；拉伸到哪个框，圆就成了内切于它的椭圆，同 SVG 的 cx=cy=rx=ry=50%
c = (np.arange(N) + 0.5) / N * 2 - 1
r = np.hypot(*np.meshgrid(c, c, indexing='ij'))
rgba = np.full((N, N, 4), 255, np.uint8)
rgba[..., 3] = np.round(np.interp(r, *zip(*FALLOFF), right=0) * 255).astype(np.uint8)
Image.fromarray(rgba, 'RGBA').save(f'{out}/glow.png', optimize=True)
print(f'{out}/glow.png', N)
