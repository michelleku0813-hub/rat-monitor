# 鼠患 AIoT Dashboard 指標研究報告

## TL;DR
- 這套系統偵測到的是「鼠隻活動事件（rodent activity events）」，不是「老鼠數量」。在沒有個體 Re-ID 或標記重捕的前提下，任何「今天 100 隻老鼠」「鼠患密度」的說法都不成立；香港食環署（FEHD）自 2024 年起已用熱能攝影＋AI 全面取代誘餌普查，並以「無鼠百分比／Rodent Absence Rate（RAR）」作為官方指標，這是最值得借鏡的政府級做法。
- 首頁只放 5–7 個 KPI，核心是：每 100 監測小時活動事件數（可跨場域比較）、7 日趨勢方向、活動高峰時段、場域風險排名（TopN）、異常增加警示、設備在線率。原始「今日事件數」只能當輔助，不能單獨用來下管理決策。
- Event 去重是整套數據可信度的地基：對固定式下水道／市場相機，建議採用「Tracking ID（ByteTrack）＋離開畫面後的靜默間隔」複合定義，靜默間隔取 1–5 分鐘（比大型哺乳類 camera trap 慣用的 30 分鐘短很多，因為鼠隻小、快、活動頻繁），並與虛擬跨線（virtual line crossing）搭配計算通過方向。

---

## Key Findings（核心發現）

1. **官方標竿：香港 FEHD 的「無鼠百分比／RAR」是目前全球最成熟的政府級 AI 鼠患監測指標。** FEHD 自 2024 年起全面以熱能探測攝錄機配 AI，官方定義為「rodent activities will be recorded by means of thermal images captured at every two-minute interval from 1900 to 0700 hours for three consecutive nights」（每 2 分鐘拍一張熱影像、每晚 19:00–07:00、連續 3 晚）。RAR =（沒有偵測到鼠隻的影像數 ÷ 總影像數）×100%，FEHD 官方白話解釋為「for every 100 images, 94 of them did not detect rodents」。全港整體 RAR：2024 下半年 94.0%、2025 上半年 96.0%、2025 下半年 96.1%、2026 上半年 96.4%。此指標刻意避開「數老鼠」，改以「時間片段中未偵測到鼠」的比率呈現，這正是本專案應學習的科學表述方式。

2. **台灣目前沒有全國一致的鼠類監測標準。** 台北市環保局公開呼籲環境部建立全國一致的鼠類監測模型，並坦言 12 年未做鼠類密度調查；現行估算靠籠夜法、活躍鼠洞數與 1999 通報量。台灣官方認可的科學指標是「防除率（Control Rate/Efficacy）=（1 − 防治後鼠數／防治前鼠數）×100%」，一般要求 80% 以上。這是本專案「投藥前後成效」指標最直接的本土依據。

3. **相對豐度指數（RAI）與「每單位努力的獨立偵測數」是生態學界的標準做法，可直接移植。** camera trap 文獻普遍以 RAI＝獨立偵測事件數 ÷ 監測努力（trap nights 或監測小時）×係數。這使不同場域、不同監測時長可以公平比較——正是本專案跨場域比較的正確基礎。但文獻也明確警告：RAI 只是「naive 的相對指標」，只有在偵測機率一致的假設下才與真實豐度單調相關，不能當絕對族群量。

4. **AI Confidence 不等於 Accuracy。** MegaDetector 等 camera trap 模型的 confidence（0–1）只是單一框的信心分數，需自行設閾值；Microsoft AI for Good 官方 README 明言「You set a threshold (typically 0.15–0.3)… Lower values catch more true animals (higher recall) at the cost of more false positives」。模型好壞要用 Precision/Recall/F1/mAP 搭配人工複核來評估，且需在自己的下水道／市場資料上重新驗證，不能沿用論文數字。

5. **Event 去重要用鼠類專屬的短間隔，不能照抄 30 分鐘規則。** 30 分鐘獨立性是大型／中型哺乳類的慣例。針對商業與都市鼠隻，文獻使用遠短的間隔：Lambert et al.（2018, *Pest Management Science*, DOI:10.1002/ps.4668）對溝鼠與家鼠指出「Filtering the camera trap data to simulate a 30-s delay between camera trigger events removed 59.9% of data and did not adversely affect the correlation between activity indices from camera traps and footprint tracking」；Baldwin et al.（2014）對屋頂鼠用「最少 5 分鐘」間隔的照片數作活動指數，與已知最小族群數高度相關（r=0.96）；Rendall et al.（2014）對黑鼠與家鼠以 15 分鐘為「event」。

---

## Details（詳細研究）

### 一、資料來源盤點（依可信度排序）

