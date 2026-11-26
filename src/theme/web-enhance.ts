/**
 * 网页端的渐进增强：只在 Platform.OS === 'web' 时生效，原生端拿到的都是 null / 空对象 / 空操作。
 * - webScrimBlur：弹层遮罩加背景模糊与滚动链隔离（SheetModal、DialogModal、QimenPalaceDetail 共用）
 * - webLiquidGlass：液态底栏在网页端的渐进毛玻璃增强
 * - webHorizontalFadeProps：横向滚动行挂 data-hfade，由滚动驱动动画按滚动位置动态渐隐两端，不裁切首尾项
 * - webPressableProps：可点控件挂 data-pressable，仅在 @media (hover: hover) 指针设备上响应主题适配悬停态
 * - webFocusFieldProps：已有金色聚焦边框的输入框挂 data-focus-field，抑制网页默认蓝框叠影
 * - webTextWrapBalance / webTextWrapPretty：标题与正文的现代换行微精修钩子
 * - applyWebGlobalStyles：同步 :root color-scheme、高对比细滚动条（含 @supports 规范降级）、
 *   :focus-visible 焦点环、forced-colors 兜底与弹层 overscroll-behavior
 */
import { Platform, type ViewStyle } from 'react-native';

const IS_WEB = Platform.OS === 'web';
const EMPTY_PROPS = {} as object;

// react-native-web 会将 backdropFilter / overscrollBehavior 透传并自动补全 -webkit- 前缀
export const webScrimBlur: ViewStyle | null = IS_WEB
    ? ({ backdropFilter: 'blur(6px)', overflow: 'hidden', overscrollBehavior: 'contain' } as unknown as ViewStyle)
    : null;

export const webLiquidGlass: ViewStyle | null = IS_WEB
    ? ({ backdropFilter: 'blur(16px) saturate(1.4)', overflow: 'hidden' } as unknown as ViewStyle)
    : null;

export const webHorizontalFadeProps: object = IS_WEB ? ({ dataSet: { hfade: '' } } as object) : EMPTY_PROPS;
export const webPressableProps: object = IS_WEB ? ({ dataSet: { pressable: '' } } as object) : EMPTY_PROPS;
export const webFocusFieldProps: object = IS_WEB ? ({ dataSet: { focusField: '' } } as object) : EMPTY_PROPS;
export const webScrimProps: object = IS_WEB ? ({ dataSet: { scrim: '' } } as object) : EMPTY_PROPS;
export const webTextWrapBalance: object = IS_WEB ? ({ dataSet: { wrap: 'balance' } } as object) : EMPTY_PROPS;
export const webTextWrapPretty: object = IS_WEB ? ({ dataSet: { wrap: 'pretty' } } as object) : EMPTY_PROPS;

const STYLE_ELEMENT_ID = 'jianji-web-enhance';

