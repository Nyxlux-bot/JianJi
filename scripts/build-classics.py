#!/usr/bin/env python3
"""
书阁典籍构建：从公开底本拉取原文，清理、分篇，写入 src/data/classics/。

底本只有两处，每部书的出处都写进 index.json 的 source：
  - 殆知阁古代文献 https://github.com/garychowcmu/daizhigev20 （简体）
  - 维基文库 https://zh.wikisource.org （PD-old，繁体，经 OpenCC 转简体，记下修订号）
命理旧有四部（子平真诠、滴天髓阐微、渊海子平、命理探源）沿用原书阁的数据，存在 scripts/classics-legacy。

只做这些处理，不增删正文：去掉四库提要、版式行、目录与重复的面包屑标题；
去掉《黄金策》底本里今人加的白话括注；按篇切分，过长的篇按段落拆成（一）（二）；
字与标点之间的空格是底本缺字，补「□」；殆知阁几部卜书简化时把卦名「乾」误作「干」，在「干宫」「干卦」等处改回。

依赖：Python 3.10+，pip install opencc-python-reimplemented
用法：python scripts/build-classics.py [--cache 缓存目录]
"""
import argparse
import hashlib
import json
import os
import re
import sys
import tempfile
import time
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'src', 'data', 'classics')
LEGACY = os.path.join(ROOT, 'scripts', 'classics-legacy')
DZG = 'https://raw.githubusercontent.com/garychowcmu/daizhigev20/master/'
WIKI_API = 'https://zh.wikisource.org/w/api.php'
UA = {'User-Agent': 'JianJi-classics/1.0 (build-classics.py)'}
MAX_CHAPTER = 15000
NUM = '一二三四五六七八九十百零〇两'

SIKU_DROP = r'^(钦定四库全书.*|总纂官.*|总校官.*|详校官.*|校对官.*|腾录.*|.*提要|<子部.*>|.*【臣】.*|臣等谨案.*|.*乾隆\S*年\S*月恭校上.*)$'
# 「。，」等句读，加上底本里的全角句点「．」：带这些的行不是标题
PUNCT = '，。；：！？、（．'
GUA_NAMES = ('乾 坤 屯 蒙 需 讼 师 比 小畜 履 泰 否 同人 大有 谦 豫 随 蛊 临 观 噬嗑 贲 剥 复 无妄 大畜 颐 大过 坎 离 '
             '咸 恒 遯 遁 大壮 晋 明夷 家人 睽 蹇 解 损 益 夬 姤 萃 升 困 井 革 鼎 震 艮 渐 归妹 丰 旅 巽 兑 涣 节 中孚 小过 既济 未济').split()
GUA_RE = '|'.join(sorted(GUA_NAMES, key=len, reverse=True))

