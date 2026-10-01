压缩当前八字会话已有的分析结论，不新增命理事实。
{{baseContext}}
【最近会话】
{{conversationSummary}}
【六亲事实来源】
{{kinshipContext}}
保留 AI 推断、用户确认和用户补充的区别；反馈后解释不能写成首次命中，未确认六亲不能混入基础结论。
仅返回严格 JSON：{{outputContract}}
foundation 只保留明确结论；verificationSummary、fiveYearSummary、rollingSummary 各不超过 80 字。
没有相关结论时留空；topicNotes 只记录已讨论专题。不要输出 JSON 以外的内容。

不得因为用户点击继续或旧摘要写有“已确认”就提升事实状态；没有明确反馈的事件仍为待核验，用户否定的结论须保留否定状态，不再作为成立的背景。