/** 注入或更新网页端的全局样式与配色方案声明；原生端什么也不做 */
export function applyWebGlobalStyles(
    colors: { accent: { gold: string }; text: { tertiary: string } },
    theme: 'yin' | 'yang',
): void {
    if (!IS_WEB || typeof document === 'undefined') return;
    const isLight = theme === 'yang';

    // 同步 <meta name="color-scheme">（不新增 app/+html.tsx 以保持 SPA 构建与背景守门兼容）
    let meta = document.querySelector('meta[name="color-scheme"]') as HTMLMetaElement | null;
    if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'color-scheme';
        document.head.appendChild(meta);
    }
    meta.content = isLight ? 'light dark' : 'dark light';

    let element = document.getElementById(STYLE_ELEMENT_ID) as HTMLStyleElement | null;
    if (!element) {
        element = document.createElement('style');
        element.id = STYLE_ELEMENT_ID;
        document.head.appendChild(element);
    }

    // 滚动条滑块按 WCAG 1.4.11 校色：玄黑 #787878 对主/卡/浮层 ≥ 3.25:1，宣白 #85745a 对主/次/卡/浮层 ≥ 3.62:1
    const thumb = isLight ? '#85745a' : '#787878';
    // 悬停明度按主题区分：暗色微提亮，宣纸浅底微压暗避免 #fffaf0 过曝成纯白
    const hoverFilter = isLight ? 'brightness(0.96)' : 'brightness(1.08)';

    element.textContent = `
@property --fade-start {
  syntax: "<length>";
  inherits: false;
  initial-value: 0px;
}
@property --fade-end {
  syntax: "<length>";
  inherits: false;
  initial-value: 0px;
}
:root {
  color-scheme: ${isLight ? 'light' : 'dark'};
  --jianji-scrollbar-thumb: ${thumb};
  --jianji-focus-ring: ${colors.accent.gold};
  --jianji-hover-filter: ${hoverFilter};
}
* {
  scrollbar-width: thin;
  scrollbar-color: var(--jianji-scrollbar-thumb) transparent;
}
@supports not (scrollbar-color: auto) {
  * {
    scrollbar-width: auto;
  }
  *::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  *::-webkit-scrollbar-thumb {
    background: var(--jianji-scrollbar-thumb);
    border-radius: 3px;
  }
  *::-webkit-scrollbar-track {
    background: transparent;
  }
}
@supports (animation-timeline: scroll()) {
  [data-hfade] {
    --fade-size: 24px;
    --fade-dir: right;
    --fade-start-pos: 0;
    --fade-end-pos: 100%;
    scroll-padding-inline: var(--fade-size);
    mask:
      linear-gradient(black, black) no-clip subtract,
      linear-gradient(to var(--fade-dir), black, transparent) var(--fade-start-pos) 0 / var(--fade-start) 100% no-repeat no-clip,
      linear-gradient(to var(--fade-dir), transparent, black) var(--fade-end-pos) 0 / var(--fade-end) 100% no-repeat no-clip;
    animation: jianji-fade-start linear both, jianji-fade-end linear both;
    animation-timeline: scroll(self inline);
    animation-range: 0 var(--fade-size), calc(100% - var(--fade-size)) 100%;
  }
  [data-hfade]:dir(rtl) {
    --fade-dir: left;
    --fade-start-pos: 100%;
    --fade-end-pos: 0;
  }
}
@keyframes jianji-fade-start {
  to { --fade-start: var(--fade-size); }
}
@keyframes jianji-fade-end {
  from { --fade-end: var(--fade-size); }
}
@media (hover: hover) {
  [data-pressable]:not([aria-disabled="true"]) {
    transition: filter 120ms ease-out;
  }
  [data-pressable]:not([aria-disabled="true"]):hover {
    filter: var(--jianji-hover-filter);
  }
}
@media (prefers-reduced-motion: reduce) {
  [data-pressable] {
    transition: none;
  }
}
[role="button"]:focus-visible, [role="radio"]:focus-visible, [role="checkbox"]:focus-visible,
[role="tab"]:focus-visible, [role="switch"]:focus-visible, [role="menuitem"]:focus-visible,
[role="slider"]:focus-visible, button:focus-visible, a:focus-visible, [tabindex]:focus-visible {
  outline: 2px solid var(--jianji-focus-ring);
  outline-offset: 2px;
}
[role="button"]:focus:not(:focus-visible), [tabindex]:focus:not(:focus-visible) {
  outline: none;
}
input[data-focus-field]:focus, textarea[data-focus-field]:focus {
  outline: none;
}
input:not([data-focus-field]):focus-visible, textarea:not([data-focus-field]):focus-visible, select:focus-visible {
  outline: 2px solid var(--jianji-focus-ring);
  outline-offset: 2px;
}
[aria-modal="true"], [data-scrim] {
  overscroll-behavior: contain;
}
[data-wrap="balance"] {
  text-wrap: balance;
}
[data-wrap="pretty"] {
  text-wrap: pretty;
}
@media (forced-colors: active) {
  [role="button"]:focus-visible, [role="radio"]:focus-visible, [role="checkbox"]:focus-visible,
  [role="tab"]:focus-visible, [role="switch"]:focus-visible, [role="menuitem"]:focus-visible,
  [role="slider"]:focus-visible, button:focus-visible, a:focus-visible, [tabindex]:focus-visible,
  input:focus-visible, textarea:focus-visible, select:focus-visible {
    outline: 2px solid Highlight !important;
    outline-offset: 2px;
  }
  [aria-modal="true"] {
    border: 1px solid CanvasText;
  }
}
`;
}
