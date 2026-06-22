# Enterprise PRD - Impeachment Intelligence Platform (IIP)

## Executive Summary
The Impeachment Intelligence Platform (IIP) is an AI-powered investigative intelligence system that transforms impeachment-related documents, hearings, statements, court records, and media coverage into an interactive knowledge graph with natural language querying.

---

# Product Vision

Create the most comprehensive, explainable, and evidence-backed political intelligence platform in the Philippines.

## Core Capabilities

- Continuous document ingestion
- Knowledge graph construction
- Natural language question answering
- Interactive graph exploration
- Timeline reconstruction
- Evidence mapping
- Senator intelligence dashboards
- Narrative generation
- Contradiction detection
- Media comparison

---

# System Architecture

## Data Sources

### Government Sources
- House of Representatives
- Senate of the Philippines
- Supreme Court
- Official Gazette

### Media Sources
- Reuters
- GMA News
- ABS-CBN News
- Rappler
- Philstar
- PNA

### Other Sources
- PDFs
- Press Releases
- Hearing Transcripts
- Public Statements

---

# Ingestion Pipeline

Sources
→ Firecrawl
→ Document Store
→ Entity Extraction
→ Relationship Extraction
→ Graph Builder
→ Graphify
→ Query Layer
→ AI Agents
→ Frontend

---

# Graph Data Model

## Node Types

### Person
- Politicians
- Senators
- Witnesses
- Lawyers

### Organization
- Senate
- House
- OVP
- Government Agencies

### Event
- Hearings
- Votes
- Filings
- Court Decisions

### Document
- Articles of Impeachment
- Reports
- Court Rulings

### Claim
- Allegations
- Counterclaims

### Evidence
- Reports
- Testimony
- Financial Records

## Relationship Types

- FILED
- VOTED_FOR
- VOTED_AGAINST
- SUPPORTED
- OPPOSED
- TESTIFIED_IN
- PARTICIPATED_IN
- REFERENCED
- RESULTED_IN
- SUPPORTED_BY
- REFUTED_BY

---

# Database Design

## PostgreSQL

### documents
- id
- title
- url
- source
- publish_date
- content
- checksum

### entities
- id
- entity_type
- name
- metadata

### relationships
- id
- source_entity
- target_entity
- relationship_type
- confidence

### ingestion_jobs
- id
- status
- started_at
- finished_at

---

# RAG Architecture

User Question
→ Intent Detection
→ Graph Search
+
→ Vector Search
→ Evidence Aggregation
→ Citation Engine
→ Answer Generation

---

# Agent Architecture

## Agent 1: Collector
- URL Discovery
- RSS Monitoring
- PDF Collection

## Agent 2: Analyst
- Entity Extraction
- Claim Detection
- Relationship Detection

## Agent 3: Graph Builder
- Node Creation
- Edge Creation
- Deduplication

## Agent 4: Timeline Builder
- Event Extraction
- Timeline Creation

## Agent 5: Fact Checker
- Source Validation
- Contradiction Detection

## Agent 6: Narrative Builder
- Story Generation
- Context Generation

## Agent 7: Query Planner
- User Intent Detection
- Retrieval Planning

---

# User Features

## Interactive Knowledge Graph
- Search nodes
- Expand relationships
- Multi-hop traversal
- Filter entities

## Natural Language Chat
Example:
- What allegations exist?
- Which senators supported impeachment?
- What evidence supports claim X?

## Timeline Explorer
- Daily
- Weekly
- Monthly
- Yearly

## Evidence Explorer
- Source tracking
- Evidence confidence
- Contradiction detection

## Senator Dashboard
- Statements
- Votes
- Timeline
- Participation

## Narrative Explorer
Generate structured story summaries.

## Media Comparison
Compare facts and framing across outlets.

---

# API Specification

## POST /query
Natural language question endpoint.

## GET /entity/{id}
Retrieve graph entity.

## GET /timeline
Retrieve timeline events.

## GET /evidence/{id}
Retrieve evidence package.

## GET /graph/neighbors/{id}
Retrieve connected nodes.

---

# Frontend Architecture

## Next.js
## TypeScript
## Tailwind
## React Flow
## Cytoscape

Pages:
- Dashboard
- Graph Explorer
- Timeline Explorer
- Evidence Explorer
- Chat Interface
- Senator Profiles

---

# MVP Roadmap

## Phase 1
- Firecrawl ingestion
- Entity extraction
- Graphify integration
- Natural language chat
- Timeline

## Phase 2
- Narrative explorer
- Senator dashboard
- Media comparison

## Phase 3
- Contradiction engine
- AI witnesses
- Influence analysis

---

# Future Enhancements

## AI Debate Simulator
Generate prosecution vs defense arguments.

## Political Influence Analytics
PageRank
Betweenness
Degree Centrality

## Multi-case Support
Support future political investigations.

## Real-time Monitoring
Breaking news ingestion and alerts.

---

# Success Metrics

- Query accuracy > 90%
- Citation coverage 100%
- Graph extraction accuracy > 85%
- Average response time < 10 seconds

---

# Long-Term Vision

Evolve into a Political Intelligence Operating System capable of ingesting any major Philippine political controversy, investigation, legislative inquiry, or corruption case and automatically generating a searchable, explainable intelligence graph.
