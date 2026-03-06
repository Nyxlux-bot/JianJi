# 见机 (Jianji) 项目架构文档

本文档以当前仓库源码为准，覆盖运行入口、目录职责、核心数据模型、端到端数据流、平台适配、AI 子系统、测试覆盖和仓库级工程配置。若本文件与 `README.md`、旧版架构文档或 Expo 模板提示存在差异，以源码实际实现为准。

## 1. 项目定位与技术基线

「见机」是一个基于 Expo 的跨平台六爻排盘应用，主要目标是把本地排盘、卦象学习、历史留存、备份恢复和 AI 辅助分析整合到同一套移动端体验中。

- 框架层：Expo SDK 54、React Native 0.81、React 19、TypeScript 5.9
- 路由层：Expo Router（文件系统路由）
- 本地结构化存储：`expo-sqlite`
- Web 端降级存储：`localStorage`
- 配置存储：`@react-native-async-storage/async-storage`
- AI 通信：OpenAI 兼容 HTTP 接口 + `react-native-sse`
- 分享/迁移：`expo-file-system/legacy`、`expo-sharing`、`expo-document-picker`
- 图形与视觉：`react-native-svg`、自定义主题系统

## 2. 实际运行入口

### 2.1 运行时入口链路

当前应用的运行入口为：

1. `package.json`
   - `"main": "expo-router/entry"`
2. `app/_layout.tsx`
   - 根布局，负责挂载 `ThemeProvider`、`SafeAreaProvider`、`Stack`、`CustomAlertProvider`
   - 在启动阶段调用 `SplashScreen.preventAutoHideAsync()` 和 `hideAsync()`
3. `app/(tabs)/_layout.tsx`
   - 主标签页容器，定义首页、学习、历史、设置四个顶级页面

### 2.2 入口收敛状态

仓库已移除传统 Expo 模板残留的 `index.ts` 和 `App.tsx`。当前入口只有一条：

- `package.json` -> `expo-router/entry`

后续如果继续维护本项目，应默认从 `app/_layout.tsx` 和 `app/(tabs)/_layout.tsx` 理解启动链路，而不是再引入独立的 `App.tsx` 入口。

## 3. 架构总览

项目可以拆成 6 层：

1. 路由与页面层：`app/`
2. 可复用 UI 组件层：`src/components/`
3. 纯计算核心层：`src/core/`
4. 持久化与导入导出层：`src/db/`
5. AI / 设置 / 分享 / 地点服务层：`src/services/`
6. 主题、Hook、工具与静态字典层：`src/theme/`、`src/hooks/`、`src/utils/`、`src/data/`

核心业务对象是 `PanResult`。页面层负责采集输入，核心层负责生成 `PanResult`，数据库层负责保存与恢复，结果页及 AI 模块围绕同一份 `PanResult` 工作。

## 4. 关键数据模型：`PanResult`

`src/core/liuyao-calc.ts` 中定义的 `PanResult` 是全项目最重要的数据结构。它贯穿起卦、结果页、历史页、AI 对话、分享和备份恢复。

按职责可分为以下几组字段：

- 标识与来源
  - `id`
  - `createdAt`
  - `method`
  - `question`
- AI 相关
  - `aiAnalysis`
  - `aiChatHistory`
  - `quickReplies`
- 时间与地点
  - `solarDate`
  - `solarTime`
  - `lunarInfo`
  - `jieqi`
  - `trueSolarTime`
  - `location`
  - `longitude`
- 四柱与纳音
  - `yearGanZhi` / `monthGanZhi` / `dayGanZhi` / `hourGanZhi`
  - `yearNaYin` / `monthNaYin` / `dayNaYin` / `hourNaYin`
- 辅助象数信息
  - `xunKong`
  - `shenSha`
  - `monthGeneral`
  - `moonPhase`
- 卦体信息
  - `benGua`
  - `benGuaYao`
  - `bianGua`
  - `bianGuaYao`
  - `movingYaoPositions`
  - `rawYaoValues`

`YaoDetail` 则是每一爻的展开结构，包含阴阳、动静、纳甲、五行、六亲、六神、世应、变爻信息和伏神信息。

## 5. 端到端业务流

### 5.1 起卦流