# 书目：art 为卷（shan 山 / yi 医 / ming 命 / xiang 相 / bu 卜），按书架顺序排
BOOKS = [
    # —— 山：上层丹道修炼，下层养生导引 ——
    dict(id='zhouyicantongqi', title='周易参同契', author='魏伯阳', dynasty='东汉', art='shan',
         src=('wiki', '周易參同契'), head_level=2, keep='乾'),
    dict(id='wuzhenpian', title='悟真篇', author='张伯端', dynasty='北宋', art='shan',
         src=('wiki', '悟真篇'), head_level=2, merge_small=400, keep='乾'),
    dict(id='zhonglvchuandaoji', title='钟吕传道集', author='施肩吾', dynasty='唐', art='shan',
         src=('dzg', '道藏/藏外/钟吕传道集.txt'), drop=r'^钟吕传道集$', drop_front=True,
         head=r'^论\S{1,4}第[一二三四五六七八九十]+$'),
    dict(id='xingmingguizhi', title='性命圭旨', author='尹真人弟子', dynasty='明', art='shan',
         src=('dzg', '道藏/藏外/性命圭旨.txt'), drop=r'^（[^）]*）$|^性命双修万神圭旨$',
         vol=r'^[元亨利贞]集$', head=rf'^[^{PUNCT}]{{2,18}}$', merge_small=600),
    # 殆知阁的内景经每隔一句丢掉句末字（「右太」应为「右太阴」），改用维基文库
    dict(id='huangtingjing', title='黄庭经', author='佚名', dynasty='魏晋', art='shan',
         src=('wiki', [('黃庭內景經', '太上黃庭內景玉經', '内景经'), ('黃庭外景經', None, '外景经')]), page_chapter=True, head_level=2, front='外景经', keep='乾'),
    dict(id='yangxingyanminglu', title='养性延命录', author='陶弘景', dynasty='南朝梁', art='shan',
         src=('dzg', '医藏/养性延命录.txt'), drop=r'^华阳陶隐居集$',
         vol=r'^养性延命录卷[上下]$', head=r'^养性延命录序$|^\S+篇第[一二三四五六]$'),
    dict(id='zunshengbajian', title='遵生八笺', author='高濂', dynasty='明', art='shan',
         src=('dzg', '医藏/遵生八笺.txt'), start=r'^屠隆序$', merge_small=200,
         # 底本里夹着今人关于简繁字形的按语，去掉
         line_sub=[(r'（[^（）]*(简体|繁写|今天的)[^（）]*）', '')],
         head=r'^(屠隆序|李时英叙|自叙)$|^\S{2,6}笺(〔\S+〕)?$'),
    dict(id='yijinjing', title='易筋经', author='周述官', dynasty='清', art='shan',
         src=('dzg', '艺藏/武术/达摩洗髓易筋经.txt'), start=r'^原叙一$', note='底本为周述官《增演易筋洗髓内功图说》的今人整理本',
         drop=r'^(上编|中编|下编|\S{2,6}篇|第[一二三四五六七八九十]+章)$', repeated=3,
         head=r'^原叙[一二三四五六七八九十]$|^[一二三四五六七八九十]+、\S+$', strip_num=True, merge_small=300),

    # —— 医 ——
    dict(id='huangdineijing', title='黄帝内经', author='佚名', dynasty='先秦', art='yi',
         src=('wiki', '黃帝內經'), page_volume=True, volume_from_page=True, head_level=2),
    dict(id='nanjing', title='难经', author='秦越人', dynasty='旧题战国', art='yi',
         src=('dzg', '医藏/八十一难经.txt'), drop=r'^八十一难经.*$',
         vol=r'^从\S+难至\S+难论\S+$', head=r'^[一二三四五六七八九十]+难$'),
    dict(id='shanghanlun', title='伤寒论', author='张仲景', dynasty='东汉', art='yi',
         src=('dzg', '医藏/伤寒论宋版.txt'), drop=r'^宋版《伤寒论》$',
         head=r'^(序|辨 ?脉 ?法|平 ?脉 ?法|伤 ?寒 ?例|辨\S{2,24}(病|证|法)\S{0,12}( .*)?)$', title_sub=(r' [合方].*$|\s', '')),
    dict(id='jinguiyaolue', title='金匮要略', author='张仲景', dynasty='东汉', art='yi',
         src=('wiki', '金匱要略'), head_level=2),
    dict(id='shennongbencaojing', title='神农本草经', author='佚名', dynasty='东汉', art='yi',
         src=('dzg', '医藏/神农本草经.txt'), drop=r'^神农本草经$', front='序录',
         vol=r'^《[上中下]卷》$', head=r'^\S{2,4}部[上中下]品$'),
    dict(id='zhenjiujiayijing', title='针灸甲乙经', author='皇甫谧', dynasty='西晋', art='yi',
         # 维基文库有些篇名没标成标题，按「…第N」补认
         src=('wiki', '針灸甲乙經'), page_volume=True, head_level=2,
         head=r'^[^，。；：！？、\s]{2,30}第[一二三四五六七八九十]+(（[上下]）)?$'),
    # 药名在有的页是二级标题、有的页是三级，逐页按第一个非「部/类」标题定层级
    dict(id='bencaogangmu', title='本草纲目', author='李时珍', dynasty='明', art='yi',
         src=('wiki', '本草綱目'), page_volume=True, auto_level=True, note='维基文库本尚未校订，有少量缺字'),
    dict(id='binhumaixue', title='濒湖脉学', author='李时珍', dynasty='明', art='yi',
         src=('wiki', '瀕湖脈學'), page_chapter=True),
    dict(id='wenbingtiaobian', title='温病条辨', author='吴瑭', dynasty='清', art='yi',
         src=('dzg', '医藏/温病条辨.txt'), drop=r'^温病条辨.*$',
         vol=r'^卷\S·\S+篇$|^原病篇$', head=r'^(自序|原病篇)$', head_after_vol=True),

    # —— 命 ——
    dict(id='zipingzhenquan', title='子平真诠', author='沈孝瞻', dynasty='清', art='ming', src=('legacy', 'zipingzhenquan')),
    dict(id='ditiansuichanwei', title='滴天髓阐微', author='任铁樵', dynasty='清', art='ming', src=('legacy', 'ditiansuichanwei')),
    dict(id='yuanhaiziping', title='渊海子平', author='徐大升', dynasty='宋', art='ming', src=('legacy', 'yuanhaiziping')),
    dict(id='minglitanyuan', title='命理探源', author='袁树珊', dynasty='民国', art='ming', src=('legacy', 'minglitanyuan')),
    dict(id='sanmingtonghui', title='三命通会', author='万民英', dynasty='明', art='ming',
         src=('dzg', '易藏/术数/三命通会.txt'), drop=SIKU_DROP + r'|^明 ?万民英 ?撰$',
         vol=r'^三命通会卷[一二三四五六七八九十]+$', head=r'^(论|总论|释|原|又论|定|看)[^，。；：！？、【\s]{2,16}$'),
    dict(id='qiongtongbaojian', title='穷通宝鉴', author='余春台', dynasty='清', art='ming',
         src=('dzg', '易藏/术数/穷通宝鉴.txt'), drop=r'^穷通宝鉴$',
         head=r'^(五行总论|论[甲乙丙丁戊己庚辛壬癸]?[木火土金水]|三[春夏秋冬][甲乙丙丁戊己庚辛壬癸][木火土金水](总论)?)$'),
    dict(id='shenfengtongkao', title='神峰通考', author='张楠', dynasty='明', art='ming',
         src=('dzg', '易藏/术数/神峰通考.txt'), drop=r'^神峰通考.*$',
         head=r'^(叙|[^\s，。；：！？、造]{2,16}(说|说类|格|论|赋|歌)(附\S{1,10})?)$', merge_small=300),
    dict(id='ziweidoushuquanshu', title='紫微斗数全书', author='陈抟', dynasty='旧题宋', art='ming',
         src=('wiki', '紫微斗數全書'), vol_level=2, head_level=3, merge_small=200, keep='乾'),

    # —— 相：上层人相，下层冰鉴与地相 ——
    dict(id='taiqingshenjian', title='太清神鉴', author='王朴', dynasty='五代', art='xiang',
         src=('dzg', '易藏/术数/太清神鉴.txt'), drop=SIKU_DROP,
         head=r'^原序$|^太清神鉴卷[一二三四五六]$', title_sub=(r'^太清神鉴', '')),
    dict(id='renlundatongfu', title='人伦大统赋', author='张行简', dynasty='金', art='xiang',
         src=('dzg', '易藏/术数/人伦大统赋.txt'), drop=SIKU_DROP + r'|^元薛延年注$',
         head=r'^原序$|^人伦大统赋卷[上下].*$', title_sub=(r'^人伦大统赋(卷[上下]).*$', r'\1')),
    dict(id='shenxiangquanbian', title='神相全编', author='袁忠彻', dynasty='明', art='xiang',
         src=('dzg', '易藏/术数/神相全编.txt'), drop=r'^《神相全编》$',
         head=rf'^[^{PUNCT}\s]{{2,12}}$', merge_small=150),
    dict(id='liuzhuangxiangfa', title='柳庄相法', author='袁珙', dynasty='明', art='xiang',
         src=('dzg', '易藏/术数/柳庄相法.txt'), vol=r'^[上中下]册$',
         head=r'^[一二三四五六七八九十]+、.{2,30}$', strip_num=True, merge_small=500),
    dict(id='bingjian', title='冰鉴', author='曾国藩', dynasty='清', art='xiang',
         src=('dzg', '易藏/术数/冰鉴.txt'), start=r'^冰鉴$', drop=r'^冰鉴$',
         head=r'^第[一二三四五六七]\S{2}$'),
    dict(id='zhaijing', title='宅经', author='佚名', dynasty='旧题黄帝', art='xiang',
         src=('dzg', '易藏/术数/宅经.txt'), drop=SIKU_DROP + r'|^宅经$|^四库全书提要$|^总纂官.*|^总校官.*',
         head=r'^卷 ?[上下]$', title_sub=(r'\s', '')),
    dict(id='zangshu', title='葬书', author='郭璞', dynasty='晋', art='xiang',
         src=('dzg', '易藏/术数/葬书.txt'), drop=r'^葬书$', front='内篇',
         head=r'^(内 ?篇|外 ?篇|杂 ?篇)$', title_sub=(r'\s', '')),
    # 四库本把疑龙经、葬法倒杖合在一处；篇名行里夹着空格和撰人
    dict(id='hanlongjing', title='撼龙经', author='杨筠松', dynasty='唐', art='xiang',
         src=('dzg', '易藏/术数/撼龙经.txt'), drop=SIKU_DROP + r'|^(撼龙经|疑龙经)$',
         line_sub=[(r'^(葬法倒杖) ?唐 ?杨筠松 ?撰(\S+)$', r'\1\n\2')],
         head=r'^撼龙经 ?唐 ?杨筠松 ?撰$|^疑龙经 ?唐 ?杨筠松 ?撰上篇$|^(中篇|下篇|葬法倒杖)$|^(疑龙十问|卫龙篇|变星篇)【附】$',
         title_sub=(r'^.+$', lambda m: {'中篇': '疑龙经中篇', '下篇': '疑龙经下篇'}.get(m.group(0), re.sub(r' ?唐 ?杨筠松 ?撰|【附】', '', m.group(0))))),

    # —— 卜 ——
    dict(id='zhouyi', title='周易', author='文王 · 孔子', dynasty='先秦', art='bu',
         src=('dzg', '易藏/易经/周易.txt'), drop=r'^周易$|^[ⅰⅱⅲⅳⅴⅵⅶⅷ]$', vol=r'^(上经|下经)$',
         head=r'^\d{2}[\.．] ?\S+（卦\S+）$|^(系辞|系辞下|说卦|序卦|杂卦)$', strip_num=True, title_sub=(r'^系辞$', '系辞上'),
         line_sub=[(r'^[ⅰⅱⅲⅳⅴⅵⅶⅷ]（', '（'), (r'^上天尊地卑', '天尊地卑')]),
    # 底本只给前十八卦标了「此起为某卦」，按「某之某」的本卦分篇
    dict(id='jiaoshiyilin', title='焦氏易林', author='焦延寿', dynasty='西汉', art='bu',
         src=('dzg', '易藏/术数/焦氏易林.txt'), drop=r'^■+.*■+$', pre='jiaoshi', group=rf'^({GUA_RE})之({GUA_RE})$'),
    dict(id='meihuayishu', title='梅花易数', author='邵雍', dynasty='宋', art='bu',
         src=('dzg', '易藏/术数/梅花易数.txt'), start=r'^序$', drop=r'^目录$', fix_qian='all',
         line_sub=[(r'^清黄宗羲撰$', '（清黄宗羲撰）')],
         vol=r'^卷[一二三四五]$', head=rf'^(序|[^{PUNCT}\s]{{2,14}})$', merge_small=600),
    dict(id='huozhulin', title='火珠林', author='麻衣道者', dynasty='宋', art='bu',
         src=('dzg', '易藏/术数/火珠林.txt'), drop=r'^火珠林.*$', fix_qian=True,
         head=r'^\d+[．\.]\S+$|^附：\S+$', strip_num=True, merge_small=120),
    dict(id='huangjince', title='黄金策', author='刘基', dynasty='明', art='bu',
         src=('dzg', '易藏/术数/黄金策.txt'), drop=r'^《黄金策》.*$', pre='huangjince', note='底本附有今人白话注，已删去，只留原文',
         head=r'^\d+、\S+$', strip_num=True),
    dict(id='yiyin', title='易隐', author='曹九锡', dynasty='明', art='bu',
         src=('dzg', '易藏/术数/易隐.txt'), start=r'^易隐序$', drop=r'.*\t.*|^易隐目录$|^易隐 作者.*$', fix_qian=True,
         vol=r'^卷[首一二三四五六七八]$', head=rf'^易隐序$|^\S{{2,6}}占$|^[^{PUNCT}\s]{{2,12}}(法|诀|说|辨|歌|图|例|卦|戒)$', merge_small=400),
    dict(id='bushizhengzong', title='卜筮正宗', author='王洪绪', dynasty='清', art='bu',
         src=('dzg', '易藏/术数/卜筮正宗.txt'), drop=r'^卜筮正宗\t.*$', fix_qian=True,
         head=rf'^[^{PUNCT}\s\t]{{2,22}}$', merge_small=800),
    dict(id='zengshanbuyi', title='增删卜易', author='野鹤老人', dynasty='清', art='bu',
         # 底本是今人把文言本与白话译本合编的整理本，三段摇卦说明纯是今人白话，去掉；其余照录并在书里注明
         src=('dzg', '易藏/术数/增删卜易.txt'), drop=r'^增删卜易 .*$|^(占卦时|共摇六次|初学点卦时).*$', fix_qian=True, skip=(r'^目 *录$', r'^增删卜易卷之一$'),
         note='底本为今人整理本，个别断语夹有白话转述',
         vol=r'^(增删卜易)?卷之\S+$', head=r'^增删卜易序$|^\S{1,24}(章|图)第\S+$'),
]


