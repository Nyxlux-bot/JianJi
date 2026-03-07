# 见机 (Jianji)

「见机」是一款基于 **Expo + React Native** 构建的跨平台易学排盘应用，当前已经形成两条完整产品链路：

- **六爻排盘**：时间、硬币、数字、手动四种起卦方式
- **八字排盘**：出生信息录入、真太阳时/平太阳时/本地钟表时排盘、专业细盘查看、历史回看与改错编辑

项目目标不是把算法拆成几个孤立 demo，而是把 **输入 -> 纯计算 -> 结果展示 -> 本地存储 -> 备份恢复 -> AI 辅助** 这条链路完整跑通，并且同时支撑六爻与八字两条产品线。

---

## 当前能力

### 六爻

- 四种起卦入口：时间、硬币、数字、手动
- 真太阳时、四柱、旬空、神煞、月将、月相等辅助信息
- 本卦、变卦、互卦、错卦、综卦一体化展示
- 结果页支持收藏、删除、Markdown 导出
- AI 对话式断卦，支持流式输出、快捷追问、聊天记录回写本地
- AI 会话支持导出 Markdown

### 八字

- 纯 TypeScript 八字计算核心，底层依赖 `tyme4ts@1.4.4`
- 支持三种时间口径：
  - 本地钟表时
  - 平太阳时
  - 真太阳时
- 支持晚子时次日 / 早子时当日切换
- 支持四柱、十神、藏干、大运、流年、流月、小运、神煞、人元司令
- 结果页支持：
  - `基本信息 / 基本排盘 / 专业细盘`
  - 隐私遮罩
  - `流年大运 / 胎命身` 切换面板
  - 从结果页直接进入“修改八字”并覆盖旧记录
  - 记录缺失时显示明确空态，不会卡在加载中
- AI 解盘支持分阶段工作流：
  - 基础定局
  - 前事核验
  - 未来五年
  - 后续专题追问
- 八字 AI 会话支持：
  - 阶段完成标记校验
  - 会话摘要 digest
  - 快捷追问
  - 会话导出
  - 失败后在弹窗内直接重试基础定局

### 历史、备份与主题

- 历史页已升级为 **多引擎统一记录模型**
  - `liuyao`
  - `bazi`
- 支持关键词搜索、收藏过滤、按引擎筛选
- 支持六爻 / 八字分舱筛选，并记住最近一次筛选状态
- 本地记录支持导出备份、导入恢复、冲突预览与统计
- 备份结构为 `version: 2` 多引擎 envelope，兼容旧六爻备份导入
- 全局支持四套主题：
  - 玄黑金
  - 原矿绿
  - 宣纸白
  - 紫檀香
- 八字结果页已补齐独立 `bazi` 语义色层，主题切换能同步影响头区、页签、信息带、专业细盘等区域

### 设置与 AI 接入

- 设置页当前负责：
  - 主题切换
  - AI 接口地址 / API Key / 模型名
  - 在线模型列表探测
  - 全量备份与恢复
- 系统提示词已内建在代码中，用户侧不再直接编辑 Prompt
- 读取设置时会自动清理历史遗留 Prompt 存储键

---

## 技术栈

- **框架**：Expo SDK 54、React Native 0.81、React 19、TypeScript 5.9
- **路由**：Expo Router
- **本地存储**：`expo-sqlite`（原生） + `localStorage`（Web）
- **设置存储**：`@react-native-async-storage/async-storage`
- **AI 流式通信**：`react-native-sse`
- **分享/导入导出**：`expo-file-system/legacy`、`expo-sharing`、`expo-document-picker`
- **图形与动画**：`react-native-svg`
- **八字底层库**：`tyme4ts`

---

## 当前架构要点

### 运行入口

项目当前唯一运行入口为：

- `package.json` -> `expo-router/entry`

传统 Expo 模板残留的 `App.tsx` / `index.ts` 已移除。

### 路由结构

主要页面如下：

- `app/(tabs)/index.tsx`
  - 首页，提供六爻与八字双入口
- `app/(tabs)/learn.tsx`
  - 学习页入口
- `app/divination/*.tsx`
  - 六爻四种起卦页
- `app/result/[id].tsx`
  - 六爻结果页
- `app/bazi/input.tsx`
  - 八字输入页 / 编辑页
- `app/bazi/result/[id].tsx`
  - 八字结果页
- `app/(tabs)/history.tsx`
  - 多引擎历史页
- `app/(tabs)/settings.tsx`
  - 主题、AI 配置、备份、恢复

### 核心分层

- `src/core/`
  - 纯计算层
  - 六爻 `PanResult`
  - 八字 `BaziResult`
- `src/features/bazi/`
  - 八字结果页 view-model、编辑辅助、pending cache
- `src/db/`
  - 统一 records 存储模型、导入导出、冲突策略
- `src/services/`
  - AI 工作流、设置、导出分享
- `src/theme/`
  - 全局主题上下文和四套色板
- `src/components/`
  - 通用组件与八字/六爻页面共用交互部件

### 记录模型

数据库和 Web 存储已经统一为多引擎 envelope：

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

八字编辑链路额外支持：

- `replaceRecord(oldId, envelope)` 覆盖旧记录
- `pending-result-cache` 先显示结果、再异步持久化

AI 会话记录当前也跟随结果对象一起持久化，消息除了 `role/content/hidden` 以外，还支持额外保存 `requestContent`，用于精确重试被系统改写过的请求。

---

## 八字新增大改动（本阶段重点）

### 1. 算法层

- 新增完整 `BaziResult` 类型体系
- `calculateBazi()` 负责：
  - 时间口径归一化
  - 四柱、十神、藏干、大运、流年、流月、小运
  - 人元司令、交运规则
  - 神煞 V2 分层与 `ganZhiBuckets`
- 结果页不再临时重复计算动态神煞，而是消费预计算 bucket

### 2. 结果页

- 专业细盘支持 `流年大运 / 胎命身` 切换
- 头区支持隐私遮罩
- 修改入口收进三点菜单
- `起运 / 交运 / 当前年龄 / 人元司令` 信息带与五行带随主题切换
- 记录缺失时进入显式空态页，而不是无穷加载

### 3. 编辑与性能

- `/bazi/input` 同时承担“新建”和“修改”
- 结果页可回到输入页改出生时间、地点、姓名、排盘口径
- 八字结果使用内存 pending cache，减少“计算完成后还要等落库”造成的体感等待

---

## 本地开发

### 安装依赖

```bash
npm install
```

### 启动开发环境

```bash
npx expo start --clear
```

### 类型检查

```bash
npx tsc --noEmit
```

### 单元测试

```bash
npx jest --runInBand
```

### Expo bundling 检查

```bash
npx expo export --platform android --output-dir /tmp/jianji-expo-export-check
```

---

## 文档

- 详细架构复盘： [PROJECT_ARCHITECTURE.md](./PROJECT_ARCHITECTURE.md)

---

## 备注

- 当前 README 以仓库现状为准，不再按“纯六爻工具”描述项目。
- 如果 README 与历史截图、旧描述或早期实现不一致，以源码实际行为为准。