**政府機關 / 國際組織**
- 香港食環署（FEHD）《Rodent Pests and Their Control》：RAR 公式、熱能攝影＋AI 方法、每 2 分鐘拍攝、19:00–07:00、連 3 晚。https://www.fehd.gov.hk/english/pestcontrol/risk-pest-rodents.html
- FEHD《鼠隻活動調查結果》：RAR 逐期數據。https://www.fehd.gov.hk/tc_chi/pestcontrol/rat_free_percentage.html
- 香港政府新聞公報（2024/08/01、2025/07/23）：首次以熱能＋AI 全面取代誘餌普查、RAR 白話定義。https://www.info.gov.hk/gia/general/202408/01/P2024080100435.htm
- 新加坡 NEA / MSE：以每兩個月一次的鼠洞（burrow）巡查數作為監測指標；2020–2021 公共區域平均每週期約 4,300 / 3,900 個鼠洞。https://www.mse.gov.sg/latest-news/written-reply-to-pq-on-rodent-infestations-nationwide/
- 台北市環保局／市府新聞稿：呼籲中央建全國一致監測模型、籠夜法、活躍鼠洞、通報量。https://www.gov.taipei/News_Content.aspx?n=F0DDAF49B89E9413&sms=72544237BBE4C5F6&s=E08C376104E132FD
- 美國 CDC / 紐約市鼠患指數（rat index）：以鼠腳印、鼠糞、鼠洞、鼠道、咬痕、活鼠 6 項各 0–3 分評估。https://www.cdc.gov/mmwr/preview/mmwrhtml/mm6137a1.htm

**Peer-reviewed / 學術**
- O'Brien 及 camera trap RAI 方法學（RAI = 獨立照片數／trap day）；《Risky business or simple solution – Relative abundance indices from camera-trapping》。https://www.sciencedirect.com/science/article/abs/pii/S000632071200523X
- 《Limitations of relative abundance indices calculated from camera-trapping data》：中國 1997–2018 RAI 單位彙整（1,000h、1,000d、100d、1d）。https://www.biodiversity-science.net/EN/10.17520/biods.2018327
- Lambert et al. (2018) *Pest Management Science*，商業鼠隻活動指數與 30 秒過濾，DOI:10.1002/ps.4668。
- Baldwin et al. (2014) *Environ. Sci. Pollut. Res.*，屋頂鼠 5 分鐘間隔活動指數 r=0.96，DOI:10.1007/s11356-014-2525-4。
- Rendall et al. (2014) *PLOS ONE*，黑鼠／家鼠 15 分鐘 event，DOI:10.1371/journal.pone.0086592。
- 新加坡垃圾收集場鼠患風險因子（紅外相機，日夜皆活動）。https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8803118/
- 診斷指標（Precision/Recall/F1/mAP/IoU）：Roboflow、arXiv YOLO 論文等。
- Multi-object tracking 綜述（SORT/DeepSORT/ByteTrack/BoT-SORT），arXiv:2506.13457；ByteTrack 原始論文 Zhang et al. (2021, arXiv:2110.06864, ECCV 2022)「we achieve 80.3 MOTA, 77.3 IDF1 and 63.1 HOTA on the test set of MOT17 with 30 FPS running speed on a single V100 GPU」。
- 相機遮蔽／失焦／起霧偵測：PMC4481966《Unified Camera Tamper Detection》。

**技術文件 / 商業案例**
- Microsoft MegaDetector（V6，YOLOv9/v10/RT-DETR；confidence 閾值 0.15–0.3；典型部署 70–95% 影像為空）。https://github.com/microsoft/megadetector
- Anticimex SMART：以熱與動作感測（明確標榜不用相機），趨勢曲線預測。https://us.anticimex.com/smart-pest-control-services/
- Rentokil PestConnect / Optix：紅外線感測，官網宣稱「resolve rodent activity up to twice as fast as traditional methods¹ while reducing rodenticide bait usage by as much as 60%²」，其註腳為 2017–2019 至 2022 英國客戶由未連網轉全連網之比較、且「Results may vary.」（廠商自述、非同行評審）；Optix 為 AI 相機。https://www.rentokil.com/us/pest-control/pestconnect

### 二、概念釐清：可以說什麼、不能說什麼

| 概念 | 本專案能否成立 | 說明 |
|---|---|---|
| Detection Count（偵測次數） | ✅ 可（原始值） | YOLO 每 frame 的偵測框計數，會嚴重高估，只能當內部原始數據 |
| Independent Detection Event（獨立活動事件） | ✅ 可（去重後） | 經 tracking＋靜默間隔去重後的事件；本專案主指標 |
| Rodent Activity（鼠隻活動） | ✅ 可 | 「活動」是行為量，不宣稱個體數，最安全 |
| Individual Rat Count（個體數） | ❌ 不可 | 需個體 Re-ID；本專案沒有 |
| Rat Population（族群量） | ❌ 不可 | 需標記重捕（mark-recapture）；本專案沒有 |
| Rat Density（鼠患密度） | ❌ 不可 | 需族群量＋面積校正；台灣官方亦承認難以準確估計 |
| Max Simultaneous Detection（同時最大偵測數） | ⚠️ 有限度 | 單一 frame 同時出現的框數，可作「至少 N 隻」的下限，不等於族群 |

