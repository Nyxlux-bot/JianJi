# 见机 Jianji

见机是一款基于 Expo + React Native 构建的跨平台易学排盘与典籍学习应用，当前覆盖六爻易数、梅花易数、奇门遁甲、八字命理、八字合盘与紫微斗数六条业务链路，配套「书阁」速查与古籍阅读，并统一提供历史记录、收藏筛选、备份恢复、检查更新与多协议 AI 辅助分析能力，支持在移动端与 Web 端完成完整的输入、排盘、回看与追问流程。

## 功能亮点

### 六爻易数

- 支持硬币排卦（三枚铜钱六次摇掷）与手动起卦两种方式（历史上由旧版时间 / 数字起卦保存的记录仍可正常回看与导入）
- 支持地点经度输入，用于真太阳时修正
- 结果页提供「卦盘」（本卦、变卦、动爻、用神高亮与旺衰提要、伏神、世应）与「细批」（四柱、旬空、月将、月相、神煞、卦辞、时令）双视图
- 支持互卦、错卦、综卦查阅，支持收藏、删除与 Markdown 导出

### 梅花易数

- 支持时间起卦（按农历年月日时）与数字起卦，输入页提供实时推演预览，并支持填写起卦主体、占问事项、近期事件与时间范围
- 结果页提供「卦象」（本/互/变三卦、体用生克、卦辞与动爻辞）与「断语」（卦气旺衰、规则断语、说卦传类象）双视图
- 支持 AI 辅助解读、收藏、删除与 Markdown 导出

### 奇门遁甲

- 支持转盘、飞盘（《奇门鸣法》）与星飞门转（透派坐山）三种盘式，支持时间起局与报数起局（1–9999），覆盖北京时间 1900–2100 年
- 转盘时家支持拆补、置闰、茅山三种定局法，八神支持勾陈/朱雀与白虎/玄武两套口径
- 结果页提供「九宫」「信息」「复盘」三视图，支持同记录切换年/月/日/时四盘、时辰前后步进预览与另存新盘、双击宫位放大详解、四盘对照、沿用此盘再起、事后复盘记录与单盘 Markdown 导出
- AI 支持四盘合读、盘据校验与【盘·宫】回盘定位链接

### 八字命理与合盘

- 支持公历、农历及四柱反查选择时间，提供本地钟表时、平太阳时、真太阳时三种排盘口径
- 支持出生地、夏令时、子时归属、自定义参考时点等输入项
- 结果页覆盖「命盘概览」与「专业细盘」两大视图，支持隐私模式遮罩、五行能量分布、干支关系详情页与规则自定义，以及 Markdown 导出
- 专业细盘支持流年大运 / 胎命身切换，以及底部运程坞对大运（或小运）、流年、流月、流日、流时的五层联动
- 八字合盘支持从已有八字记录任选两人（不分男女），覆盖婚恋、合伙、挚友、共事、亲属、手足 6 种关系类型与方向，提供双盘弧线图、互看十神、五行对比、多维详断、婚期/顺年与 AI 合盘详批

### 紫微斗数

- 支持公历 / 农历输入、出生地选择、夏令时开关与真太阳时校正
- 支持通行 / 中州算法、年界 / 运限界、晚子口径、天地人盘等配置，并可在结果页直接切换排盘设置
- 结果页提供十二宫盘面（宽屏附带侧栏）、双击宫位放大卡、宫位详解抽屉（三方四正、宫干飞化、十二神）、命盘信息面板，以及本命、大限、流年、流月、流日、流时运限时间轴
- 支持历史记录静态快照与按规则签名重建命盘，保留排盘算法、亮度基线与时间口径信息

### 书阁（速查与典籍）

- 内置 5 项常用速查：六十四卦（含单卦详页）、八卦类象、纳音、神煞、梅花体用诀
- 收录山、医、命、相、卜五卷共 41 部离线古籍（书目随包内置，正文按资源按需读取），支持搜索卦名/书名/篇名、三档字号、目录抽屉与本机阅读进度持久化