def fetch(url, path, binary=False):
    if not os.path.exists(path):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        for attempt in range(8):
            try:
                data = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120).read()
                time.sleep(0.5)  # 维基文库限速，逐页拉取时放慢
                break
            except Exception as error:
                if attempt == 7:
                    raise
                retry = getattr(error, 'headers', None) and error.headers.get('Retry-After')
                time.sleep(int(retry) if retry and retry.isdigit() else 3 + attempt * 4)
        with open(path, 'wb') as f:
            f.write(data)
    with open(path, 'rb') as f:
        return f.read() if binary else f.read().decode('utf-8', errors='replace')


def wiki_api(cache, **params):
    params['format'] = 'json'
    key = re.sub(r'[\\/:*?"<>|]', '_', urllib.parse.urlencode(sorted(params.items())))
    name = key if len(key) <= 180 else hashlib.sha1(key.encode()).hexdigest()  # 长页名截断会撞名
    path = os.path.join(cache, 'wikiapi', name + '.json')
    return json.loads(fetch(WIKI_API + '?' + urllib.parse.urlencode(params), path))


def wiki_page(cache, title):
    d = wiki_api(cache, action='parse', page=title, prop='wikitext|revid', formatversion=2)
    return d['parse']['wikitext'], d['parse']['revid']


