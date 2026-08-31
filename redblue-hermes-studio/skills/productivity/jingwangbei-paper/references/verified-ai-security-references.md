# Verified AI + Security References (2020-2026)

Pre-verified references for 京网杯 papers on AI security, multi-agent systems, and LLM safety. All verified via CrossRef/OpenAlex on 2026-06-07.

## LLM Fundamentals (safe to cite)

| # | Reference | Venue | DOI/ID |
|---|-----------|-------|--------|
| 1 | Vaswani A et al. Attention is all you need | NeurIPS 2017 | arXiv:1706.03762 |
| 2 | Wei J et al. Chain-of-thought prompting elicits reasoning in LLMs | NeurIPS 2022 | 10.52202/068431-1800 |
| 3 | Ouyang L et al. Training LMs to follow instructions with human feedback (InstructGPT) | NeurIPS 2022 | 10.52202/068431-2011 |
| 4 | Hu E J et al. LoRA: Low-rank adaptation of LLMs | ICLR 2022 | arXiv:2106.09685 |
| 5 | Dettmers T et al. QLoRA: Efficient finetuning of quantized LLMs | NeurIPS 2023 | 10.52202/075280-0441 |

## LLM Agents & Multi-Agent Systems

| # | Reference | Venue | DOI/ID |
|---|-----------|-------|--------|
| 6 | Yao S et al. ReAct: Synergizing reasoning and acting in LMs | ICLR 2023 | arXiv:2210.03629 |
| 7 | Schick T et al. Toolformer: LMs can teach themselves to use tools | NeurIPS 2023 | 10.52202/075280-2997 |
| 8 | Wu Q et al. AutoGen: Enabling next-gen LLM apps via multi-agent conversation | ICLR 2024 | arXiv:2308.08155 |

## LLM Safety & Security

| # | Reference | Venue | DOI/ID |
|---|-----------|-------|--------|
| 9 | Fang R et al. Teams of LLM agents can exploit zero-day vulnerabilities | EACL 2026 | 10.18653/v1/2026.eacl-long.2 |
| 10 | Carlini N et al. Extracting training data from LLMs | USENIX Security 2021 | arXiv:2012.07805 |
| 11 | Wei A, Haghtalab N, Steinhardt J. Jailbroken: How does LLM safety training fail? | NeurIPS 2023 | 10.52202/075280-3508 |
| 12 | Ji Z et al. Survey of hallucination in NLG | ACM Computing Surveys 2023 | 10.1145/3571730 |

## RAG & Knowledge-Augmented Systems

| # | Reference | Venue | DOI/ID |
|---|-----------|-------|--------|
| 13 | Lewis P et al. Retrieval-augmented generation for knowledge-intensive NLP | NeurIPS 2020 | arXiv:2005.11401 |

## Security-Specific Multi-Agent

| # | Reference | Venue | DOI/ID |
|---|-----------|-------|--------|
| 14 | Huang J, Zhu Q. PenHeal: A two-stage LLM framework for automated pentesting and optimal remediation | arXiv 2024 | arXiv:2407.17788 |

## Industry Reports (for problem motivation)

| Report | Year | Key Stats |
|--------|------|-----------|
| IBM Cost of a Data Breach | 2024 | Avg cost $4.88M, MTTD 197 days, MTTR 69 days |
| CrowdStrike Global Threat Report | 2024 | Avg breakout time 62 minutes |
| Ponemon SOC Report | 2022-2023 | ~4,484 alerts/day, 45-55% false positives |
| 中国信通院 网络安全白皮书 | 2023 | 中国市场规模 >800亿元 |

## Known-Fake References (DO NOT USE)

| Fake Reference | Problem |
|----------------|---------|
| Elabd M et al. PenHeal... arXiv:2409.16076 | FAKE — that arXiv ID is a physics paper. Correct ID is 2407.17788 |
| Any reference citing "ICLR 2025" for the zero-day paper | WRONG — should be EACL 2026 |
