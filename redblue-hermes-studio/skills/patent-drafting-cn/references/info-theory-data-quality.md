# Information Theory → Data Quality Engineering Mapping

Reusable reference for patent drafting when combining information theory concepts
with data quality management. These mappings turn abstract theory into patentable
technical solutions.

## Core Concept Mappings

| Information Theory | Data Quality Application | Patent Angle |
|---|---|---|
| **Information Entropy H(X)** | Field value distribution uncertainty | Quality baseline metric — higher entropy = more chaotic data |
| **KL Divergence D_KL(P\|\|Q)** | Deviation from ideal/expected distribution | Quality deviation score — measurable distance from "good" state |
| **Mutual Information I(X;Y)** | Cross-field/cross-source consistency | Automated consistency detection without predefined rules |
| **Joint Entropy H(X,Y)** | Multi-field dependency modeling | Detects when field relationships break down |
| **Conditional Entropy H(X\|Y)** | Unexplained variance given known dependencies | Alternative quality metric for dependent fields |
| **Rate-Distortion R(D)** | Repair cost vs. quality loss trade-off | **Core innovation**: optimize repair strategy under cost constraints |
| **Channel Capacity C** | Maximum tolerable error rate in data pipeline | Business-level quality SLA definition |
| **Cross-Entropy H(P,Q)** | Model output vs. ground truth distribution | ML model data quality impact measurement |
| **Jensen-Shannon Divergence** | Symmetric, bounded distribution comparison | Numerically stable alternative to KL divergence |
| **Fisher Information** | Parameter estimation precision | Data quality impact on downstream model accuracy |

## Rate-Distortion Theory Migration Pattern

This is the strongest cross-domain migration pattern for patents:

**Original (Signal Compression):**
> Given maximum acceptable distortion D, find minimum encoding rate R(D).

**Patent Mapping (Data Quality):**
> Given maximum acceptable repair cost C, find minimum quality loss L(C).

**Cost Function Design:**
```
J = β · IG_repair - γ · C_repair - δ · R_risk

where:
  IG_repair = H_before - H_after  (information gain from repair)
  C_repair = C_compute + C_manual  (total repair cost)
  R_risk = P(error_introduction) × impact_severity  (risk cost)
```

**Why this works for patents:**
1. Rate-distortion theory is mature and well-established — no novelty challenge
2. The migration to data quality repair is NOT in existing patents
3. The cost function provides a concrete, verifiable technical solution
4. Examiners respect mathematical frameworks from established theories

## Entropy Calculation Patterns by Data Type

| Data Type | Entropy Method | Notes |
|---|---|---|
| Categorical | H(X) = -Σ p(x)·log₂p(x) | Direct calculation |
| Numerical (discrete) | Same as categorical | Bin if too many unique values |
| Numerical (continuous) | Differential entropy or discretize | Gaussian assumption for ideal distribution |
| Text | Token-level or character-level entropy | Tokenize with domain-specific vocabulary |
| Time series | Sliding window entropy | Track entropy over time for drift detection |

## Useful Formulas for Patent Writing

```
Quality deviation:    Q = α·H_norm + (1-α)·D_KL_norm

Mutual information:   I(X;Y) = H(X) + H(Y) - H(X,Y)

Consistency anomaly:  ΔI = |I_current - I_baseline| / I_baseline

Cost function:        J = β·IG - γ·C - δ·R

Optimal strategy:     k* = argmax_k J(k)

Weight update:        β_{t+1} = β_t + η·∂(business_benefit)/∂β
```