def wiki_subpages(cache, title):
    d = wiki_api(cache, action='query', list='allpages', apprefix=title + '/', apnamespace=0, aplimit=500)
    return [p['title'] for p in d['query']['allpages']]


def strip_templates(text):
    """{{*|小注}} 记作（小注）；{{?}} 记作 □；{{另|字}}、{{PUA|字}} 取字；其余模板（页眉、版权、分类）去掉。"""
    out, i = [], 0
    while i < len(text):
        if text.startswith('{{', i):
            depth, j = 0, i
            while j < len(text):
                if text.startswith('{{', j):
                    depth += 1
                    j += 2
                elif text.startswith('}}', j):
                    depth -= 1
                    j += 2
                    if depth == 0:
                        break
                else:
                    j += 1
            inner = strip_templates(text[i + 2:j - 2])
            name, _, rest = inner.partition('|')
            name = name.strip()
            if name in ('*', '**'):
                out.append('（' + rest.strip() + '）')
            elif name == '?':
                out.append('□')
            elif name == '!':
                out.append('|')
            elif name in ('另', 'PUA', 'YL') and rest:
                out.append(rest.split('|')[0].strip())
            i = j
        else:
            out.append(text[i])
            i += 1
    return ''.join(out)


def wiki_to_lines(wt):
    wt = re.sub(r'<ref[^>]*?/>|<ref[^>]*>.*?</ref>|<!--.*?-->', '', wt, flags=re.S)
    wt = strip_templates(wt)
    wt = re.sub(r'\[\[(?:File|Image|Category|文件|分类|分類|Index):[^\]]*\]\]', '', wt, flags=re.I)
    wt = re.sub(r'\[\[[^\]|]*\|([^\]]*)\]\]', r'\1', wt)
    wt = re.sub(r'\[\[([^\]]*)\]\]', r'\1', wt)
    wt = re.sub(r"'{2,}", '', wt)
    wt = re.sub(r'<br\s*/?>', '\n', wt)
    wt = re.sub(r'</?[a-zA-Z][^>]*>', '', wt)
    lines = []
    for line in wt.split('\n'):
        m = re.match(r'^(=+)\s*(.*?)\s*=+\s*$', line.strip())
        if m:
            lines.append(('§', len(m.group(1)), m.group(2)))
        else:
            lines.append(re.sub(r'^[*#:;]+', '', line))
    return lines


