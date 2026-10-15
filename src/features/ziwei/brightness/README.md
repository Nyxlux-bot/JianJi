# Ziwei Star Brightness Baseline

This folder stores a structured, source-attributed baseline for Zi Wei Dou Shu
star brightness (庙/旺/得/利/平/陷/不).

## Conventions

- Palace order: `寅 -> ... -> 丑` (12 items), matching `iztro` palace indexing.
- Brightness codes (iztro keys):
  - `miao` -> 庙
  - `wang` -> 旺
  - `de` -> 得
  - `li` -> 利
  - `ping` -> 平
  - `xian` -> 陷
  - `bu` -> 不
- `null` means: explicitly not provided / not meaningful / not reliably extractable for that school.

## Mappings Used When Transcribing Sources

Some sources use numeric scoring. When transcribing:

- `+3 = miao`, `+2 = wang`, `+1 = de`, `0 = li`, `-1 = ping`, `-2 = bu`, `-3 = xian`

Some sources use textual variants. When transcribing:

- `庙 -> miao`, `旺 -> wang`, `得/地/得地 -> de`, `利/利益 -> li`, `平/平和 -> ping`, `陷 -> xian`, `不/不得地 -> bu`, `闲 -> ping`


## Coverage Notes

- Added from the 中州派 public tables (xuanmen.com.cn): `mw2` 地支星曜庙陷表 for 天马、红鸾、天喜、龙池、凤阁、天德、解神、天哭、天虚、孤辰、寡宿、华盖、劫煞、咸池、天空、大耗、破碎, and `mw4` 天干星曜庙陷表 for 天官、天福、截空.
  The same values are filled into all three schools, matching how the existing minor-star rows already borrow these tables.
  Blank cells in the images are branches a star can never occupy; they stay `null`.
- iztro splits 截空 into `jielu` (截路) and `kongwang` (空亡); both use the 截空 row. The 中州 algorithm names 劫煞 `jieshaAdj`; it uses the 劫煞 row.
- Still unresolved (no public table found; `mw3` leaves 台辅、封诰 blank): 天姚、台辅、封诰、天巫、天厨、天月、月德、蜚廉、天刑、阴煞、年解.
- `version` stays 2 for this addition: only empty cells were filled, no existing value changed. Bumping it would mark every saved record's rule signature stale (drift notice, AI falls back to compatibility mode) for no gain.