1. 用户从首页进入某种起卦方式。
2. 页面采集输入：
   - 时间起卦：日期时间、可选地点、可选问题
   - 硬币起卦：6 次抛掷结果、可选地点、可选问题
   - 数字起卦：两个正整数、可选地点、可选问题
   - 手动起卦：6 个爻值、可选地点、可选问题
3. 页面调用 `src/core/liuyao-calc.ts` 中对应函数：
   - `divinateByTime`
   - `divinateByCoin`
   - `divinateByNumber`
   - `divinateManual`
4. 核心层统一落到 `calculatePan()` 生成 `PanResult`。
5. 页面调用 `saveRecord(result)` 持久化。
6. 页面通过 `router.push('/result/[id]')` 跳转到结果页。

### 5.2 结果查看流

1. `app/result/[id].tsx` 读取路由参数 `id`
2. 同时调用：
   - `getRecord(id)` 读取完整结果
   - `getAllRecords()` 读取摘要列表以恢复收藏状态
   - `isAIConfigured()` 检查 AI 是否已配置
3. 结果页将 `PanResult` 分发给：
   - `FourPillars`
   - `HexagramDisplay`
   - `GuaXiangBottomSheet`
   - `AIChatModal`
4. 用户可继续执行收藏、删除、导出分享、查看互错综、打开 AI 对话。

### 5.3 AI 分析流

1. `AIChatModal` 打开后读取 `result.aiChatHistory` 或旧字段 `aiAnalysis`。
2. 若当前盘没有历史消息，会自动发起首轮“全面分析此卦”。
3. `buildSystemMessage(result)` 将排盘数据序列化成大段系统提示词。
4. `analyzeWithAIChatStream()` 用 SSE 流式接收增量内容。
5. UI 逐块更新助手消息气泡。
6. 流式结束后：
   - 将 `aiChatHistory` 回写到 `PanResult`
   - 调用 `saveRecord(updatedResult)` 持久化
   - 若原始盘有 `question`，异步调用 `generateQuickReplies()`
7. 快捷追问和聊天记录会继续回写到同一条记录。

### 5.4 备份恢复流

1. 设置页通过 `exportAllRecords()` 导出全部历史。
2. 同时把 `AISettings` 一并写入备份，但会主动清空 `apiKey`。
3. 恢复时先读取 JSON，再用 `validateImportRecords()` 校验结构。
4. 导入前通过 `ImportPreviewModal` 让用户：
   - 勾选导入记录
   - 选择冲突策略：跳过重复 / 覆盖重复
5. 最终调用 `importRecords(records, { mode: 'merge', conflictPolicy })`。
6. 备份中的设置通过 `normalizeImportedSettings()` 归一化后恢复，若备份缺少 API Key，则保留当前本机已有 Key。

## 6. 路由层：`app/`

Expo Router 中带括号的目录仅用于分组，不出现在最终 URL 中。

| 文件 | 实际路由 | 职责 |
| --- | --- | --- |
| `app/_layout.tsx` | 根布局 | 根 Provider、全局 `Stack`、启动淡入、状态栏和自定义弹窗挂载 |
| `app/(tabs)/_layout.tsx` | 标签页容器 | 自定义底部 Tab Bar，定义首页/学习/历史/设置四个主入口 |
| `app/(tabs)/index.tsx` | `/` | 首页，提供四种起卦入口，并隐藏 AI 配置彩蛋弹窗 |
| `app/(tabs)/learn.tsx` | `/learn` | 学习页入口，目前只承载“六十四卦总览”入口 |
| `app/learn/hexagrams.tsx` | `/learn/hexagrams` | 六十四卦列表与详情 Modal |
| `app/(tabs)/history.tsx` | `/history` | 历史记录、搜索、多条件筛选、收藏、删除 |
| `app/(tabs)/settings.tsx` | `/settings` | 主题切换、全量备份、恢复预览与导入 |
| `app/divination/time.tsx` | `/divination/time` | 时间起卦页，支持地点和自定义时间 |
| `app/divination/coin.tsx` | `/divination/coin` | 铜钱起卦页，负责 6 次抛掷、结果确认与可靠保存 |
| `app/divination/number.tsx` | `/divination/number` | 两数起卦页 |
| `app/divination/manual.tsx` | `/divination/manual` | 六爻手动录入页 |
| `app/result/[id].tsx` | `/result/[id]` | 单次排盘结果页，结果展示、AI、分享、删除、收藏的中心页面 |

