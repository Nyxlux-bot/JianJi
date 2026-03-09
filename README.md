# 见机 (Jianji)

「见机」是一款基于 Expo + React Native 的跨平台易学排盘应用，当前已经是一个双引擎产品，而不是单一算法 Demo。

它覆盖两条完整链路：

- 六爻排盘
- 八字排盘

实际能力已经贯通到：

`输入 -> 纯计算 -> 结果展示 -> 本地存储 -> 收藏/删除 -> 备份恢复 -> AI 辅助`

## 项目现状

- 应用显示名与 Expo `slug` 为 `见机 / jianji`
- 当前运行入口是 `expo-router/entry`
- 原生端使用 `expo-sqlite`，Web 端降级到 `localStorage`
- AI 依赖用户自行配置的 OpenAI 兼容接口
- 仓库内部仍保留历史命名：
  - `package.json.name = liuyao-app`
  - 原生 SQLite 文件名为 `liuyao.db`

上面两个历史命名不影响当前产品行为，但开发排查时需要知道。

## 功能概览

### 六爻

- 四种起卦方式：
  - 时间起卦
  - 硬币起卦
  - 数字起卦
  - 手动起卦
- 可选地点经度，用于真太阳时修正
- 结果页展示：
  - 本卦、变卦
  - 动爻详情
  - 四柱、旬空、神煞、月将、月相
  - 互卦 / 错卦 / 综卦查阅抽屉
- 支持收藏、删除、Markdown 导出
- AI 对话支持：
  - 流式回复
  - 快捷追问
  - 会话回写本地
  - 对话 Markdown 导出

### 八字

- 纯 TypeScript 计算核心，底层依赖 `tyme4ts@1.4.4`
- 输入页支持：
  - 姓名
  - 出生时间
  - 性别
  - 出生地
  - 本地钟表时 / 平太阳时 / 真太阳时
  - 夏令时开关
  - 晚子时次日 / 早子时当日
  - 自定义参考时点
- 结果页分为：
  - 基本信息
  - 基本排盘
  - 专业细盘
- 专业细盘支持：
  - `流年大运 / 胎命身` 双面板
  - 大运 / 流年 / 流月 / 小运联动
  - 隐私遮罩
  - 当前运势高亮
- 支持从结果页进入“修改八字”，并覆盖旧记录
- 计算后先走内存 pending cache，再异步落库，减少等待体感
- AI 解盘采用阶段式工作流：
  - 基础定局
  - 前事核验
  - 未来五年
  - 后续专题追问
- 八字 AI 还支持：
  - 阶段完成标记校验
  - 会话摘要 digest
  - 快捷追问
  - 失败重试
  - 对话 Markdown 导出

### 学习、历史与设置

- 学习页当前提供本地六十四卦资料库
  - 卦辞
  - 彖传
  - 大象
  - 文言
  - 爻辞与小象
- 历史页已经升级为多引擎统一记录视图
  - 六爻 / 八字分舱
  - 收藏筛选
  - 关键词搜索
  - 最近一次引擎与分类筛选状态持久化
- 设置页负责：
  - 四套主题切换
  - AI 接口地址 / API Key / 模型名
  - 在线模型列表探测
  - 全量备份导出
  - 备份恢复预览

## 技术实现

- 框架：Expo SDK 54、React Native 0.81、React 19、TypeScript 5.9
- 路由：Expo Router
- 原生存储：`expo-sqlite`
- Web 存储：`localStorage`
- 设置与主题：`@react-native-async-storage/async-storage`
- AI 流式通信：`react-native-sse`
- 导入导出：`expo-file-system/legacy`、`expo-sharing`、`expo-document-picker`
- 图形与动画：`react-native-svg`、React Native `Animated`
- 八字核心：`tyme4ts`
- 静态数据：
  - `src/data/iching.json`
  - `src/data/ichuan/*.json`
  - `src/core/city-data.ts`

补充说明：

- `app.json` 中 `userInterfaceStyle` 仍为 `dark`，但应用内部真正显示主题由 `ThemeContext` 管理
- `metro.config.js` 额外注册了 `wasm` 资源扩展，供 Web 端 SQLite 兼容使用
- `eas.json` 已配置 `development / preview / production` 三套 EAS profile

## 数据与备份

### 统一记录模型

六爻与八字统一落为同一种 envelope：

```ts
{
  engineType: 'liuyao' | 'bazi',
  result: PanResult | BaziResult,
  summary?: {
    method?: string;
    question?: string;
    title?: string;
    subtitle?: string;
  }
}
```

### 备份特点

- 当前备份格式为 `version: 2`
- 同一份备份里可以混合六爻与八字记录
- 导入前会先做结构校验与冲突预览
- 可逐条勾选导入记录
- 重复记录支持：
  - 跳过重复
  - 覆盖重复
- 导出备份默认不包含 API Key
- 恢复设置时只会用非空字段覆盖当前配置，因此不会因为备份未带 API Key 而清空本机已有 Key

### 兼容性

- Web 端会自动迁移旧版 `liuyao_records` 到 `divination_records_v2`
- 原生 SQLite 会在启动时补齐 `engine_type / title / subtitle` 等新字段
- 旧八字记录会在读取时通过 `normalizeBaziResultV2()` 做兼容补全
- 读取设置时会自动清理历史遗留 Prompt 存储键

## 目录速览

- `app/`
  - 路由与页面
- `src/core/`
  - 六爻 / 八字纯计算核心
- `src/features/bazi/`
  - 八字结果页 view-model、编辑辅助、pending cache
- `src/db/`
  - 多引擎记录模型、导入导出、冲突策略
- `src/services/`
  - AI、设置、分享、地点持久化
- `src/components/`
  - 通用 UI 组件与交互容器
- `src/theme/`
  - 全局主题与八字语义色 token
- `src/hooks/` / `src/utils/`
  - 页面复用逻辑与筛选工具

更详细的分层说明见 [`PROJECT_ARCHITECTURE.md`](./PROJECT_ARCHITECTURE.md)。

## 本地开发

### 环境建议

- Node.js 18+
- npm 9+

### 安装依赖

```bash
npm install
```

### 启动

```bash
npm run start
```

常用变体：

```bash
npm run android
npm run ios
npm run web
```

### 类型检查

项目当前没有单独的 npm script，直接运行：

```bash
npx tsc --noEmit
```

### Jest

仓库已经配置 `jest.config.js`，但当前没有提交自动化测试文件。

如果只是验证 Jest 配置是否可执行，建议使用：

```bash
npx jest --runInBand --passWithNoTests
```

### Expo 导出检查

```bash
npx expo export --platform android --output-dir /tmp/jianji-expo-export-check
```

## 当前实现边界

- AI 没有自带后端，必须配置外部接口后才能工作
- 八字 pending cache 只存在于内存中，用来提升“计算后立即可见”的体验，不是长期存储
- 六爻结果页目前没有像八字结果页那样的显式“记录缺失空态页”
- 学习页当前只覆盖六十四卦资料库，尚未扩展到八字知识内容
- 自动化测试基线尚未建立，当前质量更多依赖 TypeScript、运行时校验与手测

## 文档

- 项目总览：当前文件 `README.md`
- 架构文档：[`PROJECT_ARCHITECTURE.md`](./PROJECT_ARCHITECTURE.md)

若 README、旧截图、历史说明或早期讨论与源码不一致，以当前仓库代码为准。
