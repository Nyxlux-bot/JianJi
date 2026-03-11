# 见机 Jianji

见机是一款基于 Expo + React Native 构建的跨平台易学排盘应用，集成六爻起卦、八字排盘、历史记录、备份恢复与 AI 辅助分析，支持在移动端与 Web 端完成完整的排盘与回看流程。

## 产品预览

<table>
  <tr>
    <td align="center">
      <img src="./docs/images/home.png" alt="见机首页" width="260" />
    </td>
    <td align="center">
      <img src="./docs/images/coin.png" alt="六爻硬币排卦" width="260" />
    </td>
    <td align="center">
      <img src="./docs/images/bazi.png" alt="八字基本排盘" width="260" />
    </td>
  </tr>
  <tr>
    <td align="center">首页</td>
    <td align="center">六爻起卦</td>
    <td align="center">八字排盘</td>
  </tr>
</table>

## 功能亮点

### 六爻易数

- 支持时间起卦、硬币排卦、数字排卦、手动起卦四种方式
- 支持地点经度输入，用于真太阳时修正
- 结果页提供本卦、变卦、动爻、四柱、旬空、神煞与月将信息
- 支持互卦、错卦、综卦查阅，支持收藏、删除与 Markdown 导出

### 八字命理

- 支持本地钟表时、平太阳时、真太阳时三种排盘口径
- 支持出生地、夏令时、子时归属、自定义参考时点等输入项
- 结果页覆盖基本信息、基本排盘、专业细盘三大视图
- 专业细盘支持流年大运 / 胎命身双面板，以及大运、流年、流月、小运联动

### 数据与 AI

- 原生端使用 SQLite 持久化，Web 端自动降级到 `localStorage`
- 支持统一历史记录、收藏筛选、关键词搜索、备份导出与恢复导入
- AI 对话支持流式回复、阶段式解盘、快捷追问、会话导出与结果回写
- AI 接口采用用户自配的 OpenAI 兼容服务

## 技术栈

- Expo SDK 54
- React Native 0.81
- React 19
- TypeScript 5.9
- Expo Router
- `expo-sqlite`
- `@react-native-async-storage/async-storage`
- `react-native-sse`
- `react-native-svg`
- `tyme4ts`

## 仓库结构

```text
app/                  Expo Router 页面与路由
src/components/       通用组件与交互容器
src/core/             六爻与八字纯计算核心
src/features/bazi/    八字结果页运行态与编辑辅助
src/db/               多引擎记录、导入导出与兼容处理
src/services/         AI、设置、分享、地点持久化
src/theme/            主题、配色与语义色 token
src/data/             卦象、卦辞与静态资料
docs/images/          README 展示截图
```

## 快速开始

### 环境要求

- Node.js 18+
- npm 9+

### 安装依赖

```bash
npm install
```

### 启动项目

```bash
npm run start
```

常用命令：

```bash
npm run android
npm run ios
npm run web
```

### 类型检查

```bash
npx tsc --noEmit
```

### Jest

仓库已提供 Jest 配置，可直接运行：

```bash
npx jest --runInBand --passWithNoTests
```

## 数据与兼容

- 六爻与八字记录统一使用同一套记录 envelope 存储
- 备份文件当前版本为 `version: 2`
- 导出备份默认不包含 API Key
- 旧八字记录会在读取、导出和导入时自动完成兼容补全
- 六爻节气、月将与月相统一基于排盘使用的有效时间计算

## 文档

- 架构文档：[PROJECT_ARCHITECTURE.md](./PROJECT_ARCHITECTURE.md)

## 开发说明

- 当前运行入口为 `expo-router/entry`
- 应用显示名与 Expo `slug` 为 `见机 / jianji`
- 原生数据库文件名沿用历史名称 `liuyao.db`