### 6.1 首页的特殊点

`app/(tabs)/index.tsx` 不是单纯导航页，它还承担两个隐藏职责：

- 通过连续点击八卦图 7 次打开 AI 配置弹窗
- 直接在首页内完成 AI 接口地址、API Key、模型名、系统提示词的编辑和保存

这意味着 AI 配置并不在设置页，而是隐藏在首页。

### 6.2 设置页的实际职责

`app/(tabs)/settings.tsx` 当前不提供 AI 参数编辑，只负责：

- 主题切换
- 全量备份
- 从 JSON 备份恢复
- 导入前预览与冲突策略选择

## 7. 组件层：`src/components/`

### 7.1 核心业务组件

- `AIChatModal.tsx`
  - AI 多轮对话容器
  - 管理消息 hydration、流式增量更新、快捷追问、复制、重试、导出
- `GuaXiangBottomSheet.tsx`
  - 结果页半屏抽屉
  - 基于本卦数组计算本卦、互卦、错卦、综卦并展示详解
- `HexagramDisplay.tsx`
  - 卦象主展示组件
  - 展示本卦/变卦六爻结构，并提供卡片翻转查看变卦
- `FourPillars.tsx`
  - 展示四柱、纳音、旬空、月将、月相、神煞
- `HexagramDetailView.tsx`
  - 统一的卦象辞典详情展示器，读取 `iching` / `tuan` / `xiang` / `wen`
- `ImportPreviewModal.tsx`
  - 导入前预览和冲突策略选择

### 7.2 起卦辅助组件

- `LocationBar.tsx`
  - 起卦页顶部地点条
- `CityPicker.tsx`
  - 省份/城市二级选择器，支持搜索和清除
- `DateTimePicker.tsx`
  - 自定义日期时间选择器
  - 支持公历、农历、四柱反查三种模式
- `ScrollPicker.tsx`
  - `DateTimePicker` 的滚轮基础控件

### 7.3 交互与基础设施组件

- `CustomAlertProvider.tsx`
  - 通过 `DeviceEventEmitter` 实现全局自定义弹窗
- `ConfirmModal.tsx`
  - 通用确认框
- `OverflowMenu.tsx`
  - 结果页和 AI 对话页使用的悬浮菜单
- `StatusBarDecor.tsx`
  - 顶部安全区背景填充
- `Icons.tsx`
  - 全局 SVG 图标集合
- `YongleCoin.tsx`
  - 铜钱正反面位图渲染组件

### 7.4 纯辅助文件

- `coin-motion.ts`
  - 把三枚硬币正反结果映射为 `YaoValue`
- `ai-chat-actions.ts`
  - 提供“复制最后一条回复”和“重试上一问”的纯函数逻辑

## 8. 核心计算层：`src/core/`

这一层不依赖 React 组件，是项目的业务内核。

- `liuyao-calc.ts`
  - 项目计算总入口
  - 统一生成 `PanResult`
  - 封装四种起卦方式
- `liuyao-data.ts`
  - 六爻基础字典
  - 包含八卦、六十四卦、纳甲、六亲、六神、五行映射
- `lunar.ts`
  - 公农历转换、节气计算、四柱干支、纳音、四柱反查
- `true-solar-time.ts`
  - 真太阳时修正与展示格式化
- `time-signs.ts`
  - 月将和月相计算
- `shen-sha.ts`
  - 神煞推导
- `xun-kong.ts`
  - 旬空推导
- `hexagramTransform.ts`
  - 本卦到互卦、错卦、综卦的纯函数变换
- `city-data.ts`
  - 中国省市及经度数据，用于真太阳时校正

### 8.1 `calculatePan()` 做了什么

`calculatePan()` 是核心中的核心，主要步骤如下：

1. 根据经度决定是否使用真太阳时修正后的时间
2. 计算农历、节气、四柱、纳音
3. 从 6 个爻值推导本卦、动爻、变卦
4. 为每一爻计算纳甲、五行、六亲、六神、世应
5. 必要时补伏神
6. 计算旬空、神煞、月将、月相
7. 组装最终 `PanResult`