def toc_order(main_wt, subpages, book):
    """按主页目录里链接出现的先后给子页排序，取链接文字作卷名。"""
    order, names = [], {}
    for m in re.finditer(r'\[\[([^\]|]+)(?:\|([^\]]+))?\]\]', main_wt):
        target = m.group(1).strip()
        full = book + target if target.startswith('/') else target
        if full in subpages and full not in order:
            order.append(full)
            names[full] = (m.group(2) or full.split('/')[-1]).strip()
    return order, names


def clean(line):
    line = line.replace('　', ' ').replace('\t', ' ').replace('﻿', '')
    line = re.sub(r' {2,}', ' ', line).strip()
    return line


def load_source(cfg, cache, t2s):
    kind = cfg['src'][0]
    if kind == 'dzg':
        paths = cfg['src'][1] if isinstance(cfg['src'][1], list) else [cfg['src'][1]]
        lines = []
        for p in paths:
            text = fetch(DZG + urllib.parse.quote(p), os.path.join(cache, 'dzg', p.replace('/', '__')))
            lines += text.split('\n')
        return lines, {'kind': '殆知阁', 'ref': paths, 'url': 'https://github.com/garychowcmu/daizhigev20'}
    # 一部书可由几页拼成：(主页, 子页前缀, 分部名)；子页前缀为空时用主页名
    parts = cfg['src'][1] if isinstance(cfg['src'][1], list) else [(cfg['src'][1], None, None)]
    revs, lines = {}, []
    for main_title, prefix, part_name in parts:
        prefix = prefix or main_title
        main_wt, revs[main_title] = wiki_page(cache, main_title)
        subs = [s for s in wiki_subpages(cache, prefix) if not s.endswith('/全覽')]
        if part_name:
            lines.append(('卷', 0, part_name))
        if not subs:
            lines += wiki_to_lines(main_wt)
            continue
        order, names = toc_order(main_wt, subs, prefix)
        order += sorted(s for s in subs if s not in order and cfg.get('page_volume'))
        for sub in order:
            wt, revs[sub] = wiki_page(cache, sub)
            name = sub.split('/')[-1] if cfg.get('volume_from_page') else names.get(sub, sub.split('/')[-1])
            if cfg.get('page_chapter'):
                lines.append(('§', 1, name))
            elif cfg.get('page_volume'):
                lines.append(('卷', 0, name))
            lines += wiki_to_lines(wt)
    # OpenCC 会把卦名「乾」转成「干」；易学、丹道书里的乾都是卦名，先护住
    keep = cfg.get('keep', '')
    convert = lambda s: ''.join(t2s(part) if i % 2 == 0 else part for i, part in enumerate(re.split(f'([{keep}])', s))) if keep else t2s(s)
    lines = [(x[0], x[1], convert(x[2])) if isinstance(x, tuple) else convert(x) for x in lines]
    titles = [p[0] for p in parts]
    return lines, {'kind': '维基文库', 'ref': titles, 'url': 'https://zh.wikisource.org/wiki/' + titles[0], 'revisions': revs}


