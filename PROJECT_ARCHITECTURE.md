# 见机 (Jianji) 项目架构文档

本文档以当前仓库源码为准，描述实际运行入口、目录职责、核心数据模型、主要业务流和近期八字功能带来的架构级变化。若本文件与旧截图、旧 README 或早期讨论不一致，以当前源码实现为准。

---

## 1. 项目定位与技术基线

「见机」当前是一个 **双引擎易学排盘应用**：

- **六爻排盘**
- **八字排盘**

它不是单纯的算法仓库，而是完整产品链路：

`输入 -> 纯计算 -> 结果展示 -> 本地记录 -> 收藏/删除 -> 备份恢复 -> AI 辅助（六爻）`

技术基线：

- Expo SDK 54
- React Native 0.81
- React 19
- TypeScript 5.9
- Expo Router
- expo-sqlite
- AsyncStorage
- tyme4ts 1.4.4

---

## 2. 实际运行入口

当前唯一运行入口是：

1. `package.json`
   - `"main": "expo-router/entry"`
2. `app/_layout.tsx`
   - 挂载 `ThemeProvider`、`SafeAreaProvider`、`CustomAlertProvider`
   - 管理启动 Splash 与根级 `Stack`
3. `app/(tabs)/_layout.tsx`
   - 主标签页容器，定义首页、学习、历史、设置

说明：

- 仓库已删除传统 Expo 模板残留的 `App.tsx` 和 `index.ts`
- 当前不再存在第二条入口链路

---

## 3. 目录分层

项目可以按 7 层理解：

1. **路由与页面层**：`app/`
2. **通用组件层**：`src/components/`
3. **纯计算核心层**：`src/core/`
4. **业务特定 view-model / 运行态层**：`src/features/`
5. **持久化与导入导出层**：`src/db/`
6. **服务层**：`src/services/`
7. **主题 / Hook / 工具 / 静态数据层**：`src/theme/`、`src/hooks/`、`src/utils/`、`src/data/`

当前的关键架构变化基本都围绕这三块展开：

- `src/core/`：新增完整八字计算引擎
- `src/features/bazi/`：新增八字结果页 view-model、编辑辅助、pending cache
- `src/db/`：记录模型从“六爻专用”升级为“多引擎统一 envelope”

---

## 4. 路由与页面结构

### 4.1 顶层路由

| 路由文件 | 实际路径 | 职责 |
| --- | --- | --- |
| `app/(tabs)/index.tsx` | `/` | 首页，六爻与八字入口 |
| `app/(tabs)/learn.tsx` | `/learn` | 学习页入口 |
| `app/(tabs)/history.tsx` | `/history` | 多引擎历史页 |
| `app/(tabs)/settings.tsx` | `/settings` | 主题、备份、恢复 |
| `app/learn/hexagrams.tsx` | `/learn/hexagrams` | 六十四卦总览 |

### 4.2 六爻链路

| 路由文件 | 实际路径 | 职责 |
| --- | --- | --- |
| `app/divination/time.tsx` | `/divination/time` | 时间起卦 |
| `app/divination/coin.tsx` | `/divination/coin` | 铜钱起卦 |
| `app/divination/number.tsx` | `/divination/number` | 数字起卦 |
| `app/divination/manual.tsx` | `/divination/manual` | 手动起卦 |
| `app/result/[id].tsx` | `/result/[id]` | 六爻结果页 |

### 4.3 八字链路

| 路由文件 | 实际路径 | 职责 |
| --- | --- | --- |
| `app/bazi/input.tsx` | `/bazi/input` | 八字输入页，同时承担“新建”和“修改” |
| `app/bazi/result/[id].tsx` | `/bazi/result/[id]` | 八字结果页 |

八字结果页当前分成三段：

- `基本信息`
- `基本排盘`
- `专业细盘`

专业细盘当前具备这些交互：