**關鍵原則**：本系統只能量化「鼠隻活動的相對強度與時空分布」，不能量化「有幾隻老鼠」。所有對外指標命名一律用「活動事件（activity events）」而非「老鼠數」。

### 三、Event 去重：Independent Detection Event 的定義建議

同一隻鼠停留 8 秒、YOLO 在 200 個 frame 都偵測到，絕不能算 200 次。方法比較：

| 方法 | 優點 | 缺點 | 適用性 |
|---|---|---|---|
| A. Tracking ID（SORT/DeepSORT/ByteTrack） | 同一軌跡＝1 事件，最貼近「一次造訪」 | 遮擋／出入畫面易 ID switch；下水道光線差 | ★ 主力 |
| B. Virtual Line Crossing（虛擬跨線） | 可算通過方向與通量，適合管道／溝渠 | 只計跨線者，徘徊不跨線會漏 | ★ 輔助（管道場景） |
| C. 固定時間間隔（bin） | 實作最簡單 | 純武斷，跨 bin 邊界會誤切 | 備援 |
| D. 離開畫面後重進入 | 符合直覺 | 短暫遮擋會誤判為新事件 | 與 A 併用 |
| E. 30 秒／1 分／5 分獨立規則 | 生態學標準、可跨研究比較 | 閾值需場域校正 | ★ 與 A 併用 |

**Tracker 選擇**：ByteTrack 關聯所有高低分偵測框，在遮擋與擁擠場景維持軌跡連續性佳、速度快（原始論文於 MOT17 測試集達 MOTA 80.3、IDF1 77.3、HOTA 63.1，並在單張 V100 上維持 30 FPS），適合邊緣裝置；DeepSORT 需額外外觀嵌入模型，在鼠隻外觀相近、下水道低光時 Re-ID 反而不穩。故建議 ByteTrack 為主。

**建議的複合定義（本專案）**：
> 一個 Independent Detection Event =（同一 Tracking ID 的連續軌跡）；當該 ID 消失並超過「靜默間隔 T」後再出現，才計為新事件。T 預設 3 分鐘（可設定 1–5 分鐘），並記錄軌跡是否跨越虛擬線及方向。

**靜默間隔為何用 1–5 分鐘而非 30 分鐘**：30 分鐘是大型哺乳類慣例。鼠隻小、快、活動頻繁，文獻用短間隔——Lambert et al.(2018) 溝鼠／家鼠以 30 秒延遲過濾（移除約 59.9% 資料且不影響與足跡追蹤法的相關性）；Baldwin et al.(2014) 屋頂鼠用「最少 5 分鐘」；Rendall et al.(2014) 黑鼠／家鼠用 15 分鐘。FEHD 則用 2 分鐘拍攝間隔、逐張影像判定。建議本專案預設 3 分鐘並提供設定，且在儀表板明確標示所用 T 值（不同 T 產生不同事件數，會影響可比性）。

### 四、指標逐項評估

以下針對使用者列出的 36 項指標逐一以 A–M 架構評估，並歸納於成果 A 總表。核心結論摘要：

- **強烈推薦（首頁級）**：每 100 監測小時活動事件數、7/30 日趨勢、活動高峰時段、場域風險排名、異常增加警示、設備在線率、最近一次活動時間。
- **推薦（分析頁）**：每日／每小時事件數、夜間分布、星期×時間 Heatmap、跨場域比較、RAI、出現頻度、投藥前後變化、封堵前後變化、Intervention Effectiveness、事件持續時間、每日獨立事件數、同時最大偵測數。
- **研究／維運頁**：Confidence 分布、Precision、Recall、F1、mAP、FP/FN rate、人工複核率、model version、Battery、Signal、Last Seen、Upload Success、遮蔽／模糊／起霧狀態。
- **不建議或需嚴格加註**：「今日鼠隻數」（誤導）、任何「鼠患密度」「族群量」、自創無定義的「風險指數」。

#### 不同時間尺度的定位
- 每小時：只在分析頁看行為節律，不放首頁（雜訊大）。
- 每日：營運追蹤主單位。
- 每週：管理決策主單位（趨勢、成效）。
- 每月／半年：對外報告、跨區比較（對齊 FEHD 半年一次）。

### 五、視覺化對應

| 問題 | 最適圖表 | 理由 |
|---|---|---|
| 一天什麼時間最活躍？ | 24 小時 Bar / 折線（KDE 曲線可選） | 時段分布用長條最直覺；生態學界用 kernel density 呈現連續節律 |
| 最近活動增加或降低？ | Line Chart（含 7/30 日移動平均） | 趨勢方向需時間序列 |
| 哪個場域活動最高？ | 橫向 Bar（TopN 排名） | 類別比較用長條，排名清楚 |
| 星期幾、幾點最容易出現？ | Heatmap（7×24） | 雙維度密度用熱圖 |
| 投藥後有沒有下降？ | Line＋事件標記（介入前後對照） | 需標記介入時間點做前後比較 |
| 哪些設備失聯？ | Table＋狀態燈號 | 維運清單用表格 |
| 哪裡突然異常增加？ | Map（熱點）＋Alert list | 空間定位用地圖，異常用警示清單 |

