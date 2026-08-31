# 中文参考文献验证指南

## Why This Matters

AI models are **very good** at generating plausible-sounding but completely fabricated Chinese academic references. A paper with fake references will be rejected or cause embarrassment. Every reference must be verified before inclusion.

## Fake Reference Anti-Patterns

Learned from verifying 30+ references across multiple papers. AI-generated fake references share these特征:

### Chinese Fake References (最常见)
- **Author names**: Two or three extremely common Chinese surnames (张磊, 刘军, 李明, 王强, 赵刚, 陈国良, 周傲英)
- **Title**: Reads like a mirror of the paper's own topic — if the paper is about "大数据平台割接", the fake ref will be titled something like "大数据平台迁移方法论研究"
- **Journal**: A real, prestigious Chinese journal (通信学报, 电子与信息学报, 电信科学, 软件学报, 计算机研究与发展)
- **Volume/Issue/Pages**: Plausible but unverifiable numbers
- **Red flag**: If 3+ of these signals present, treat as suspicious until verified

### English Fake References
- **Author names**: Generic Western names (Chen Y, Zhang H, Li X; Wang X, Li Y, Zhang Z)
- **Title**: A "survey" or "approach" paper that perfectly matches the topic
- **Journal**: IEEE top journals (IEEE TWC, IEEE CS&T, IEEE Network) — makes it sound authoritative
- **Pages**: Sometimes anomalously high (e.g., pages 2456-2489 in IEEE CS&T)
- **Red flag**: Two survey papers on similar topics with generic authors

### Key Insight: Application vs. Foundation References
From experience: AI fabricates **application-domain** references far more than **foundational method** references. Classic ML/RL papers (GPT-3, Hinton distillation, LightGBM, FedAvg, MADDPG, COMA) are almost always real. References about the specific application domain (应急通信, 割接迁移, 卫星通信) are the ones to scrutinize hardest.

## Verification Workflow

### Step 1: Triage — Classify Each Reference

| Category | Action |
|---|---|
| Classic/landmark papers (GPT-3, Hinton, MapReduce, GFS, LightGBM) | Mark as REAL immediately |
| Official documentation (Apache Doris, Spark docs) | Check URL is live |
| Government documents (国务院规划, 地方条例) | Verify on gov.cn or known archive |
| Chinese journal papers with common surnames | **MUST verify** — highest risk |
| English papers in IEEE/ACM with generic authors | **MUST verify** via CrossRef |

### Step 2: Search Strategy by Source Type

**For English papers** — use CrossRef API:
```
https://api.crossref.org/works?query=<title keywords>&rows=3&select=title,author,container-title,volume,issue,page,DOI
```
- Returns JSON with authoritative metadata
- Check: title match, author family names, journal name, volume/issue/pages
- Works well for IEEE, ACM, Springer, Elsevier papers

**For Chinese papers** — use 360搜索 (so.com):
```
https://www.so.com/s?q="%E8%AE%BA%E6%96%87%E5%AE%8C%E6%95%B4%E6%A0%87%E9%A2%98"
```
- Use exact-match quotes around the full title
- 360搜索 handles Chinese character boundaries correctly (unlike Bing)
- No aggressive captcha (unlike Baidu/Baidu Scholar)
- Look for CNKI (知网), Baidu Scholar, or journal official site results

**Avoid for Chinese searches**:
- **Bing**: Splits Chinese characters into individual字, returns dictionary entries instead of papers
- **Baidu/Baidu Scholar**: Aggressive captcha from automated access
- **CNKI direct**: Aggressive captcha
- **Google Scholar**: Often times out from China

**For landmark/classic papers** — use OpenAlex API:
```
https://api.openalex.org/works?search=<title>&per_page=3
```
- Good English coverage, poor Chinese coverage
- Returns DOI, authors, venue, year

### Step 3: Cross-Check References Against Text

After verification, run a cross-check:
1. Every reference in the list should be cited at least once in the text
2. Every `[N]` in the text should correspond to a reference in the list
3. No orphan references (in list but not cited) — reviewers notice these
4. No dangling citations (cited in text but not in list)

### Step 4: Replace Unverifiable References