- 隐私遮罩
- `流年大运 / 胎命身` 切换
- 小运 / 大运 / 流年 / 流月联动
- 结果页直接进入“修改八字”

---

## 5. 核心数据模型

### 5.1 六爻：`PanResult`

定义位置：`src/core/liuyao-calc.ts`

职责：

- 六爻排盘的完整输出对象
- 同时被结果页、AI 对话、分享、历史、备份恢复使用

主要字段组：

- 标识与来源：`id`、`createdAt`、`method`、`question`
- 时间与地点：`solarDate`、`solarTime`、`trueSolarTime`、`location`、`longitude`
- 四柱与纳音：`yearGanZhi` 等四柱字段、纳音字段
- 卦体：`benGua`、`bianGua`、`movingYaoPositions`
- AI：`aiAnalysis`、`aiChatHistory`、`quickReplies`

### 5.2 八字：`BaziResult`

定义位置：`src/core/bazi-types.ts`

职责：

- 八字排盘的标准结果对象
- 被输入页、结果页、历史页、备份恢复、编辑回填共同依赖

主要字段组：

- 标识与时间：`id`、`createdAt`、`calculatedAt`、`timeMeta`
- 输入语义：`gender`、`longitude`
- 本命盘：`fourPillars`、`shiShen`、`cangGan`
- 运势链：`childLimit`、`daYun`、`liuNian`、`xiaoYun`
- 页面扩展：`subject`、`baseInfo`、`jieQiContext`、`pillarMatrix`
- 神煞：`shenSha`、`shenShaV2`
- 主题切换与结果页高级展示所需字段：`yuanMing`、`schoolOptionsResolved`

### 5.3 统一记录 envelope

定义位置：`src/db/record-types.ts`

当前记录模型统一为：

```ts
{
  engineType: 'liuyao' | 'bazi',
  result: PanResult | BaziResult,
  summary?: {
    title?: string;
    subtitle?: string;
    question?: string;
    method?: string;
  }
}
```

这次升级后，历史页、备份恢复、导入校验都按这个 envelope 工作，而不是各页面各存一套私有结构。

---

## 6. 端到端业务流

### 6.1 六爻

1. 页面采集输入
2. 调用 `divinateByTime / divinateByCoin / divinateByNumber / divinateManual`
3. 统一进入 `calculatePan()`
4. 生成 `PanResult`
5. `saveRecord({ engineType: 'liuyao', result })`
6. 跳转 `/result/[id]`

### 6.2 八字

1. 进入 `/bazi/input`
2. 采集出生时间、性别、地点、排盘口径、子时口径、参考时点
3. 调用 `calculateBazi()`
4. 结果先进入 `pending-result-cache`
5. 立即跳转 `/bazi/result/[id]`
6. 持久化异步进行：
   - 新建：`saveRecord`
   - 修改：`replaceRecord`

### 6.3 八字修改流

这是近期最大的产品级改动之一。

1. 用户在 `/bazi/result/[id]` 点击三点菜单里的“修改”
2. 跳转到 `/bazi/input?editId=...`
3. 输入页通过 `getRecord(editId)` 读取旧记录
4. 用 `buildBaziEditFormState()` 回填：
   - 姓名
   - 出生时间
   - 性别
   - 城市 / fallback 地点
   - 时间口径 / 子时口径 / 夏令时
5. 重新排盘后：
   - 若只是改名等不影响 id，覆盖同记录
   - 若输入变化导致新 id，使用 `replaceRecord(oldId, envelope)` 替换旧记录并继承收藏状态

### 6.4 八字结果页运行态

结果页不仅消费数据库，还消费内存态：

- `pending-result-cache`
  - 先渲染刚计算出的结果
  - 保存失败时显示可重试提示
  - 保存成功后再回到数据库态

这让“计算后还要等数据库写完才能看到页面”的体感等待明显下降。

---

## 7. 八字核心计算层：`src/core/`