原則：KPI Card 給「單一即時數字＋趨勢箭頭＋sparkline」；不為了美觀用圓餅圖或 3D。

### 六、風險等級與異常警示的科學化

- **場域風險等級**：不得自創無依據的黑箱分數。建議用可解釋的分級規則，並與原始觀測值分開顯示。例：以「每 100 監測小時事件數」的分位數（或固定閾值）分級為低／中／高，另可加權「近 7 日趨勢斜率」與「夜間高峰強度」，但每個構成項須在 tooltip 公開。這與 NEA 對垃圾收集場採「risk-based」做法、FEHD 對低 RAR 地點加強資源的邏輯一致。
- **異常增加警示**：採滾動基線 + Z-score（|z|>3 約對應 99.7% 分位）或對污染更穩健的 MAD（中位數絕對偏差）。基線視窗建議 4 週，並需處理日／週季節性（用星期×時段基線）。務必避免過多假警報，警示需附當時時間序列快照與門檻說明。

---

## 成果 A：《鼠患 AIoT Dashboard 指標研究表》

> 欄位：指標(中/英) | 代表意義 | 公式 | 所需原始資料 | 時間尺度 | 視覺化 | 使用者 | 價值 | 限制/是否誤導 | 首頁? | 推薦度

1. **今日鼠隻活動事件數 / Daily Activity Events**｜當日去重後事件總數｜Σ 獨立事件(當日)｜event 表｜每日｜KPI Card｜管理者｜即時感知｜⚠️易被誤解為「今天有幾隻老鼠」，須標註「活動事件數，非老鼠數」｜可（需加註）｜★★★☆
2. **每小時活動事件數 / Hourly Events**｜逐時事件｜Σ 事件/小時｜event 表｜每小時｜Bar｜研究/管理｜看節律｜單看雜訊大｜否｜★★☆
3. **每日活動事件數 / Daily Events**｜逐日事件｜Σ 事件/日｜event 表｜每日｜Line｜管理/研究｜營運追蹤｜受監測時數影響，需與在線時數並看｜否（趨勢放首頁）｜★★★
4. **每 100 監測小時事件數 / Events per 100 Monitoring Hours**｜標準化活動強度｜(Σ 事件 ÷ 有效監測小時)×100｜event＋device uptime｜每週/月｜KPI Card＋Bar｜研究/管理｜**跨場域可比、修正在線時間差異**｜需準確記錄有效監測時數；仍是相對指標非密度｜✅ 是｜★★★★（本專案旗艦指標）
5. **活動高峰時段 / Peak Activity Hour**｜最活躍小時｜argmax(逐時事件)｜event 表｜每日/週｜KPI＋Heatmap｜管理/現場｜安排巡查與投藥時機｜受單日極端值影響，宜用多日平均｜✅ 是｜★★★★
6. **夜間活動分布 / Nocturnal Distribution**｜夜間各時段占比｜夜間事件/總事件｜event＋日出日落｜每週｜Bar/KDE｜研究｜鼠多夜行，佐證資料合理性｜下水道日夜皆可能活動（新加坡研究）｜否｜★★★
7. **星期×時間 Heatmap / Day-Hour Heatmap**｜雙維度熱區｜事件計數(星期,時段)｜event 表｜每週/月｜Heatmap｜管理/研究｜找規律部署人力｜需足夠樣本，否則格子太稀疏｜分析頁首圖｜★★★★
8. **7/30 日趨勢 / 7-30 Day Trend**｜近期走向｜移動平均、環比｜daily events｜每日更新｜Line｜管理者｜**判斷變好變壞**｜短期波動需平滑｜✅ 是｜★★★★
9. **跨場域比較 / Site Comparison**｜場域排名｜各場 Events/100h｜event＋location｜每週/月｜橫向 Bar｜管理者｜資源調度｜必須用標準化值，不能用原始事件數比｜✅（TopN）｜★★★★
10. **鼠隻活動指數 / Rodent Activity Index**｜綜合活動強度｜同 Events/100h 或加權｜event＋uptime｜週/月｜KPI｜研究/管理｜統一對外口徑｜避免與「密度」混用｜視為 #4 別名｜★★★★
11. **相對豐度指數 / RAI**｜每單位努力偵測率｜(獨立事件 ÷ trap-nights)×100｜event＋監測夜數｜月｜Bar｜研究｜學界標準、可比｜naive 指標，偵測機率一致才成立｜否（研究頁）｜★★★☆
12. **出現頻度 / Occurrence Index**｜有偵測時段占比｜有事件時段數/總時段數｜event＋時段切分｜週/月｜KPI｜研究/管理｜類 FEHD RAR 的正向表述｜依時段切法變動｜否｜★★★
13. **無鼠率 / Rodent Absence Rate（RAR）**｜未偵測到鼠的時間片段比率｜(無鼠影像/片段數 ÷ 總數)×100%｜逐片段偵測結果｜週/半年｜KPI Card｜管理/對外｜**香港官方指標，正向易懂、避免數老鼠**｜需固定取樣片段長度；越高越好與直覺相反需說明｜✅ 是（對外報告強推）｜★★★★
14. **同時最大偵測數 / Max Simultaneous Detection**｜單 frame 同時最多框數｜max(框數/frame)｜detection 表｜事件級｜Table 欄位｜研究｜「至少 N 隻」下限｜絕非族群量｜否｜★★☆
15. **事件持續時間 / Event Duration**｜單事件秒數｜event_end − event_start｜event 表｜事件級｜Histogram｜研究｜區分路過 vs 逗留（覓食）｜tracking 中斷會低估｜否｜★★★
16. **每日獨立事件數 / Independent Detection Events**｜去重後每日事件｜見第三節定義｜tracking 結果｜每日｜Line｜研究/管理｜整套數據地基｜完全依賴去重規則｜否（但為 #3、#4 基礎）｜★★★★
17. **投藥前後活動變化 / Pre-Post Baiting Change**｜介入成效｜(1 − 後/前)×100%｜event＋intervention｜介入事件級｜Line＋標記｜管理者｜**對應台灣「防除率」≥80%**｜鼠繁殖快、易反彈，需持續觀察｜否（介入頁）｜★★★★
18. **封堵/清潔前後變化 / Pre-Post Environmental Change**｜環改成效｜同上｜event＋intervention｜介入級｜Line＋標記｜管理者｜驗證封堵鼠道效果｜外部因素干擾需對照場｜否｜★★★☆
19. **介入有效性 / Intervention Effectiveness**｜綜合成效指標｜防除率或事件降幅｜event＋intervention｜介入級｜KPI＋Line｜管理者｜證明投入有回報｜需前後同條件監測｜否｜★★★★
20. **場域風險等級 / Site Risk Level**｜低/中/高分級｜可解釋規則(見第六節)｜多指標｜週｜地圖色階/標籤｜管理者｜快速分流資源｜**須公開公式、與原始值分開**｜✅（需嚴格加註）｜★★★
21. **異常增加警示 / Anomaly Alert**｜突增偵測｜Z-score/MAD vs 滾動基線｜daily events＋基線｜即時/每日｜Alert list｜管理/維運｜及早介入｜假警報風險，需季節性基線｜✅ 是｜★★★★
22. **最近一次活動時間 / Last Activity Time**｜最新事件時戳｜max(captured_at)｜event 表｜即時｜KPI Card｜管理/現場｜「是否還在活動」｜單點不代表趨勢｜✅ 是｜★★★☆
23. **AI 辨識信心 / Confidence**｜單框信心分數｜模型輸出 0–1｜detection 表｜即時｜Histogram｜研究/維運｜設閾值、篩複核｜**絕不等於準確率**｜否（研究頁）｜★★★
24. **精確率 / Precision**｜預測為鼠中真為鼠比例｜TP/(TP+FP)｜複核標註｜版本級｜KPI/表｜研究｜衡量誤報｜需人工標註真值｜否｜★★★★
25. **召回率 / Recall**｜真實鼠中被抓到比例｜TP/(TP+FN)｜複核標註｜版本級｜KPI/表｜研究｜衡量漏報｜同上｜否｜★★★★
26. **F1-score**｜P/R 調和平均｜2PR/(P+R)｜複核標註｜版本級｜KPI｜研究｜單一平衡分數｜掩蓋 P/R 取捨｜否｜★★★☆
27. **mAP**｜跨閾值平均精度｜AP over IoU/類別｜標註測試集｜版本級｜線圖｜研究｜模型整體性能｜需標準測試集，非線上即時值｜否｜★★★
28. **False Positive Rate**｜誤報率｜FP/(FP+TN)｜複核｜版本級｜KPI｜研究/維運｜評估雜訊（水流、垃圾晃動）｜TN 難定義｜否｜★★★
29. **False Negative Rate**｜漏報率｜FN/(FN+TP)｜複核｜版本級｜KPI｜研究｜低估風險來源｜需真值｜否｜★★★
30. **人工複核率 / Artificial Review Rate**｜被人工檢核比例｜複核數/總事件｜review 表｜週｜KPI｜研究/維運｜資料品保、可信度背書｜太低則品質存疑｜否｜★★★☆
31. **設備在線率 / Device Online Rate**｜正常回報設備比｜在線數/總數｜device heartbeat｜即時｜KPI Card｜維運/管理｜**失聯＝數據有缺口，直接影響所有指標可信度**｜需定義心跳逾時｜✅ 是｜★★★★
32. **電量 / Battery Level**｜剩餘電量｜裝置回報 %｜device 表｜即時｜Table/燈號｜維運｜派工換電｜老化估不準｜否（維運頁）｜★★★
33. **訊號強度 / Signal Strength**｜RSSI 等｜裝置回報｜device 表｜即時｜Table｜維運｜排除傳輸不良｜下水道遮蔽嚴重｜否｜★★★
34. **最後回報 / Last Seen**｜最後心跳｜max(heartbeat_at)｜device 表｜即時｜Table｜維運｜判斷失聯｜與 #31 併看｜否（維運頁）｜★★★☆
35. **上傳成功率 / Upload Success Rate**｜API 上傳成功比｜成功/嘗試｜api log｜每日｜KPI/Line｜維運｜資料完整性｜重試機制影響計算｜否｜★★★
36. **遮蔽/模糊/起霧 / Camera Tamper（occluded/blurred/foggy）**｜畫面品質異常｜邊緣消失率／清晰度門檻｜影像品質分析｜即時｜狀態燈號｜維運｜**遮蔽時偵測失效但系統仍「在線」，是隱形資料缺口**｜自動判定有誤判｜✅（狀態列）｜★★★★