When a reference cannot be verified:
1. Identify what **topic** it covers (the context where it's cited in text)
2. Find a **real** paper on the same topic using the search strategies above
3. Ensure the replacement is from a **verifiable** source (government doc, classic paper, official documentation, confirmed journal article)
4. Update both the reference list AND the text citation
5. Renumber all references and citations if the count changed

**Renumbering pitfall**: When remapping reference numbers (e.g., [12]→[11] and [15]→[13]), process in **descending** order of old number to avoid collisions.

## Known-Good Replacement Sources

For common topics in Chinese telecom/big-data papers, these are verified real:

### Policy & Standards
- 国务院. "十四五"数字经济发展规划[S]. 2022. ✅
- 工信部. 大数据产业发展规划(2021—2025年)[R]. 2021. ✅
- 北京市经济和信息化委员会. 北京市数字经济促进条例[S]. 2022. ✅
- 中国信息通信研究院. 大数据白皮书(2023年)[R]. 2023. ✅

### Classic CS/Big Data Papers
- Dean J, Ghemawat S. MapReduce[C]//OSDI 2004. ✅
- Ghemawat S, et al. The Google File System[C]//SOSP 2003. ✅
- Armbrust M, et al. Lakehouse[C]//CIDR 2021. ✅
- Kimball R, Ross M. The Data Warehouse Toolkit[M]. 3rd ed. Wiley, 2013. ✅
- Inmon W H. Building the Data Warehouse[M]. 4th ed. Wiley, 2005. ✅

### Classic ML/AI Papers
- Brown T, et al. Language models are few-shot learners (GPT-3)[C]//NeurIPS 2020. ✅
- Hinton G, et al. Distilling the knowledge in a neural network[J]. arXiv:1503.02531, 2015. ✅
- Ke G, et al. LightGBM[C]//NeurIPS 2017. ✅
- McMahan B, et al. FedAvg[C]//AISTATS 2017. ✅
- Lowe R, et al. MADDPG[C]//NeurIPS 2017. ✅
- Foerster J, et al. COMA[C]//AAAI 2018. ✅
- Abadi M, et al. Deep learning with differential privacy[C]//CCS 2016. ✅
- Romero A, et al. FitNets[C]//ICLR 2015. ✅
- Li T, et al. FedProx/FOpt[C]//MLSys 2020. ✅

### ML/AI Surveys & Multi-Agent RL (verified this session)
- Nguyen T T, et al. Deep Reinforcement Learning for Multiagent Systems: A Review[J]. IEEE TCyb, 2020, 50(9): 3826-3839. DOI: 10.1109/tcyb.2020.2977374. ✅
- Yu C, Velu A, et al. The surprising effectiveness of PPO in cooperative multi-agent games (MAPPO)[C]//NeurIPS 2022. ✅
- Zhang J, Zheng Y, Qi D. Deep Spatio-Temporal Residual Networks for Citywide Crowd Flows Prediction (ST-ResNet)[C]//AAAI 2017: 1521-1527. DOI: 10.1609/aaai.v31i1.10735. ✅
- Yu B, Yin H, Zhu Z. Spatio-Temporal Graph Convolutional Networks (ST-GCN)[C]//IJCAI 2018. ✅
- Kairouz P, McMahan H B, et al. Advances and open problems in federated learning[J]. F&T in ML, 2021, 14(1-2): 1-210. ✅

### LLM-Specific (verified this session)
- Touvron H, et al. LLaMA: Open and efficient foundation language models[J]. arXiv:2302.13971, 2023. ✅
- Hu E J, et al. LoRA: Low-rank adaptation of large language models[C]//ICLR 2022. ✅
- Li X, Tramèr F, Liang P. Large language models can be strong differentially private learners[C]//ICLR 2022. ✅
- Gou J, Yu B, Maybank S J. Knowledge distillation: A survey[J]. IJCV, 2021, 129(6): 1789-1819. ✅

### Documentation
- Apache Doris: https://doris.apache.org ✅
- Apache Spark SQL: https://spark.apache.org/docs/latest/sql-programming-guide.html ✅

### Chinese Textbooks (verified)
- 严蔚敏, 吴伟民. 数据结构(C语言版)[M]. 清华大学出版社, 2012. ✅
- Ramakrishnan R, Gehrke J. Database Management Systems[M]. 3rd ed. McGraw-Hill, 2003. ✅
