"""从《云篆度人经》字体生成首页经幡用的子集：只留经幡用到的字，每个字形缩放到同一外框。

源字体：https://github.com/Lawrence-of-AnKing/yunzhuan-duren 的 dist/YunZhuanDuRen-Unmerged.ttf
（SIL OFL 1.1，随附 assets/fonts/OFL.txt）。改了 src/components/YunZhuanBanners.tsx 里的
TEXT 就重跑本脚本。

用法：python -I scripts/build-yunzhuan-font.py <YunZhuanDuRen-Unmerged.ttf> [输出 ttf]
依赖：fontTools
"""
import statistics
import sys

from fontTools import subset
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont

# 与 YunZhuanBanners.tsx 的 TEXT 保持一致
TEXT = (
    '道言昔于始青天中碧落空歌大浮黎土受元始度人无量上品元始天尊当说是经周回十过以召十方'
    '始当诣座天真大神上圣高尊妙行真人无鞅数众乘空而来飞云丹霄绿舆琼轮羽盖垂荫流精玉光'
    '五色郁勃洞焕太空七日七夜诸天日月星宿璇玑玉衡一时停轮神风静默山海藏云天无浮翳四气朗清'
)
BOX = 840          # 归一后字形外接框长边（1000 UPM）
CENTER_Y = 380     # (ascender 880 + descender -120) / 2
FAMILY = 'JianJi YunZhuan'

src = sys.argv[1]
out = sys.argv[2] if len(sys.argv) > 2 else 'assets/fonts/JianJiYunZhuan.ttf'

font = TTFont(src)
opts = subset.Options()
opts.layout_features = ['*']      # 保留 calt，同一个字自动轮换写法
opts.name_IDs = ['*']
opts.name_languages = ['*']
opts.hinting = False
opts.notdef_outline = True
sub = subset.Subsetter(opts)
sub.populate(text=TEXT)
sub.subset(font)

glyf, hmtx = font['glyf'], font['hmtx']
glyph_set = font.getGlyphSet()
for name in font.getGlyphOrder():
    g = glyf[name]
    if g.isComposite() or g.numberOfContours == 0 or name == '.notdef':
        continue
    bounds_pen = BoundsPen(glyph_set)
    glyph_set[name].draw(bounds_pen)
    if not bounds_pen.bounds:
        continue
    x0, y0, x1, y1 = bounds_pen.bounds
    scale = min(BOX / max(x1 - x0, y1 - y0), 2.4)
    pen = TTGlyphPen(None)
    glyph_set[name].draw(TransformPen(pen, (scale, 0, 0, scale, 500 - (x0 + x1) / 2 * scale, CENTER_Y - (y0 + y1) / 2 * scale)))
    glyf[name] = pen.glyph()
    glyf[name].recalcBounds(glyf)
    hmtx[name] = (1000, glyf[name].xMin)

for rec in font['name'].names:
    if rec.nameID in (1, 16):
        rec.string = FAMILY
    elif rec.nameID == 4:
        rec.string = FAMILY + ' Regular'
    elif rec.nameID == 6:
        rec.string = 'JianJiYunZhuan-Regular'
font.save(out)

# 自检：每个字都在 cmap 里；归一后长边落在 BOX 附近（glyf 外框按控制点算，会略大）
check = TTFont(out)
cmap = check.getBestCmap()
missing = sorted({ch for ch in TEXT if ord(ch) not in cmap})
assert not missing, missing
edges = [max(g.xMax - g.xMin, g.yMax - g.yMin) for n in check.getGlyphOrder()
         if n != '.notdef' and (g := check['glyf'][n]).numberOfContours > 0]
assert all(BOX * 0.97 <= e <= BOX * 1.03 for e in edges), (min(edges), max(edges))
print(f'{out}: {len(set(TEXT))} 字 / {len(edges)} 字形，长边中位数 {statistics.median(edges)}')