### 7.1 `calculateBazi()` 的职责

定义位置：`src/core/bazi-calc.ts`

当前步骤大致为：

1. 归一化输入参数
2. 根据时间口径得到实际排盘时间
3. 调用 `tyme4ts` 取八字对象
4. 提取四柱、十神、藏干
5. 计算起运、大运、流年、流月、小运
6. 计算 `shenShaV2`
7. 从 `shenShaV2.siZhu` 派生旧版 `shenSha`
8. 构建 `pillarMatrix`、`baseInfo`、`jieQiContext`
9. 组装 `BaziResult`

### 7.2 神煞链路的近期大改动

定义位置：`src/core/bazi-shensha.ts`

近期核心变化：

- 不再由页面临时重复算动态神煞
- 在计算阶段构建 `ganZhiBuckets`
- `view-model` 直接消费预计算 bucket

这解决了两个问题：

- 结果页切换面板 / 流年 / 流月时不再重复跑同一批神煞规则
- `身宫 / 命宫 / 胎元` 这种额外列也能直接吃预计算神煞

### 7.3 人元司令与交运

当前独立模块：

- `renyuan-duty.ts`
  - 人元司令
  - 旺相休囚死五行带
- `jiaoyun-rule.ts`
  - 交运规则文案

最近这两块都已经从“页面拼字符串”转成了独立纯算法模块，结果页只负责展示，不再自算。

---

## 8. 八字结果页 view-model：`src/features/bazi/`

这是近期新增最多的业务层。

### 8.1 `view-model.ts`

当前职责：

- 把 `BaziResult` 映射成结果页可直接渲染的数据
- 维护专业细盘两套面板：
  - `fortuneColumns / fortuneRows`
  - `taimingColumns / taimingRows`
- 输出头区、信息带、轨道、神煞分层所需结构

### 8.2 `edit-helpers.ts`

职责：

- 从现有 `BaziResult` 反推输入页表单态
- 尝试按地点名或经度匹配 `CityInfo`
- 匹配失败时保留 fallback 文案

### 8.3 `pending-result-cache.ts`

职责：

- 暂存刚算出的 `BaziResult`
- 管理异步保存状态：`saving / saved / error`
- 结果页通过订阅这个缓存获得即时展示和失败重试能力

这是近期八字链路里最“产品化”的新增模块之一。

---

## 9. 持久化层：`src/db/`

### 9.1 `database.ts`

平台实现：

- Native：`expo-sqlite`
- Web：`localStorage`

对外 API：

- `saveRecord`
- `replaceRecord`
- `getAllRecords`
- `getRecord`
- `deleteRecord`
- `toggleFavorite`
- `exportAllRecords`
- `importRecords`

### 9.2 近期大改动

#### 多引擎统一 records

记录不再按六爻单独存一套，当前统一保存：

- `engine_type`
- `title`
- `subtitle`
- `full_result`

#### `replaceRecord()`

这是为八字“修改并覆盖旧记录”新增的能力：

- Native：事务内插入新记录、继承收藏、删除旧记录
- Web：重组 localStorage 数组并保留收藏状态

#### 备份恢复

设置页导出的备份已经是 `version: 2` 多引擎结构，并支持：

- 六爻旧备份兼容导入
- 混合记录导入
- 预览
- 冲突策略

---

## 10. 主题系统：`src/theme/`

### 10.1 全局主题状态

`ThemeContext.tsx` 负责：

- 从 `AsyncStorage` 读取 `app-theme`
- 对外暴露：
  - `theme`
  - `setTheme`
  - `Colors`

### 10.2 四套主题

当前主题：

- `dark`
- `green`
- `white`
- `purple`

### 10.3 近期主题架构升级

为了修复八字结果页“只有原矿绿明显变化，其它主题看起来像没变”的问题，主题系统近期做了两层升级：

1. 新增 `bazi-theme.ts`
   - 通过 `buildBaziThemeTokens()` 从基础主题派生八字语义色