HJC_TITLES = '总断千金赋|天时|年时|国朝|征战|身命|婚姻|产育|进人口|疾病|医药|鬼神|种作|蚕桑|六畜|求名|仕宦|求财|家宅|坟墓|求师|求馆|词讼|避乱|逃亡|失脱|出行|行人|舟船|娼家'


def huangjince(lines):
    """《黄金策》底本：每句后有今人白话括注（全角括号，可跨行、也有夹在句中的），连同「（存赋不注）」一并去掉，
    只留刘基原文；篇名与正文常挤在一行（「3、年时阴暗晴暑……」），拆成两行。"""
    text = '\n'.join(line for line in lines if isinstance(line, str))
    while True:
        stripped = re.sub(r'（[^（）]*）', '', text)
        if stripped == text:
            break
        text = stripped
    out = []
    for line in text.split('\n'):
        s = clean(line)
        m = re.match(rf'^(\d+、(?:{HJC_TITLES})(?:\(附老娘乳母）|附束修|附盗贼、捕贼)?)(.*)$', s)
        if m:
            out.append(m.group(1).replace('(', '（'))
            if m.group(2).strip():
                out.append(m.group(2))
        else:
            out.append(s)
    return out


def jiaoshi(lines):
    """《焦氏易林》底本前十八卦写作「乾之坤」一行、林辞一行；从临卦起改成本卦名一行、「乾　林辞」一行。统一成前一种写法。"""
    # 无妄卦缺了卦名行，接在复卦后面；之卦从乾重新排起时，按卦序换到下一卦
    order = [n for n in GUA_NAMES if n != '遁']
    out, current, seen = [], None, set()
    for line in lines:
        s = clean(line)
        if re.fullmatch(GUA_RE, s):
            current, seen = s, set()
            continue
        m = re.match(rf'^({GUA_RE}) (.+)$', s)
        if current and m:
            if m.group(1) in seen:
                current, seen = order[order.index(current) + 1], set()
            seen.add(m.group(1))
            out += [f'{current}之{m.group(1)}', m.group(2)]
        else:
            out.append(s)
    return out


# 底本简化时把卦名「乾」也改成了「干」；只在明显是卦名的地方改回，天干、干支不动：
# 一是「干宫」「干卦」「干为天」这类固定搭配；二是同一行里还出现别的卦名时，不在下列「干」字词里的干都是乾
QIAN_FIX = re.compile(r'(?<![天十甲乙丙丁戊己庚辛壬癸日月年时支])干(?=宫|卦|为天|为金|兑|坤|三连|上|下|属金|金)|(?<=坤)干|(?<=之)干(?=[，。、；：）\s]|$)')
QIAN_CONTEXT = re.compile(r'[乾坤震巽坎离艮兑]')
# 梅花易数通篇讲卦，干几乎都是乾，只留这几个词
GAN_WORDS_FEW = re.compile(r'天干|干支|十干|干燥|干戈|干肉|干脯|干亢|干涉|相干|干枯|干湿')
GAN_WORDS = re.compile(r'天干|干支|支干|十干|[日年月时阴阳藏]干|干[神头禄涉犯求谒预城德合官鬼燥湿净连枯戈蛊]|相干|何干|无干|若干|干[父母]')


def fix_qian(s, everywhere=False):
    s = QIAN_FIX.sub('乾', s)
    if not everywhere and not QIAN_CONTEXT.search(s):
        return s
    words = GAN_WORDS_FEW if everywhere else GAN_WORDS
    keep = {i for m in words.finditer(s) for i in range(m.start(), m.end())}
    return ''.join('乾' if ch == '干' and i not in keep else ch for i, ch in enumerate(s))