### 数据、主题与 AI

- 内置「太阴玄黑」与「太阳宣白」两套主题配色
- 原生端使用 SQLite 持久化，Web 端自动降级到 `localStorage`，统一支持六引擎历史记录、收藏筛选、关键词搜索、按引擎分舱过滤、备份导出与恢复导入
- AI 接口采用用户自配服务，支持 **OpenAI Responses**、**Anthropic Messages**、**Gemini Interactions** 三种协议，内置协议探测、参数自愈、思考档位与自动输出余量、后台分析任务与中断续写、分章节流式回复及会话 Markdown 导出
- 八字（含可选六亲初验）与紫微内置阶段式工作流：基础分析 -> 前事核验（支持逐条验证标记）-> 今年与未来五年 -> 后续专题追问；六爻与梅花支持解盘与追问；奇门支持四盘合读与引用追问；八字合盘支持单次详批与复制全文
- 设置页支持检查 GitHub Releases 更新与脱敏故障日志导出；出生地经纬度解析可选接入腾讯位置服务 Key

## 技术栈

- Expo SDK 58（当前版本 `1.8.3`）
- React Native 0.88.1
- React 19.3.0
- TypeScript 7.0.2
- Expo Router
- `expo-sqlite`
- `@react-native-async-storage/async-storage`
- `tyme4ts`（`1.5.6`）
- `iztro`（`2.6.5`）
- `@province-city-china/*`
- `react-native-sse`
- `react-native-svg`
- `react-native-reanimated`、`react-native-worklets`、`react-native-gesture-handler`
- `@formatjs/intl-pluralrules`
- 本地原生模块 `modules/liquid-glass`（底栏液态玻璃容器）

## 仓库结构

```text
app/                         Expo Router 页面与路由
modules/liquid-glass/        本地原生模块（底栏液态玻璃效果）
scripts/                     质量守门、构建、发布与资料生成脚本
src/ai/                      Markdown 技能提示词、输出契约与章节排版解析
src/components/              通用组件、结果页外框与 AI / 弹层交互容器
src/core/                    六爻、八字、历法、神煞与真太阳时纯计算核心
src/features/home/           首页术数卡片与主题配色配置
src/features/bazi/           八字结果页运行态、运程坞、编辑辅助与八字合盘
src/features/ziwei/          紫微排盘适配层、棋盘/时间轴/详盘视图、记录模型与亮度基线
src/features/meihua/         梅花易数排盘引擎、规则断语、类象与 AI 序列化
src/features/qimen/          奇门遁甲三盘式四盘引擎、对照、复盘与 AI 盘据校验
src/db/                      六引擎统一记录 envelope、SQLite/Web 存储与导入校验
src/services/                多协议 AI 客户端、后台分析任务、设置、分享、更新检查、诊断日志与地理编码
src/hooks/                   页面级状态 Hook
src/theme/                   双主题（太阴玄黑 / 太阳宣白）、语义色 token 与动效常量
src/utils/                   历史筛选等轻量工具
src/polyfills/               运行时 polyfill
src/data/                    卦象、卦辞与书阁离线古籍（classics/）
```

## 快速开始

### 环境要求

- Node.js 22.13+（22 系列）、24.3+（24 系列）或 26+；不支持奇数版本
- npm 9+

### 安装依赖

```bash
npm install
```

### 启动项目

```bash
npm run start
```

`npm run start` 默认使用 Expo Go，并生成直接打开 Expo Go 的二维码，不经过应用选择网页。Android 请安装支持 SDK 58 的 Expo Go；需要清理缓存时运行 `npm run start -- --clear`。自定义开发包使用 `npx expo start --dev-client`；设置 `APP_VARIANT=development` 可通过 `app.config.js` 生成可与正式版并存的开发版包名（`com.jianji.app.dev`）。