---

## 成果 B：《推薦首頁 KPI（5–7 個）》

首頁遵循「認知負荷 5–9 項、倒金字塔、可行動優先」原則。精選 7 個：

1. **每 100 監測小時活動事件數（Events per 100 Monitoring Hours）** — 為何放：唯一能跨場域、跨時段公平比較的活動強度指標，修正了設備在線時間差異。管理者看到後：判斷整體鼠患活動水位、決定資源投向。數字來源：去重事件數 ÷ 有效監測小時。誤解風險：仍是相對活動指標，非老鼠數量，卡片須標「活動事件」。
2. **近 7 日趨勢方向（7-Day Trend，含環比箭頭）** — 為何放：管理最關心「變好還是變壞」。看到後：決定是否加強或收手。來源：daily events 移動平均。誤解：短期波動，需 7 日平滑。
3. **無鼠率 / RAR（對外報告）或活動高峰時段（對內營運）** — 為何放：RAR 是香港官方採用、正向易懂的對外指標；對內版可換成高峰時段以安排巡查投藥。看到後：對外溝通治理成效／對內排定勤務。來源：無鼠片段比／逐時 argmax。誤解：RAR 越高越好與直覺相反，需圖例說明。
4. **場域風險 TopN 排名** — 為何放：直接告訴管理者「今天先去哪」。看到後：派工優先序。來源：各場 Events/100h 排名。誤解：務必用標準化值排名。
5. **鼠患異常增加警示數（Active Anomaly Alerts）** — 為何放：突增是最需要立即行動的訊號。看到後：立即派員稽查該熱點。來源：Z-score/MAD 對滾動基線。誤解：假警報，需季節性基線。
6. **設備在線率（Device Online Rate）** — 為何放：失聯即資料缺口，是所有數字可信度的前提。看到後：先修設備再信數據。來源：心跳。誤解：需含遮蔽/起霧狀態，否則「在線但瞎了」。
7. **最近一次鼠隻活動時間（Last Activity Time）** — 為何放：回答「現在還在鬧嗎」。看到後：判斷介入後是否仍有活動。來源：最新事件時戳。誤解：單點非趨勢。

