# 见机 (Jianji) - 六爻排盘应用详细架构文档

本文档全面梳理了「见机」应用所有源代码文件在项目树中的职责划分、作用域，以及文件之间的相互引用关系和组合模式。本指南供二次开发或架构升级时提供严谨的心智模型图谱参照。

## 概览框架结构

应用基于 **Expo + React Native + Expo Router** 架构，利用 **TypeScript** 实现类型安全。项目目录物理上严格区分视图层（`app/` 和 `src/components/`）与业务数据层（`src/core/` 计算引擎，`src/services/` 服务引擎，`src/db/` 持久化引擎）。

---

## 1. `app/` - 路由机制与页面基座 (Expo Router)

此文件夹基于文件系统路由（File-based Routing）。在此建立的每一个 `.tsx` 组件即代表一个页面环境栈。

### 1.1 全局与导航核心
- **`app/_layout.tsx`**：整个应用的根入口组件。在此处注入底层基础设：挂载 `ThemeProvider` (全局多主题状态) 和 `CustomAlertProvider` (全局自定义弹窗事件层)。同时作为 `Stack` 的根容器。
- **`app/(tabs)/_layout.tsx`**：主应用程序底部高圆角毛玻璃的导航栏 (Tab Bar)。此组件自绘了并接替了原生 Tab 设计，渲染首页、藏经、历史、设置四个顶级标签节点，支持 Reanimated 选中平滑过渡动画反馈。

### 1.2 顶级板块栈 (Tab Screens)
- **`app/(tabs)/index.tsx` (主看板)**：首页模块。提供四种起卦方式（时间、金钱、数字、手动）的入口直达。并隐藏了一个复读发烧友的彩蛋：快速点击顶图 7 下唤出神机阁 AI 大模型设定弹窗（解耦了核心 UI 以保证应用洁净）。
- **`app/(tabs)/learn.tsx` (占卜书阁)**：学习与字典中心。将 `data/iching.json` 中定义好的易经六十四卦直接平铺为一个卡片滚动池，点击任意卡片即可在同层级呼出沉浸式字典详情以供细读。
- **`app/(tabs)/history.tsx` (历史长流)**：读取本地 SQLite 的留痕面板，通过时间倒序展示曾经起的每一卦（含占问主题、起卦时间、本卦变卦图腾），点击卡片重定向驶入 `result/[id]` 详情页并自动恢复 AI 聊天进度。
- **`app/(tabs)/settings.tsx` (应用全局设置)**：内置四色主题的色块点选开关（借由 `ThemeContext` 实时透传改变整个 App 的颜色变量状态），并容纳了「数据迁移」系统：导出/汇入整体数据库包等高阶文件流功能。

### 1.3 起卦分支流 (`app/divination/`)
- **`time.tsx` (时间起卦)**：利用 `DateTimePicker` 选择时间，默认获取当前真太阳时。选择成功后组装 `PanResult` 并导航跳转。
- **`coin.tsx` (金钱摇卦)**：通过 `react-native-reanimated` 与三维几何映射实现了三枚带有高精度纹理贴图的数字仿真铜钱。进行抛掷动作（数学随机生成阴阳面），将累计产生的 6 个结果聚合发送给底层进行转换。
- **`number.tsx` (数字起卦)**：经典的三数起卦。输入（或自动摇数机）赋予上卦、下卦、动爻位属性。
- **`manual.tsx` (手动排卦)**：高级定制模式。给予用户最高控制力，利用双列面板分别选择六个爻位的“太阴、老阳、少阴、少阳”，并且能配置神煞干支空亡。

### 1.4 结果截面展示 (`app/result/`)
- **`[id].tsx` (综合推演面板)**：排盘完毕后的大满贯展示界面。此文件负责粘合所有复杂组件（包括但不限于 `HexagramDisplay`, `FourPillars`, 右下角高悬的 `AIChatModal` 入口按钮容器，以及左下角的高级衍生卦 `GuaXiangBottomSheet` 分支弹窗）。

---

## 2. `src/components/` - 全局视图 UI 部件库

这些文件充当可以插入到任何页面的“插片组件区”。它们各自负责单一视觉/交互单元，不携带深层的页面流信息。

### 2.1 智能流式体系与字典
- **`AIChatModal.tsx`**：AI 对话全屏交互模态框。它内部关联 `services/ai.ts` 的接口，运用流式数据获取大模型的见解并使用 `react-native-markdown-display` 一帧一帧渲染在对聊框中。同时内部搭载了后台静默灵感查询机制 (Quick Replies)。
- **`GuaXiangBottomSheet.tsx`**：高级变阵截面。在结果页弹出的左侧底片抽屉，含有「本、互、错、综」四个 Segmented Tab。
- **`HexagramDetailView.tsx`**：承接书阁和变阵组件的“《十翼》混合展示长卷器”。内部利用 JSON 数据组合出：【卦辞+彖传+大象传+文言+小象传】的结构。
- **`HexagramDisplay.tsx`**：核心 SVG 绘画仪。用于在一行并排渲染《本卦》和《变卦》的多层圆圈符与动爻连接线。