def parse(cfg, lines):
    vol_re = re.compile(cfg['vol']) if cfg.get('vol') else None
    head_re = re.compile(cfg['head']) if cfg.get('head') else None
    drop_re = re.compile(cfg['drop']) if cfg.get('drop') else None
    group_re = re.compile(cfg['group']) if cfg.get('group') else None
    head_level, vol_level = cfg.get('head_level', 2), cfg.get('vol_level')
    line_subs = cfg.get('line_sub', [])
    # 面包屑：同一短行反复出现
    repeated = set()
    if cfg.get('repeated'):
        counts = {}
        for line in lines:
            if isinstance(line, str):
                s = clean(line)
                if 0 < len(s) <= 14 and not re.search(r'[，。；：！？]', s):
                    counts[s] = counts.get(s, 0) + 1
        repeated = {k for k, v in counts.items() if v >= cfg['repeated']}
    started = not cfg.get('start')
    skip_from, skip_to = cfg.get('skip', (None, None))
    skipping = False
    chapters, front, volume, pending, level_of_entry = [], [], '', False, None
    queue = list(reversed(lines))
    while queue:
        raw = queue.pop()
        if isinstance(raw, tuple):
            kind, level, text = raw
            text = clean(text)
            if not text:
                continue
            if kind == '卷' or (vol_level and level == vol_level):
                volume = re.sub(r'（[^）]*）', '', text)
                level_of_entry = None
                continue
            if cfg.get('auto_level') and kind == '§':
                # 本草纲目：「草部」「山草类上三十一种」是分类；分类之后第一个标题的层级就是药名的层级
                if re.search(r'[种类]', text) and re.search(r'部|之[一二三四五六七八九十]', text) and len(text) <= 30:
                    volume = re.sub(r'（[^）]*）', '', text)
                    level_of_entry = None
                    continue
                level_of_entry = level_of_entry or level
                is_head = level <= level_of_entry
            else:
                is_head = level <= head_level or kind == '§' and level == 1
            if is_head:
                chapters.append({'title': title_of(cfg, text), 'volume': volume, 'paras': []})
            else:
                # 篇内的小标题（释名、集解、其一……）单独成行，加【】与正文分开
                (chapters[-1]['paras'] if chapters else front).append(text if text.startswith('【') else f'【{text}】')
            continue
        s = clean(raw)
        if not s:
            continue
        if not started:
            if re.match(cfg['start'], s):
                started = True
            else:
                continue
        # skip：跳过底本里的目录这类整段（从起始行到结束行之前）
        if skip_from and not skipping and re.match(skip_from, s):
            skipping = True
        if skipping:
            if not re.match(skip_to, s):
                continue
            skipping = False
        for pat, rep in line_subs:
            s = re.sub(pat, rep, s)
        if '\n' in s:
            queue.extend(reversed(s.split('\n')))
            continue
        if s.startswith('属性：'):
            s = s[3:]
        if cfg.get('fix_qian'):
            s = fix_qian(s, cfg['fix_qian'] == 'all')
        if (drop_re and drop_re.match(s)) or s in repeated or re.fullmatch(r'[\W_ⅰⅱⅲⅳⅴⅵⅶⅷ]+', s):
            continue
        if group_re:
            m = group_re.match(s)
            if m and (not chapters or chapters[-1]['title'] != m.group(1)):
                chapters.append({'title': m.group(1), 'volume': volume, 'paras': []})
        if vol_re and vol_re.match(s):
            volume = re.sub(r'\s', '', s)
            volume = volume[len(cfg['title']):] if volume.startswith(cfg['title']) and volume != cfg['title'] else volume
            pending = cfg.get('head_after_vol', False)
            if not (head_re and head_re.match(s)):
                continue
        if (head_re and head_re.match(s) and len(s) <= 40) or (pending and len(s) <= 30 and not re.search(r'[。；！？]$', s)):
            pending = False
            chapters.append({'title': title_of(cfg, s), 'volume': volume, 'paras': []})
            continue
        pending = False
        (chapters[-1]['paras'] if chapters else front).append(s)
    # drop_front：底本卷首是今人编的书目说明（经名、底本出处、参校版本），不是原书文字
    if sum(len(p) for p in front) >= 20 and not cfg.get('drop_front'):
        chapters.insert(0, {'title': cfg.get('front', '卷首'), 'volume': '', 'paras': front})
    return chapters


def title_of(cfg, text):
    t = text.strip()
    if cfg.get('strip_num'):
        t = re.sub(r'^(\d+[、．\.]\s*|[一二三四五六七八九十]+、)', '', t)
    if cfg.get('title_sub'):
        pat, rep = cfg['title_sub']
        t = re.sub(pat, rep, t)
    return t.strip()


def finalize(cfg, chapters):
    # 只有标题没有正文的（目录、分组标题）去掉
    chapters = [c for c in chapters if sum(len(p) for p in c['paras']) > 0]
    small = cfg.get('merge_small')
    if small:
        merged = []
        for c in chapters:
            if merged and sum(len(p) for p in c['paras']) < small and c['volume'] == merged[-1]['volume']:
                merged[-1]['paras'] += [c['title']] + c['paras']
            else:
                merged.append(c)
        chapters = merged
    out = []
    for c in chapters:
        paras = [mark_missing(p) for p in c['paras']]
        if sum(len(p) for p in paras) <= MAX_CHAPTER:
            out.append({**c, 'paras': paras})
            continue
        parts, buf, size = [], [], 0
        for p in paras:
            if buf and size + len(p) > MAX_CHAPTER:
                parts.append(buf)
                buf, size = [], 0
            buf.append(p)
            size += len(p)
        parts.append(buf)
        for i, part in enumerate(parts):
            out.append({**c, 'title': f"{c['title']}（{cn_num(i + 1)}）", 'paras': part})
    return out


def mark_missing(p):
    # 字与标点之间的空格，是底本缺字（字与字之间的空格多是药名分隔，不动）
    return re.sub(r'(?<=[一-鿿]) (?=[，。、：；！？）」』])', '□', p)


