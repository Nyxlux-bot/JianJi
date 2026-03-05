# 见机 (Jianji) - 六爻排盘应用

「见机」是一款基于 **Expo + React Native** 构建的现代化、纯净、无广告的跨平台传统文化（六爻排盘）工具。应用致力于将古典的易经筮算文化与现代化的移动前端技术和人工智能分析系统相结合。

## 核心特性

-  **多维起卦方式**
  - **时间起卦**：利用真太阳时、天文干支、当前日期一键定位时辰。
  - **硬币起卦（机推抛掷）**：使用高速率丝滑的 `Reanimated` 3D 翻转动效进行沉浸式的抛币起卦。
  - **数字起卦**：输入三个自然数（上卦、下卦、动爻），纯正理数。
  - **手动起卦**：提供快速的各爻阴阳变更指定面板（配合精致的手掌 SVG 图标），支持变卦。

-  **AI 大模型流式断卦 (隐藏的极客模式)**
  - **深度集成大语言模型**：自带系统级的定制大模型 Prompt，支持 OpenAI、DeepSeek、通义千问等主流格式。
  - **流式输出**：集成 `react-native-sse` 和 `react-native-markdown-display` 实现如同 ChatGPT 官网一样的字符流式逐字回吐及 Markdown 格式化（加粗、列表、标题等）。
  - **太极玄章 (Easter Egg)**：为了保证界面纯净，大模型调参入口默认隐藏。在首页连续快速点击顶部“太极八卦图”7 次，即可唤出沉浸式的“AI 接口配置”专属大屏，供极客用户修改 API 地址、Key 和系统提示词。

-  **强大的排盘核心层**
  - 内置万年历（公农历互转与 24 节气推演）。
  - 四柱（干支）、真太阳时自动计算。
  - **神煞与旬空系统**：内置高精度算法系统，支持自动推导旬空及十二神煞（天乙贵人、驿马、桃花、羊刃等），标签直观展示于四柱面板，并无缝介入 AI 的断卦语义投喂。
  - 完整的六十四卦图表（宫位、世应、飞伏、六神、六亲、纳甲纳音的计算引擎），脱离网络亦能完整运行。
  - **原生 SVG 图层渲染**：卦象界面的铜钱与动静爻符重构为高精度的自绘多圈 SVG 矢量图形。

-  **全局沉浸交互与可持久化四色主题**
  - 彻底抛弃系统原生粗糙白板弹窗，构建了基于 `DeviceEventEmitter` 的 `CustomAlertProvider` 全局级事件映射机制，各类提示与交互完美融于当前主题。
  - 提供极其考究的四套新中式禅意国风色彩库：
    - **玄黑金 (Dark)** - 深灰/黑金交错，典雅高级肃穆。
    - **原矿绿 (Green)** - 借玉取意，生机勃发。
    - **宣纸白 (White)** - 素雅、护眼，水墨国风。
    - **紫檀香 (Purple)** - 沉稳内敛，尊贵宁静。

-  **离线卷宗库与迁移**
  - 内置 `expo-sqlite` 将历史排盘以及关联的所有 **AI 详细测算回溯文本** 完全留存在本地设备。
  - **脱机备份与恢复**：基于沙盒外的 `expo-file-system`、`expo-sharing` 与 `expo-document-picker` 构建数据双向流通管道，支持一键导出包含配置项在内的全量大满贯 JSON 归档或从外部微信等随意导入实现换机无缝迁移。

---

## 🛠 技术架构 & 依赖

项目基于最新的生态圈开发，轻量且极致响应：

* **核心框架**：`Expo` (SDK 54), `React Native` (0.81), `TypeScript` (5.9), `React` (19.1)
* **路由导航**：`Expo Router` (基于文件系统路由编织的 `app/`)
* **本地存储**：`expo-sqlite` (结构化数据层), `@react-native-async-storage/async-storage` (系统 KV 级设置存储持久化)
* **网络与扩展**：`react-native-sse` (EventSource 流请求), `react-native-markdown-display`
* **原生桥接**：`expo-sharing` (原生分享底座), `expo-document-picker` (沙箱外文件选取)
* **图形与动画**：`react-native-svg` (自绘 UI 图标和爻符), `react-native-reanimated`, `react-native-gesture-handler`