2. 四套主题统一提供 `Colors.bazi.*`
   - `chrome*`
   - `hero*`
   - `action*`
   - `infoBand*`
   - `trackActive*`
   - `warning*`

这意味着：

- 八字结果页不再直接依赖一堆硬编码黑金色
- 主题切换后的差异由 token 层保证，而不是靠页面自己写死颜色

---

## 11. 组件层：`src/components/`

仍然是共用层，但近期和八字强相关的组件变化有：

- `LocationBar.tsx`
  - 增加 fallback 出生地展示
- `OverflowMenu.tsx`
  - 八字结果页现在把“修改”入口收进三点菜单
- `Icons.tsx`
  - 补充了八字结果页头区动作所需图标

其余主要职责保持不变：

- `AIChatModal`
- `ImportPreviewModal`
- `ConfirmModal`
- `CityPicker`
- `DateTimePicker`
- `HexagramDisplay`
- `GuaXiangBottomSheet`

---

## 12. 服务与工具层

### 12.1 `src/services/`

当前主要负责：

- AI 设置
- AI 对话
- 分享导出
- 地点持久化

其中：

- AI 仍然只服务六爻，不服务八字
- 设置页负责主题和备份，不负责 AI 参数编辑

### 12.2 `src/utils/history-filter.ts`

近期也已经升级为多引擎过滤：

- `engineType`
- 收藏
- 关键词
- 六爻 method

---

## 13. 测试覆盖现状

当前已经不是“只有几条六爻单测”的状态，最近增加了整套八字相关测试。

当前重点覆盖：

- 八字计算：`src/core/__tests__/bazi-calc.test.ts`
- 人元司令：`src/core/__tests__/renyuan-duty.test.ts`
- 交运规则：`src/core/__tests__/jiaoyun-rule.test.ts`
- 八字 view-model：`src/features/bazi/__tests__/view-model.test.ts`
- 八字编辑回填：`src/features/bazi/__tests__/edit-helpers.test.ts`
- pending cache：`src/features/bazi/__tests__/pending-result-cache.test.ts`
- 主题语义色：`src/theme/__tests__/bazi-theme.test.ts`
- 历史过滤、导入校验、设置、六爻变换等原有测试

说明：

- 当前自动化测试仍以纯逻辑和服务层为主
- 页面视觉和 Expo Router 导航仍主要靠手工验收

---

## 14. 当前相对旧版本的关键变化清单

如果只看“最近几轮做了什么”，最重要的是下面这些：

1. 新增完整八字产品链路
   - 输入页
   - 结果页
   - 历史回看
   - 编辑覆盖
2. 存储模型升级为多引擎统一 envelope
3. 八字结果页新增 pending cache，支持先显示后持久化
4. 八字结果页新增隐私模式和 `流年大运 / 胎命身` 面板切换
5. 主题系统新增 `Colors.bazi.*` 语义色和生成器
6. `tyme4ts` 升级到 `1.4.4`

---

## 15. 建议阅读顺序

如果要继续维护当前仓库，建议按这个顺序建立心智模型：

1. `package.json` 和 `app/_layout.tsx`
2. `app/(tabs)/index.tsx`、`app/divination/*.tsx`
3. `src/core/liuyao-calc.ts`
4. `src/core/bazi-calc.ts`
5. `src/features/bazi/view-model.ts`
6. `src/db/database.ts`
7. `app/result/[id].tsx` 与 `app/bazi/result/[id].tsx`
8. `src/theme/ThemeContext.tsx`、`src/theme/bazi-theme.ts`、四套主题色板

---

## 16. 文档维护说明

后续如果继续改这几个区域，记得同步更新本文档：

- 八字结果页交互结构
- `BaziResult` 字段
- `pending-result-cache`
- `replaceRecord`
- 主题 token 结构

否则文档最容易再次过时的就是这几块。