### 8.2 四种起卦方式的实际实现

- 时间起卦：年支数 + 月 + 日 + 时支数取模
- 数字起卦：两个数字分别定上下卦，和数定动爻
- 硬币起卦：页面先得到 6 个 `YaoValue`，核心层只负责统一计算
- 手动起卦：页面传入 6 个手工选择的 `YaoValue`

## 9. 持久化层：`src/db/`

### 9.1 `database.ts`

这是统一存储门面，按平台分两套实现：

- Native：`expo-sqlite`
- Web：`localStorage`

对外暴露的 API 包括：

- `saveRecord`
- `getAllRecords`
- `getRecord`
- `deleteRecord`
- `toggleFavorite`
- `exportAllRecords`
- `importRecords`

### 9.2 Native 存储特征

- SQLite 表名：`records`
- 主键：`id`
- 完整结果以 `full_result` JSON 字符串存储
- `save()` 使用 `INSERT OR REPLACE`
- 保存时会尽量保留原有收藏状态
- `exportAll()` 分页拉取，避免一次性加载全部 JSON
- `importAll()` 使用事务，支持 `merge` / `replace`

### 9.3 Web 存储特征

- 用 `localStorage` 的 `liuyao_records` 键保存全部记录数组
- 结构是摘要字段 + `fullResult`
- 逻辑上与 native 端保持一致，但没有 SQLite 事务能力

### 9.4 导入恢复辅助文件

- `import-validation.ts`
  - 校验备份记录是否具备最小合法结构
- `import-strategy.ts`
  - 负责在 `merge` / `replace` 与 `skip` / `replace` 之间决定插入、更新还是跳过

## 10. 服务层：`src/services/`

### 10.1 `ai.ts`

AI 服务是整个应用最复杂的服务文件，负责：

- 将 `PanResult` 序列化为 AI 可读文本
- 拼接系统提示词
- 基于 OpenAI 兼容协议发起流式聊天
- 在主对话之外生成快捷追问

关键函数：

- `buildSystemMessage(result)`
- `analyzeWithAIChatStream(messages, onChunk, signal?)`
- `generateQuickReplies(result, chatHistory)`

`analyzeWithAIChatStream()` 的实现特征：

- 使用 `react-native-sse` 的 `EventSource`
- 通过 POST 发请求
- 监听 `[DONE]` 结束标记
- 30 秒无数据则判定为超时
- 支持外部 `AbortSignal`

### 10.2 `settings.ts`

负责 AI 相关设置的持久化：

- `apiUrl`
- `apiKey`
- `model`
- `systemPrompt`
- `promptVersion`
- `promptIsCustom`
- `aiSettingsUnlocked`

实现特点：

- 通过 `CURRENT_PROMPT_VERSION` 对默认提示词做版本升级
- 如果用户没有自定义 Prompt，则可以自动升级到最新默认 Prompt
- `saveSettings()` 只保存设置，不负责 UI
- `isAIConfigured()` 仅检查 `apiKey` 和 `apiUrl`

注意：`aiSettingsUnlocked` 当前会被保存和恢复，但并没有作为首页弹窗显示的真正条件判断，首页实际仍以 7 连击手势作为打开方式。

### 10.3 其他服务

- `default-prompts.ts`
  - 默认系统提示词与当前 Prompt 版本号
- `share.ts`
  - 导出结果 Markdown、导出 AI 会话 Markdown
- `location.ts`
  - 保存/读取用户选中的城市
  - 当前实现是 `AsyncStorage` 持久化，不是 GPS 或系统定位服务

## 11. 主题、Hook、工具与静态数据

### 11.1 `src/theme/`

- `ThemeContext.tsx`
  - 主题上下文提供者
  - 负责从 `AsyncStorage` 读取当前主题并对外暴露 `theme`、`setTheme`、`Colors`
- `colors.ts`
  - 默认深色主题及通用设计 token
- `colors-green.ts`
  - 绿色主题
- `colors-white.ts`
  - 白色主题
- `colors-purple.ts`
  - 紫色主题

