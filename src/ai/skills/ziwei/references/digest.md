压缩当前紫微会话已有的分析结论，不新增命理事实。
{{baseContext}}
【最近会话】
{{conversationSummary}}
verificationTimeline 保留 最多 3 到 5 条已讨论的过去节点，逐条保留待核验、用户自述或用户否定的来源状态；yearlyOutlook 只记录已讨论年份，key 为四位年份；focusAnchors 只保留已讨论宫位或主轴。
仅返回严格 JSON：{{outputContract}}
foundation 只保留明确结论；verificationSummary、fiveYearSummary、rollingSummary 各不超过 80 字。
没有相关结论时留空；topicNotes 只记录已讨论专题。不要输出 JSON 以外的内容。

不得因为用户点击继续或旧摘要写有“已确认”就提升事实状态；没有明确反馈的事件仍为待核验，用户否定的结论须保留否定状态，不再作为成立的背景。