### 数据安全与恢复一致性

- **备份默认不包含 API Key**：导出备份时自动清空密钥字段，防止明文泄露。
- **恢复导入具备结构校验**：导入前会校验记录关键字段（`id/createdAt/method/benGua`），非法数据会被拦截并提示具体条目。
- **覆盖恢复具备原子性**：原生端恢复流程使用事务，避免“先清库、后半成功”的中间损坏状态。
- **Prompt 自定义受保护**：自定义提示词会被标记为用户配置，不会被版本升级自动覆盖。

### 目录结构（速览）

>  **开发者引航**：有关项目中每一个源码文件的解耦逻辑、具体作用以及所有数据流的相互传递关系，请参阅更为详尽的 [项目源码与架构导览指北 (PROJECT_ARCHITECTURE.md)](./PROJECT_ARCHITECTURE.md)。

```text
├── app/                       # Expo Router 页面目录
│   ├── _layout.tsx            # 全局路由壳、主题状态注入与 CustomAlertProvider 挂载
│   ├── index.tsx              # 首页看板 (及隐藏的 AI 悬浮参数大屏)
│   ├── history.tsx            # 历史记录流
│   ├── settings.tsx           # 工具设置（主题切换与数据迁移入口）
│   ├── divination/            # 起卦页组
│   │   ├── time.tsx           # 时间起卦
│   │   ├── coin.tsx           # 3D硬币
│   │   ├── number.tsx         # 数字起卦
│   │   └── manual.tsx         # 手摇起卦
│   └── result/                
│       └── [id].tsx           # 排盘与 AI 流式断卦结果呈现展示页
├── src/                       # 代码计算业务流转层
│   ├── core/                  # 完全解耦的纯 TypeScript 六爻计算引擎 (Lunar, BaZi, 神煞, 旬空等)
│   ├── components/            # 全局泛用化部件框架 (Modal, 全局主题统筹, SVG Icons)
│   ├── db/                    # 抽象数据库交互器及记录的出入序列化重组
│   ├── services/              # AI 流处理及外围接口管理中心
│   └── theme/                 # 核心四色系钩子注入提取流转网络
├── assets/                    # 图标库、字体、溅射闪屏底图
├── app.json / eas.json        # 部署配置、EAS Build 包构建签名描述文件
└── package.json               # 库依赖清单
```

---

## 本地运行与开发指导

### 1. 环境依赖配置
确保机具本身已经配置好了完善的 `Node.js` 以及 `npm`。并且准备好了 Xcode(Mac) 或者 Android Studio(Win/Mac) 运行环境（或准备一台安装了 `Expo Go` 的开发调试器手机）。

### 2. 项目启动
```bash
# 获取所有原生和封装模块包 (依赖较新)
npm install

# 以清空缓存的安全模式触发本地 Metro 打包运行器
npx expo start --clear
```

随后你可以在终端看见二维码供真机扫码打开，或是按下 `a`/`i` 自动部署模拟器直接游玩预览。

### 3. 类型校验
由于项目中重构大量依赖链以及 Hooks 等解耦层。在修改 Commit 前建议严格执行 TS 的类型校准检查（项目内已追求 0 errors 无警告目标）：
```bash
npx tsc --noEmit
```

### 4. 单元测试
项目当前已覆盖核心计算与关键稳定性逻辑，可直接运行：
```bash
npx jest --runInBand
```

### 5. EAS 打包生产
如需上架与本地基座应用分发，内部依据设定好的 `eas.json` 即可进行编译：
```bash
npm install -g eas-cli
eas build -p android --profile preview
```

---

## 🖋 License & 寄语
本软件遵从天人合一之思想，排卦只在提供看待事物的又一维度。
> 见机而作，不俟终日。——《易·系辞下》