### 11.2 `src/hooks/`

- `useLocation.ts`
  - 在多个起卦页复用
  - 负责读取已选城市、控制城市选择器开关、持久化城市

### 11.3 `src/utils/`

- `history-filter.ts`
  - 历史页的关键词、收藏、方法多选过滤逻辑

### 11.4 `src/data/`

- `iching.json`
  - 六十四卦基础字典
- `ichuan/tuan.json`
  - 彖传字典
- `ichuan/xiang.json`
  - 象传字典
- `ichuan/wen.json`
  - 文言字典

这些静态数据既被学习页使用，也被卦象底部抽屉和 AI 文本拼接间接依赖。

## 12. 平台适配与配置文件

### 12.1 应用配置

- `app.json`
  - 应用名、包名、图标、启动图、`expo-router` / `expo-sqlite` 插件、OTA 更新配置
  - `newArchEnabled: true`
- `eas.json`
  - `development` / `preview` / `production` 构建配置

### 12.2 构建与测试配置

- `babel.config.js`
  - Expo Babel 预设
  - 启用 `react-native-reanimated/plugin`
- `jest.config.js`
  - `ts-jest`
  - 测试根目录为 `src`
- `tsconfig.json`
  - 基于 `expo/tsconfig.base`
  - 开启 `strict`

### 12.3 脚本

- `scripts/theme-refactor.js`
  - 基于 `ts-morph` 的一次性重构脚本
  - 用于把组件中直接依赖 `Colors` 的写法改为 `useTheme()`

## 13. 测试覆盖

当前仓库有 8 个测试文件，集中覆盖纯逻辑层：

- `src/services/__tests__/settings.test.ts`
  - Prompt 版本升级、旧数据兼容、设置保存异常
- `src/db/__tests__/database-import.test.ts`
  - 导入冲突策略统计
- `src/db/__tests__/import-validation.test.ts`
  - 备份数据结构校验
- `src/core/__tests__/hexagramTransform.test.ts`
  - 互卦、错卦、综卦计算
- `src/core/__tests__/time-signs.test.ts`
  - 月将与月相推导
- `src/components/__tests__/ai-chat-actions.test.ts`
  - 复制最后回复、重试上一问的纯函数
- `src/components/__tests__/coin-motion.test.ts`
  - 铜钱结果到爻值映射
- `src/utils/__tests__/history-filter.test.ts`
  - 历史过滤逻辑

目前测试主要集中在纯函数和服务逻辑，页面级交互、Expo Router 导航、SQLite 真机行为和 AI 流式 UI 没有自动化集成测试。

## 14. 当前源码相对旧文档的关键校正

这是本次重新梳理后确认的几个关键事实：

- 当前运行入口已经收敛到 `expo-router/entry`
- 首页 `app/(tabs)/index.tsx` 才是 AI 配置入口，设置页不是
- `src/services/location.ts` 只是城市选择持久化，不是 GPS 定位服务
- 项目虽然安装了 `react-native-reanimated`，但当前首页 Tab 动画和铜钱动画主实现都使用的是 React Native `Animated`
- `app/learn/hexagrams.tsx` 自己实现了一套卦象详情 Modal，而 `GuaXiangBottomSheet.tsx` 则复用了 `HexagramDetailView.tsx`；这两处存在展示逻辑重复
- 历史残留的 `App.tsx` 与 `index.ts` 已删除，避免继续误导入口认知

## 15. 建议的阅读顺序

如果要继续维护这个项目，建议按下面顺序建立心智模型：

1. `package.json` 和 `app/_layout.tsx`
2. `app/(tabs)/index.tsx`、`app/divination/*.tsx`
3. `src/core/liuyao-calc.ts`
4. `src/db/database.ts`
5. `app/result/[id].tsx`
6. `src/components/AIChatModal.tsx` 与 `src/services/ai.ts`
7. `app/(tabs)/settings.tsx`、`src/db/import-validation.ts`、`src/components/ImportPreviewModal.tsx`
8. `src/theme/ThemeContext.tsx` 与四套色板

按照这个顺序阅读，能够最快理解应用是如何从输入构建 `PanResult`，再围绕它完成展示、对话、备份和分享的。