> 若嚴格砍到 5 個：保留 1、2、4、5、6（活動強度、趨勢、場域排名、異常警示、設備在線）。

---

## 成果 C：《不建議使用／容易誤導的 KPI》

1. **「今日偵測到 N 隻老鼠」/ Individual Rat Count** — 同一隻鼠重複經過、多 frame 重複計數，會嚴重高估；且無 Re-ID 無法算個體。**改用**「今日活動事件數（去重）」並明確標註非老鼠數。
2. **「鼠患密度 / Rat Density」** — 需族群量＋面積校正，需標記重捕；台灣官方亦承認難以準確估計。**不得使用**，除非未來導入 mark-recapture。
3. **「鼠群數量 / Rat Population」** — 同上，本系統無法推估絕對族群。
4. **原始 Detection Count（未去重）當對外數字** — 只能當內部除錯數據，對外一律用去重事件。
5. **把 AI Confidence 當「準確率」對外展示** — Confidence 是單框信心分數，高 confidence 仍可能是誤報（水流反光、垃圾晃動）。準確率須用 Precision/Recall/F1 搭配人工複核。
6. **自創無定義的「綜合風險指數 0–100」黑箱** — 違反可解釋原則。若要 Risk Score，必須公開公式、拆解構成項、與原始觀測值分開顯示。
7. **單一小時／單日事件數放首頁當主 KPI** — 雜訊大、受設備在線波動影響，易誤導。趨勢與標準化值才適合。
8. **跨場域直接比較原始事件數** — 未修正監測時長與相機視野差異，不公平。必須用 Events/100h 或 RAI。

---

## 成果 D：《Dashboard 前端規格草案》（可交付 Cursor / Claude Code）

### 技術棧建議
- 前端：React + TypeScript + 圖表庫（Recharts / ECharts；Heatmap 與地圖用 ECharts 或 deck.gl）。
- 後端：既有 API + PostgreSQL；時間序列聚合建議用物化視圖或 TimescaleDB 連續聚合。
- 全站顯示「資料最後更新時間」與「所用去重間隔 T」以建立信任。