常用命令：

```bash
npm run android
npm run ios
npm run web
```

### 代码检查与质量守门

```bash
npm run typecheck
npm run check:motion
node scripts/check-page-background.cjs
```

- CI（`.github/workflows/check.yml`）会在推送到 `main` 和发起 PR 时自动运行类型检查、动效合规检查与无测试文件守门。

### Git 防误传

首次克隆后执行：

```bash
npm run setup:hooks
```

仓库会在提交前（`.githooks/pre-commit`）和推送前（`.githooks/pre-push`）阻止 `*.test.*`、`*.spec.*`、`__tests__`、`__localtests__` 以及常见测试配置文件进入版本库，提交前同时执行 `scripts/check-motion.cjs`。临时本地实验建议放在仓库外，或放在未跟踪目录中。

### 版本发布

```bash
npm run release:patch
npm run release:minor
npm run release:major
npm run release:beta
```

发布脚本会同步更新 `package.json`、`app.json` 版本号与 Android `versionCode` 并创建标签；推送标签后由 GitHub Actions（`release.yml` / `release-beta.yml` -> `android-release.yml`）直接编译并签名 Android APK 发布到 GitHub Releases。

## 数据与兼容

- 六爻、八字、紫微、八字合盘、梅花、奇门六引擎记录统一使用同一套 record envelope 存储
- 备份文件当前版本为 `version: 4`，包含应用设置、干支关系规则设置与记录列表
- 导出备份默认不包含 API Key 与腾讯位置服务 Key
- Web 端会自动将旧版 `liuyao_records` 迁移到 `divination_records_v2`
- 旧六爻（含旧时间/数字起卦）、旧八字、旧合盘（缺省关系按婚恋读取）、旧奇门（缺省盘式按时家转盘读取）记录会在读取、导出和导入时自动完成兼容处理
- 紫微导入记录当前仅接受中国标准时区 `UTC+8` 语义，导入时会清洗非法 AI 会话结构
- 根布局默认注入 `Intl.PluralRules` polyfill，保证 `iztro` 与相关格式化逻辑在多端一致运行

### 紫微亮度表

本地亮度基线（`version: 2`）继续作为主数据源。三套本地流派表（`common_quanshu`、`zhongzhou`、`lingdonglai`）每套包含 59 个星曜行，其中 46 个星曜有完整 12 宫有效值，共覆盖 630 个有效宫位值；其余留空单元格为星曜不会落入的地支或尚无公开来源表。本地流派表与 `iztro 2.6.5` 原始结果共同参与最终亮度标签解析，具体字段与覆盖说明见 [src/features/ziwei/brightness/README.md](./src/features/ziwei/brightness/README.md)。

## 文档

- 架构文档：[PROJECT_ARCHITECTURE.md](./PROJECT_ARCHITECTURE.md)
- 奇门排盘说明：[src/features/qimen/README.md](./src/features/qimen/README.md)
- 紫微亮度基线说明：[src/features/ziwei/brightness/README.md](./src/features/ziwei/brightness/README.md)

## 开发说明

- 当前运行入口为 `expo-router/entry`
- 应用显示名与 Expo `slug` 为 `见机 / jianji`
- 原生数据库文件名与 npm 包名沿用历史名称 `liuyao.db` 与 `liuyao-app`
- 首页卡片覆盖六爻、梅花易数、奇门遁甲、八字命理（含合盘入口）与紫微斗数五大术数分类
- 紫微链路基于 `iztro` 计算，并结合本地亮度基线、规则签名与静态快照机制保证历史回放一致性

## 致谢

- `tyme4ts`：历法与时间计算能力基础库，[6tail/tyme4ts](https://github.com/6tail/tyme4ts)
- `IZTRO`：紫微斗数排盘与运限能力基础库，[SylarLong/iztro](https://github.com/SylarLong/iztro)