def cn_num(n):
    digits = '零一二三四五六七八九'
    if n < 10:
        return digits[n]
    if n < 20:
        return '十' + (digits[n % 10] if n % 10 else '')
    return digits[n // 10] + '十' + (digits[n % 10] if n % 10 else '')


def legacy_book(book_id):
    """旧有四部：篇名去掉序号与「- 命理探源-袁树珊(民国)」后缀，拆出卷次；正文首行若重复篇名则去掉。与原 getChapterLabel / getChapterParagraphs 一致。"""
    with open(os.path.join(LEGACY, book_id + '.json'), encoding='utf-8') as f:
        data = json.load(f)
    chapters = []
    for ch in data['chapters']:
        base = re.sub(r'\s+-\s+命理探源.*$', '', ch['title'])
        base = re.sub(r'\d+(-\d*)?$', '', base)
        merged = re.match(r'^(.+)/\1取运$', base)
        split = re.match(r'^(.+)-((?:卷|赋论).+)$', base)
        if merged:
            title, volume = merged.group(1) + '（附取运）', ''
        elif split:
            title, volume = split.group(1), split.group(2)
        else:
            title, volume = base, ''
        lines = [x.strip() for x in ch['text'].split('\n') if x.strip()]
        strip = lambda s: re.sub(r'[《》\s]', '', re.sub(r'^[一二三四五六七八九十百]+[．、.]\s*', '', s))
        raw = re.sub(r'\s+-\s+命理探源.*$', '', ch['title'])
        if len(lines) > 1 and strip(lines[0]) in {strip(raw), strip(raw.split('-')[0]), strip(title), strip(title.replace('（附取运）', ''))}:
            lines = lines[1:]
        chapters.append({'id': ch['id'], 'title': title, 'volume': volume, 'paras': lines})
    return chapters


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--cache', default=os.path.join(tempfile.gettempdir(), 'jianji-classics'))
    ap.add_argument('--only', help='只构建这些 id，逗号分隔，用于调试')
    args = ap.parse_args()
    try:
        from opencc import OpenCC
    except ImportError:
        sys.exit('缺少 OpenCC：pip install opencc-python-reimplemented')
    t2s = OpenCC('t2s').convert
    os.makedirs(os.path.join(OUT, 'books'), exist_ok=True)
    index = []
    only = set(args.only.split(',')) if args.only else None
    index_path = os.path.join(OUT, 'index.json')
    previous = {}
    if only and os.path.exists(index_path):
        with open(index_path, encoding='utf-8') as f:
            previous = {b['id']: b for b in json.load(f)}
    for cfg in BOOKS:
        if only and cfg['id'] not in only:
            if cfg['id'] in previous:
                index.append(previous[cfg['id']])
            continue
        if cfg['src'][0] == 'legacy':
            chapters = legacy_book(cfg['id'])
            source = {'kind': '原书阁数据', 'ref': ['scripts/classics-legacy/' + cfg['id'] + '.json']}
        else:
            lines, source = load_source(cfg, args.cache, t2s)
            if cfg.get('pre'):
                lines = {'huangjince': huangjince, 'jiaoshi': jiaoshi}[cfg['pre']](lines)
            chapters = finalize(cfg, parse(cfg, lines))
            for i, c in enumerate(chapters):
                c['id'] = f"{cfg['id']}-{i + 1:03d}"
        body = [{'id': c['id'], 'title': c['title'], **({'volume': c['volume']} if c['volume'] else {}), 'text': '\n'.join(c['paras'])} for c in chapters]
        assert body, cfg['id'] + ' 没有切出任何篇'
        with open(os.path.join(OUT, 'books', cfg['id'] + '.book'), 'w', encoding='utf-8') as f:
            json.dump({'id': cfg['id'], 'chapters': body}, f, ensure_ascii=False, separators=(',', ':'))
        chars = sum(len(c['text']) for c in body)
        index.append({
            'id': cfg['id'], 'title': cfg['title'], 'author': cfg['author'], 'dynasty': cfg['dynasty'], 'art': cfg['art'],
            'charCount': chars, 'source': {**source, **({'note': cfg['note']} if cfg.get('note') else {})},
            'chapters': [{'id': c['id'], 'title': c['title'], **({'volume': c['volume']} if c.get('volume') else {}), 'charCount': len(c['text'])} for c in body],
        })
        print(f"{cfg['id']:22s} {len(body):5d} 篇 {chars:9d} 字  首篇：{body[0]['title']} …… 末篇：{body[-1]['title']}")
    if not only or previous:
        with open(index_path, 'w', encoding='utf-8') as f:
            json.dump(index, f, ensure_ascii=False, separators=(',', ':'))
        # Metro 只认静态 require，书目一变就重新生成这张表
        with open(os.path.join(OUT, 'books.ts'), 'w', encoding='utf-8', newline='\n') as f:
            f.write('// 由 scripts/build-classics.py 生成，勿手改\n')
            f.write('export const BOOK_FILES: Record<string, number> = {\n')
            for b in index:
                f.write(f"    {b['id']}: require('./books/{b['id']}.book'),\n")
            f.write('};\n')


if __name__ == '__main__':
    main()