### 使用者分層與頁面
**IA（資訊架構）**：Overview → Activity Analysis → Locations/Hotspots → Detection Events → Interventions → Devices → Model Performance。前 3 頁給第一層（環保局／市場管理者），Detection Events/Interventions 跨第一、二層，Devices 給第三層，Model Performance 給第二層。工程數據不進管理者首頁。

#### 頁面 1：Overview（總覽）
- 目的：30 秒內掌握「現在鼠患活動水位、走向、該先去哪、設備是否可信」。
- 主要使用者：環保局／市場管理者。
- KPI：成果 B 的 7 張卡。
- 圖表：7/30 日趨勢 Line、場域風險 TopN Bar、異常警示 list、迷你地圖熱點。
- 篩選：時間範圍、場域群組、鼠種（若模型支援）。
- 後端欄位：event(captured_at, location_id, is_independent)、device heartbeat、monitoring_hours 聚合、anomaly_flag。

#### 頁面 2：Activity Analysis（活動分析）
- 目的：回答何時最活躍、趨勢、節律。
- 使用者：管理者＋研究人員。
- 圖表：7×24 Heatmap（首圖）、逐時 Bar/KDE、每日 Line、夜間分布、事件持續時間 histogram。
- 篩選：時間、場域、鼠種、去重間隔 T（研究模式可調）。
- 後端：event(captured_at, event_start, event_end, location_id)、日出日落表。

#### 頁面 3：Locations / Hotspots（場域熱點）
- 目的：空間定位與跨場比較。
- 使用者：管理者。
- 圖表：地圖（點大小＝Events/100h、色＝風險等級）、場域排名 Bar、場域明細 Table。
- 篩選：行政區、場域類型（市場／夜市／水溝／人孔／垃圾點）、時間。
- 後端：location(lat, lng, type, district)、各場 Events/100h、risk_level 與構成項。

#### 頁面 4：Detection Events（事件明細）
- 目的：可回溯、可人工複核。
- 使用者：研究／維運。
- 圖表：Event Timeline、事件表（縮圖、confidence、tracking_id、duration、max_simultaneous、review_status）、影像/短片檢視。
- 篩選：時間、場域、confidence 範圍、review_status、鼠種。
- 後端：event 全欄位＋image_url/clip_url＋detection 明細。

#### 頁面 5：Interventions（介入成效）
- 目的：投藥／封堵／清潔前後對照、防除率。
- 使用者：管理者。
- 圖表：介入前後 Line（含介入時間標記）、防除率 KPI、介入清單 Table。
- 篩選：介入類型、場域、時間。
- 後端：intervention(type, location_id, start_at, end_at, note)、前後事件聚合。

#### 頁面 6：Devices（設備維運）
- 目的：確保資料完整。
- 使用者：工程維運。
- 圖表：設備 Table（online/offline 燈號、battery、signal、last_seen、upload_success、storage、firmware、device_temperature、遮蔽/模糊/起霧狀態）、失聯地圖。
- 篩選：場域、狀態、韌體版本。
- 後端：device、heartbeat、api_upload_log、image_quality。

#### 頁面 7：Model Performance（模型效能）
- 目的：模型品保、版本比較。
- 使用者：研究人員。
- 圖表：Precision/Recall/F1/mAP 卡與趨勢、confidence 分布、FP/FN 範例牆、人工複核率、model_version 對比。
- 篩選：model_version、時間、場域。
- 後端：review 標註、model_version、metric 聚合。

### 後端 PostgreSQL Schema（成果十：由前端反推）

**device 表**
- 必要：device_id(PK), location_id(FK), status, last_seen_at, firmware_version, model_version
- 建議：battery_level, signal_strength(rssi), device_temperature, storage_free, install_at
- 未來：solar_input, lorawan_gateway_id

**location 表**
- 必要：location_id(PK), name, type(market/night_market/drain/manhole/garbage/other), district, lat, lng
- 建議：description, install_photo_url, risk_level(cached), field_of_view_note
- 未來：administrative_owner, contact

**monitoring_session / uptime 表（計算監測小時的關鍵）**
- 必要：session_id(PK), device_id, start_at, end_at, effective_seconds
- 建議：downtime_reason(offline/tamper/battery)
- 說明：Events/100h、RAI、RAR 全靠這張表提供分母，**必要**。

**event 表（去重後的活動事件，核心）**
- 必要：event_id(PK), device_id, location_id, event_start, event_end, captured_at, tracking_id, is_independent(bool), independence_interval_sec(記錄所用 T), detected_species(nullable), max_simultaneous_count, mean_confidence, model_version, review_status(pending/confirmed/rejected), thumbnail_url
- 建議：direction(line-crossing), clip_url, duration_sec(generated), night_flag
- 未來：reid_cluster_id（若日後導入 Re-ID）

**detection 表（frame 級原始，供除錯與複核）**
- 必要：detection_id(PK), event_id(FK), frame_ts, bbox, confidence
- 建議：class_id, image_url
- 未來：thermal_temp

