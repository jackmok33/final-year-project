# Assessment code

Each specialist owns its active prompt and rubric. `shared/` contains mechanics
used by several specialists, and `flow/` owns the complete workflow and its jobs.

```text
assessments/
  academic/
    academic-v1.md                Academic instructions
    rubric-v1.json                Academic criterion weights and levels
  cv/
    cv-v1.md                      Active CV instructions
    rubric-v1.json                Active CV criterion weights and levels
  statement/
    statement-v1.md               Personal-statement instructions
    rubric-v1.json                Statement criterion weights and levels
  references/
    references-v1.md              Reference instructions
    rubric-v1.json                Reference criterion weights and levels
  english_test/
    ielts-academic-v1.md          IELTS extraction instructions
    graph.py                      Preparation, extraction and validation graph
    schemas.py                    Report schemas and deterministic eligibility rule
    pdf_page.py                   English report rendering and score-area cropping
    config.py, jobs.py,
    worker.py                     Standalone English-check configuration and jobs
  shared/
    contracts.py                  Criteria, judgements and source evidence schemas
    documents.py                  Immutable original-document input
    specialist.py                 Shared extract, verify, judge and score execution
    rubrics.py                    Load each scored agent's prompt and rubric
    rubric-context-v1.json        Shared rubric version, demo status and capabilities
    pdf_preparation.py            Bounded child processes, page encoding and rendering
    pdf_pages.py                  Bounded page preparation for scored specialists
    prompts/                      Shared extraction and judgement instructions
  flow/
    orchestrator.py               Sequential LangGraph and aggregate scoring/routing
    summary-v1.md                 Overall qualitative summary instructions
    schemas.py                    Workflow version and summary response schema
    config.py                     Synthetic allowlist and workflow fingerprint
    jobs.py                       Owned queue, leases and atomic result persistence
    worker.py                     Process full assessments and standalone English checks
  review.py, review_routes.py     Saved assessments, corrections and tutor decisions
  mock.py, routes.py,
  schemas.py                      Separate legacy presentation-fixture API
```

## Following an assessment

`review_routes.py` queues a full assessment through `flow/jobs.py`. The worker
loads its pinned documents and course criteria, then invokes the orchestrator.
Academic, CV, statement and references each use `SectionWorkflow` in
`shared/specialist.py` with their own prompt and rubric. This keeps evidence
verification and score arithmetic consistent without duplicate Python
implementations for every agent. The English
agent keeps its specialised report schema and eligibility graph.

For each scored agent, its Markdown instructions are combined with the shared
extraction or judgement instructions. Its JSON rubric contains criterion weights
and explicitly numbered levels. The shared rubric context supplies the demo
version and general capability list. Programme weights and admission thresholds
remain versioned course criteria in PostgreSQL; they are separate from the
weights within an agent's rubric.

The orchestrator collects section results and the separate English eligibility
check. Python calculates the overall score and routes the recommendation. Qwen
generates the qualitative summary. The job saves the completed result with source,
model, rubric and prompt provenance before the frontend reads it.

## Active agent assets

The full workflow has one active CV implementation. Edit `cv/cv-v1.md` and
`cv/rubric-v1.json` to change its specialist instructions and rubric.

The earlier two-agent Python workflow and its developer preview were retired.
Use `python -m tests.full_assessment_preview` from `backend/` for the current
five-agent preview. Add `--live` only when deliberately testing against Qwen.
The worker command remains `python -m app.assessments.flow.worker`.

The workflow fingerprint hashes logical prompt contents and the assembled rubric
bundle. Moving these assets between folders preserves the fingerprint; changing
an active prompt or rubric changes it. Restart the worker after editing active
assets so queued inputs and the loaded workflow agree. Original PDFs, prior
assessment histories and database/API contracts are unaffected by this layout.
