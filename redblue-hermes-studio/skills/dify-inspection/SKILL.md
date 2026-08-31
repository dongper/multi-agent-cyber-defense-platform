---
name: dify-inspection
description: Inspect a self-hosted Dify instance to extract app architecture, model configurations, embedding settings, and dataset retrieval parameters. Combines Docker inspection, UI navigation, and PostgreSQL queries.
---

## When to use
- User asks what a Dify app/agent does or how it's configured
- User requests a technical stack audit of a Dify deployment
- Need to extract exact embedding models, retrieval thresholds, or LLM configs that aren't fully visible in the UI

## Step-by-step

### 1. Docker Recon
```bash
docker ps --format '{{.Names}}: {{.Ports}}' | grep docker-
```
Look for `docker-api-1`, `docker-web-1`, `docker-db_postgres-1`, `docker-weaviate-1`, etc.

### 2. Find Project Root
```bash
docker inspect docker-api-1 --format '{{index .Config.Labels "com.docker.compose.project.working_dir"}}'
```
This gives the local path to the Dify project (contains `.env` and `docker-compose.yml`).

### 3. Check .env for Baseline Config
Read `<project-root>/docker/.env` to find:
- `VECTOR_STORE` (e.g., weaviate, qdrant, milvus)
- `DB_HOST`, `DB_USERNAME`, `DB_PASSWORD`
- Model provider keys or URLs

### 4. Query PostgreSQL for Detailed Configs
```bash
docker exec docker-db_postgres-1 psql -U postgres -d dify -c "<SQL>"
```

**Key SQL queries:**
- Providers enabled:
  `SELECT provider_name FROM providers;`
- Datasets with embedding & retrieval config:
  `SELECT id, name, indexing_technique, embedding_model, embedding_model_provider, retrieval_model FROM datasets;`
- App-to-dataset mappings:
  `SELECT app_id, dataset_id FROM app_dataset_joins;`
- App names:
  `SELECT id, name, mode FROM apps;`

### 5. UI Verification (Optional but Recommended)
- Navigate to `http://localhost` (or configured `CONSOLE_WEB_URL`)
- Log in if needed
- Open the target app's workflow canvas to see node types, model names, and branching logic
- Check Knowledge Base page for dataset indexing modes (`high_quality` vs `economy`)

### 6. Compile Tech Stack Report
Format output as:
- Input data source format & preprocessing
- Language / Framework
- Models (LLM, Embedding, Reranking, Provider)
- Key libraries & infra (Vector DB, Postgres, Redis, Celery)
- External tools / API calls
- Deployment & publishing method

## Pitfalls
- Dify's UI hides exact embedding model names and retrieval thresholds — DB queries are required for precision
- Container names may vary if deployed outside default Docker Compose (look for `dify` or `langgenius` in image names)
- `.env` may use placeholders; actual model credentials are stored encrypted in `provider_credentials` table
- `retrieval_model` column stores JSON with `top_k`, `score_threshold`, `reranking_enable`, etc. — parse it carefully