**intervention 表**
- 必要：intervention_id(PK), location_id, type(baiting/sealing/cleaning/trapping), start_at, end_at
- 建議：operator, note, pre_events, post_events, control_rate(generated)
- 未來：cost, chemical_id

**review 表（人工複核，供 P/R/F1）**
- 必要：review_id(PK), event_id, reviewer, ground_truth(bool_rat), reviewed_at
- 建議：note, corrected_species
- 未來：inter_rater_id

**anomaly / alert 表**
- 必要：alert_id(PK), location_id, type(spike/device_offline/tamper), triggered_at, metric_value, baseline_value, z_score, status(open/ack/closed)
- 建議：resolved_at, handler

**model_metric 表**
- 必要：metric_id(PK), model_version, dataset_ref, precision, recall, f1, map, evaluated_at
- 建議：fp_rate, fn_rate, confusion_matrix_url

---

## Recommendations（建議與階段路線）

**如果明天只能先做一個 Prototype，一定要先做的：**
1. **穩固的 Event 去重管線**（ByteTrack＋3 分鐘靜默間隔）與 `event`、`monitoring_session` 兩張表——沒有這兩者，之後所有指標都不可信。
2. **Overview 首頁 3 張卡**：每 100 監測小時活動事件數、7 日趨勢、設備在線率。
3. **7×24 Heatmap** 與 **場域 TopN Bar**（Activity Analysis 與 Locations 的最小版）。
4. **事件明細表＋縮圖＋review_status**（Detection Events 最小版），讓數據可回溯、可人工背書。

**可以完全先不做的（Prototype 階段跳過）：**
- mAP/FP/FN 完整模型效能頁（先只存 confidence 與人工複核率即可）。
- 個體 Re-ID、族群量、密度（本階段科學上不成立，直接不做）。
- 進階地圖熱力（deck.gl）、KDE 節律曲線（先用長條）。
- 完整 Interventions 自動防除率（先手動標記介入時間即可）。
- Battery/Signal/Storage/Firmware 完整維運頁（先只做 online/offline＋last_seen）。

**階段路線與升級門檻：**
- 階段 1（0–1 月）：去重管線＋Overview＋事件明細。門檻：去重後事件數與人工抽查一致率 >90% 再往下走。
- 階段 2（1–3 月）：Activity Analysis＋Locations＋異常警示（先 Z-score 固定門檻）。門檻：累積 ≥4 週資料後才啟用滾動基線與星期×時段季節性。
- 階段 3（3–6 月）：Interventions 防除率、Model Performance（P/R/F1）、對外 RAR 報表。門檻：完成場域校正的 T 值與監測時數稽核後，才對外發布可比數字。
- 階段 4（6 月+）：多場域跨區比較、風險分級公式公開化、（若研究需求）評估導入 Re-ID 或標記重捕以觸及「族群量」層級。

**與外部標準對齊的建議：** 對外溝通優先採 FEHD 式「無鼠率／活動事件率」正向表述，並在方法頁揭露監測時數、去重間隔、模型版本與人工複核率；投藥成效沿用台灣官方「防除率 ≥80%」語彙。

---

## Caveats（限制與注意）

1. **本系統量化「活動」，不量化「數量」。** 所有指標命名與對外文案須嚴守此界線，否則會誤導決策與公眾。
2. **Events/100h、RAI、RAR 都是相對指標**，只有在偵測機率一致（相機位置、視野、光線可比）時才有比較意義；不同場域鏡頭條件差異會系統性偏誤，需在方法頁揭露。
3. **去重間隔 T 沒有唯一正解**，1 分／3 分／5 分會給出不同事件數。文獻中溝鼠 30 秒、屋頂鼠 5 分、黑鼠 15 分並存；本報告採 3 分鐘為工程預設值，屬「產品設計建議」而非文獻唯一標準，須在自家資料上校正。
4. **AI 效能數字必須在下水道／市場實地資料重新驗證**，不能引用 MegaDetector 或他人論文的準確率；低光、起霧、水流反光、垃圾晃動都會拉高誤報。
5. **「在線」不等於「看得見」**：相機遮蔽／起霧時裝置仍回報在線，卻產生資料缺口，必須以 tamper 狀態一併呈現，否則 RAR 會虛高（誤以為無鼠）。
6. **鼠隻繁殖快、易反彈**，投藥後短期降幅（如 80%）可能數週內回升；成效指標須持續追蹤而非一次性宣稱。
7. **香港「無鼠率越高越好」與直覺相反**，若採用須在 UI 明確圖例，避免管理者誤讀為「鼠越多」。
8. **文獻指標 vs 產品建議之區分**：RAI、RAR、防除率、30 秒／5 分／15 分間隔、Precision/Recall/F1/mAP 為文獻或政府既有定義；「3 分鐘複合去重定義、7 張首頁卡、風險分級規則、schema」為本報告針對本專案提出的產品設計建議，兩者已分開標示。
9. 部分商業系統（Anticimex、Rentokil）宣稱之成效（如「快 2 倍」「減 60% 藥餌」）為廠商自述行銷數據，非獨立同行評審結果，引用時應標明來源性質。