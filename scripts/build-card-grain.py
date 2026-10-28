"""生成首页卡面的纸纹贴图：可平铺噪点，细颗粒为主，带一点斑驳；亮点、暗点拆成两张，
只存透明度，颜色由 EntryDeck 按主题用 tintColor 染。

先按设计画布原样出 256px 的图（画布上显示成 128px，0.5dp 一个噪点），再两两平均到
1dp 一个点：用户在电脑上看画布时屏幕就是这么平均的，细颗粒被抵掉一半，看着才柔。
手机按 1:1 画像素，直接用 256px 原图会满是噪点。最后平滑放大出 1x/2x/3x，一张图 128dp。

用法：python -I scripts/build-card-grain.py [输出目录]
依赖：numpy、Pillow
"""
import sys

import numpy as np
from PIL import Image

DP = 128           # 一张图 128dp
N = DP * 2         # 画布原图 256px
out = sys.argv[1] if len(sys.argv) > 1 else 'assets/home'

rng = np.random.default_rng(7)
f = np.fft.fftfreq(N)
r = np.hypot(*np.meshgrid(f, f, indexing='ij'))


def shaped(gain):
    # 频域整形后反变换，周期边界天然无缝
    spec = np.fft.fft2(rng.standard_normal((N, N))) * gain
    out = np.real(np.fft.ifft2(spec))
    return out / out.std()


fine = shaped(np.exp(-(r / 0.42) ** 2))
mottle = shaped(np.where(r > 0, r, 1) ** -1.4 * (r > 1 / 48) * (r < 1 / 6))  # 画布上 3–24px 的斑驳
v = 0.92 * fine + 0.15 * mottle
v = np.clip(v / (2.6 * v.std()), -1, 1)
v = v.reshape(DP, 2, DP, 2).mean(axis=(1, 3))

for scale in (1, 2, 3):
    size = DP * scale
    # 先铺 3×3 再放大、取中间一块，边上插值用的是对面的像素，接缝不露
    big = Image.fromarray(np.tile(v, (3, 3)).astype(np.float32), 'F').resize((size * 3, size * 3), Image.BICUBIC)
    up = np.asarray(big)[size:size * 2, size:size * 2]
    suffix = '' if scale == 1 else f'@{scale}x'
    for name, part in (('light', np.maximum(up, 0)), ('dark', np.maximum(-up, 0))):
        rgba = np.full((size, size, 4), 255, np.uint8)
        rgba[..., 3] = np.clip(part * 255, 0, 255).round().astype(np.uint8)
        Image.fromarray(rgba, 'RGBA').save(f'{out}/grain-{name}{suffix}.webp', quality=82, method=6)
print(out, f'mean|v|={np.abs(v).mean():.3f}')