### 2.2 通用基础支撑
- **`Icons.tsx`**：全局 SVG 字典库。统一导出可自适应变色系统的主题图标。
- **`CustomAlertProvider.tsx`**：完全取代原生 `Alert.alert` 的跨路由沉浸式弹窗，由 React Context 与 Event Emitter 实现，以确保无论发生在哪里的报错弹窗都能兼容例如“玄黑金”主题的环境背景融合。
- **`ConfirmModal.tsx`**：可定制选项卡的底层抽象 Modal 画板，`CustomAlertProvider` 基于此进行派生延伸。

### 2.3 设置互动仪
- **`ScrollPicker.tsx` / `DateTimePicker.tsx` / `CityPicker.tsx` / `LocationBar.tsx`**：这些是一套精密环环相扣的列表滚轮机件，组合之后能够进行复杂的时间地点联动选择并获取经纬度反馈给天文时间计算引擎。
- **`StatusBarDecor.tsx`**：自动根据目前激活的主题色去协调系统（iOS/Android）顶级状态栏（WiFI、电量图标）的深浅模式字色翻转。

---

## 3. `src/core/` - 易经核心数学/天文学计算引擎

这是一个纯 TypeScript 的数据处理器集群。它们不依赖任何 React UI 包，甚至可以移植挂载到 Node.js 后端上运行。

- **`liuyao-calc.ts`**：所有易经算法入口神经元。定义了 `PanResult` 类型的排盘输出结构。输入任意形式（时间数字等），将干支纪年、纳甲、纳音、世应、六亲六神矩阵逻辑进行耦合运算打包为一枚完整的卦系对象。
- **`hexagramTransform.ts`**：衍生变卦转换纯函数工具。基于高阶易学法则通过原卦阵构建互卦、错卦、综卦，被 `[id].tsx` 以及大模型预发机制 (提示词生成环节) 共同索求调用以提供微观环境参照。本文件附带完备的 Jest `__tests__` 断言测试。
- **`lunar.ts` / `liuyao-data.ts`**：万年历与天干地支五行表抽象映射层。包含公农历互转与 24 节气定干支判定。
- **`true-solar-time.ts` / `city-data.ts`**：真太阳时修正系统。结合中国数百个物理城市坐标的经长计算时差，得出真正的地表日照干支坐标。
- **`shen-sha.ts` / `xun-kong.ts`**：神煞算法（天乙贵人、驿马、将星等共 12 神煞排盘计算）与六甲空亡算法（排空亡与旬表）。

---

## 4. `src/services/` - 外部接口代理系统

- **`ai.ts`**：全套的大语言模型中枢。其中：
  - `buildSystemMessage`：拼接原始卦意、四柱、互错综衍生盘成一套极其庞大且严酷的大模型人格 System Prompt。
  - `analyzeWithAIChatStream`：利用 `EventSource` 代理发包连接流式通道并将打字块 (chunks) 对外喷射吐出，同时接驳了基于 `AbortController` 的硬中断逻辑。
  - `generateQuickReplies`：剥离于主对话流，隐没在后台发起的纯静态查询：针对当前语境提炼 3 个推荐追问方案的快开药丸 (Quick Replies)。
- **`settings.ts`**：专门处理 KV (Key-Value) 性系统的 `AsyncStorage` 的存储管理，包含了接口 Key，激活状态，当前应用采用的主题风格等偏好的统一输出接口。
- **`location.ts`**：底层系统级定位模块接口（请求原生 GPS 相关）。

---

## 5. `src/db/` - 数据持久层

- **`database.ts`**：全局基于 `expo-sqlite` 的原生应用外存通讯桥接器。
  - 创建 SQLite table 定义存储 `id`, `question`, `aiChatHistory` 等表项。
  - 执行排盘插入 `saveRecord`、历史删除与拉取查询 `getRecords` 等。
  - 它保障了离网状态下数据的绝对可追溯与可保存。

---

## 6. `src/theme/` - 主题网点

- **`ThemeContext.tsx`**：设计系统的大脑中心，作为 React Context 在全局释放一套名为 `makeStyles` 工具集。
- **`colors.ts` & `colors-*.ts` (Dark, Green, White, Purple)**：四个不同的配饰色泽域配置文件。任何颜色的改变最终将触发 Context Provider 重绘全量 UI，形成整个系统的可变换肌肤。

---

## 7. `data/` - 本地静态原生字典库

为保证 App 的零外部冗长依赖（摆脱网络限制进行随时随地深度查询古文辞海）：
- **`iching.json`**：周易原文映射库基础。
- **`ichuan/` (tuan, wen, xiang)**：包含《彖传》、《文言传》、《象传》（大象传、小象传）等十翼外传解释字典。上述所有内容都在底层的 `HexagramDetailView` 将其聚合，呈现宏观经文阅读图景。
