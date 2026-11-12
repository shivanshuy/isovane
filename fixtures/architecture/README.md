# Architecture test diagrams

Upload these in **Analyze → Architecture** to exercise privacy / workflow findings on the editable board playground.

## How to use

1. Open a workspace → **Architecture**
2. Choose mode:
   - **Deployment / network** for `01`, `03`, `04`, `06`
   - **Workflow graph** for `02`, `05`, `07`
3. Upload the matching `.png` / `.jpg` (preferred), or paste `.puml` / Mermaid

### Board playground loop

1. **Recreate** — PNG/JPG upload runs vision and rebuilds boxes + arrows as closely as possible
2. **Correct** — if extraction missed a box/arrow, drag, connect ports, rename, delete, or add from the palette
3. **Fix issues** — change the diagram itself to remediate findings (add HITL, cut shell-from-chat, pin MCP, add DLP/ZDR…)
4. **Analyze board** — sends the edited **Structurizr/C4 workspace** through the same risk analysis and refreshes findings

The point of the playground is not only to mirror the image — it is to **fix architecture issues by working on the diagram**.

## Conversion loop (Structurizr / C4)

One model object travels the whole path. The board is a view; the LLM sees the same workspace.

```
diagram (PNG / PlantUML / Mermaid)
        │  arc_image_extract (vision) → OCR → seed
        ▼
Structurizr workspace          ← source of truth
  model.people / softwareSystems / relationships
  tags + properties.kind = ui|agent|mcp|tool|llm|data|hitl
  views.systemLandscapeViews   ← x,y for the board
        │
        ▼
playground board               ← edit boxes/arrows/kinds
        │  Analyze board
        ▼
same Structurizr workspace     ← boardToArchitectureGraph / normalize
        │  arc_image_analyze
        ▼
risk LLM (or rules fallback)   ← findings
        │  user fixes on board
        ▼
updated Structurizr → LLM again
```

Kinds are **C4 tags** (standard Structurizr extension), not a proprietary schema. HITL maps to `Person`; everything else is a `Software System` with an Isovane tag.

## Image vision (PNG/JPG)

```yaml
ollama:
  arc_image_extract: llava               # PNG → boxes/arrows (qwen2.5vl:3b also OK; avoid llama3.2-vision/mllama)
  arc_image_analyze: llama3.1:8b       # Structurizr workspace → findings (LLM first)
```

1. **Extract** — vision → OCR → filename seed → Structurizr workspace  
2. **Analyze risks** — `arc_image_analyze` on that workspace first; if it fails, rule catalog + banner  
3. **Privacy posture** — inventory includes `privacy_posture` (vendors, sinks, HITL/DLP gaps) from the same C4 model  

`ollama pull llava` (or `qwen2.5vl:3b`). OCR fallback: `poetry install -E ocr` + Tesseract on PATH.  
Switch to OpenAI with `MODEL_PROVIDER: openai` and `OPENAI_API_KEY` for cloud extract/analyze.

## Files

| File | Mode | What it should surface |
|------|------|------------------------|
| `01-privacy-multi-cloud-egress.puml` + `.png` | Deployment | Multi-vendor LLM egress, PII without DLP, missing ZDR, LangSmith logging |
| `02-workflow-agentic-no-hitl.puml` + `.png` | Workflow | UI→agent→tools without HITL, A2A without auth, MCP, wildcard tools |
| `03-rag-mixed-trust-deploy.puml` + `.png` | Both | Public→RAG→private→email trust-boundary / mail path |
| `04-safer-baseline-hitl-zdr.puml` + `.png` | Deployment | Contrast case — DLP, HITL, EU Azure OpenAI ZDR (fewer / milder issues) |
| `05-mcp-supply-chain-deploy.puml` + `.png` | Workflow | Unpinned MCP, shell from chat, A2A, observability sink |
| `06-privacy-multi-cloud-image.jpg` | Deployment | Image upload path (filename-seeded analysis) |
| `07-workflow-agentic-image.jpg` | Workflow | Image upload path (filename-seeded analysis) |
| `08-boundaries-multi-cloud.puml` + `.png` | Deployment | **Boundary test** — Org VPC + OpenAI/Anthropic/LangSmith clouds with clear containment |
| `09-boundaries-trust-vpc.puml` + `.png` | Both | **Boundary test** — Public cloud + Trust DMZ + Private VPC |
| `10-boundaries-cross-cloud-egress.puml` + `.png` | Deployment | **Boundary test** — cross-border Orch→OpenAI / Datadog egress |

## Boundary playground test (08–10)

Use these to verify drawn **Cloud / Trust / VPC** regions are sent to the LLM with correct `contains_labels`.

### A) Paste PlantUML (rules / text path)

1. Mode: **Deployment / network**
2. Paste `08-boundaries-multi-cloud.puml` (or 09 / 10) → **Analyze architecture**
3. On the board, draw matching boundaries around the same groups:
   - **08:** `Org VPC (EU)`, `OpenAI Cloud (US)`, `Anthropic Cloud (US)`, `Observability SaaS`
   - **09:** Public cloud, Trust zone (DMZ), Private VPC
   - **10:** Acme Corp, Azure OpenAI, OpenAI US, Datadog
4. Put clouds **Send back**, tweak labels, **Analyze board**
5. Check findings mention cross-cloud / residency; in network tab confirm request body has `boundaries` / `deploymentNodes` with `contains`

### B) Upload PNG (vision + board path)

1. Upload `08-boundaries-multi-cloud.png` (or 09 / 10)
2. Correct boxes if vision missed any
3. Draw the same named boundaries around groups (palette → **Draw Cloud / Trust / VPC**)
4. **Analyze board** — payload should include e.g. `OpenAI Cloud` contains `GPT-4o endpoint`

Expected containment (08):

| Boundary | Should contain |
|----------|----------------|
| Org VPC (EU) | Chat UI, Customer PII DB, Agent API |
| OpenAI Cloud (US) | GPT-4o endpoint |
| Anthropic Cloud (US) | Claude endpoint |
| Observability SaaS | LangSmith traces |

Also useful: existing `01-privacy-multi-cloud-egress.png` already draws Org VPC + vendor clouds — redraw those as playground Boundaries after extract.

## Re-render PlantUML → PNG

```powershell
# from fixtures/architecture, with Java installed
Invoke-WebRequest https://github.com/plantuml/plantuml/releases/download/v1.2024.8/plantuml-1.2024.8.jar -OutFile plantuml.jar
java -jar plantuml.jar -tpng 08-boundaries-multi-cloud.puml 09-boundaries-trust-vpc.puml 10-boundaries-cross-cloud-egress.puml
# or all: java -jar plantuml.jar -tpng *.puml
```
