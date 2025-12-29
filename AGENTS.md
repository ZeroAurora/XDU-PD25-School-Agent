# AGENTS.md - XDU-PD25-School-Agent Project Guide

## Project Overview

**XDU-PD25-School-Agent** is a campus activity assistant application designed to help students discover and manage campus activities. The system uses Retrieval-Augmented Generation (RAG) to provide intelligent responses about campus events, schedules, and recommendations.

**Application Name:** McroDesign Backend (FastAPI) / 校园活动助手 (Frontend)

---

## Technology Stack

### Frontend

| Technology | Purpose |
|------------|---------|
| React | UI framework |
| TypeScript | Type safety |
| TanStack Router | File-based routing |
| TanStack Query | Data fetching/caching |
| Ant Design | UI component library |
| Ant Design X | AI chat components |
| Tailwind CSS | Styling |
| Vite | Build tool |
| Biome | Linting and formatting |
| dayjs | Date manipulation |
| lucide-react | Icons |

### Backend

| Technology | Purpose |
|------------|---------|
| Python 3.14+ | Backend runtime |
| FastAPI | Web framework |
| ChromaDB | Vector database for RAG |
| OpenAI | LLM integration |
| Pydantic | Data validation |
| python-dotenv | Environment variables |
| httpx | HTTP client |
| tenacity | Retry logic |

---

## Project Structure

```
XDU-PD25-School-Agent/
├── src/                          # Frontend source code
│   ├── main.tsx                  # Application entry point
│   ├── routeTree.gen.ts          # Auto-generated router tree
│   ├── routes/                   # File-based routes
│   │   ├── __root.tsx            # Root layout with navigation
│   │   ├── index.tsx             # Home/Chat page
│   │   ├── schedule.tsx          # Schedule management page
│   │   └── profile.tsx           # User profile page
│   ├── components/               # Reusable components
│   ├── styles.css                # Global styles
│   └── routeTree.gen.ts          # TanStack Router generated file
│
├── backend/                      # Backend source code
│   ├── app/
│   │   ├── main.py               # FastAPI application entry
│   │   ├── config.py             # Settings and configuration
│   │   ├── deps.py               # Dependency injection
│   │   ├── routers/              # API route handlers
│   │   │   ├── health.py         # Health check endpoints
│   │   │   ├── rag.py            # RAG operations (ingest/search)
│   │   │   ├── agent.py          # Agent chat endpoint
│   │   │   └── debug.py          # Debug and maintenance endpoints
│   │   ├── services/             # Business logic
│   │   │   ├── agent_core.py     # Core agent logic with RAG
│   │   │   ├── llm.py            # OpenAI LLM integration
│   │   │   ├── embedding.py      # SiliconFlow embedding service
│   │   │   └── retriever.py      # ChromaDB retriever service
│   │   └── utils/
│   │       └── textsplit.py      # Text chunking utilities
│   │
│   ├── chroma_data/              # ChromaDB persistent storage
│   ├── sample_data/              # Sample event data
│   ├── pyproject.toml            # Python project config
│   ├── requirements.txt          # Python dependencies
│   └── test_rag_api.py           # RAG API tests
│
├── docs/                         # Documentation
├── public/                       # Static assets
├── package.json                  # Node.js dependencies
├── vite.config.ts                # Vite configuration
├── tsconfig.json                 # TypeScript configuration
├── biome.json                    # Biome linting/formatting config
└── README.md                     # Project README
```

---

## Configuration

### Environment Variables

The backend uses environment variables for configuration. Create a `.env` file in the `backend` directory:

```bash
# OpenAI Configuration
OPENAI_API_KEY=your_api_key_here
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o

# SiliconFlow Embedding Configuration
EMBEDDING_API_KEY=your_embedding_api_key
EMBEDDING_BASE_URL=https://api.siliconflow.cn
EMBEDDING_MODEL=BAAI/bge-m3

# ChromaDB Configuration
CHROMA_DIR=./chroma_data
CHROMA_COLLECTION=campus_acts
```

### Configuration File: [`backend/app/config.py`](backend/app/config.py:8)

```python
class Settings(BaseModel):
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "")
    openai_base_url: str = os.getenv("OPENAI_BASE_URL", "")
    openai_model: str = os.getenv("OPENAI_MODEL", "gpt-4o")
    
    embedding_api_key: str = os.getenv("EMBEDDING_API_KEY", "")
    embedding_base_url: str = os.getenv("EMBEDDING_BASE_URL", "https://api.siliconflow.cn")
    embedding_model: str = os.getenv("EMBEDDING_MODEL", "BAAI/bge-m3")
    
    chroma_dir: str = os.getenv("CHROMA_DIR", "./chroma_data")
    chroma_collection: str = os.getenv("CHROMA_COLLECTION", "campus_acts")
```

---

## API Endpoints

### Health Check

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health/ping` | GET | Returns `{"ok": True}` |

### RAG Operations

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/rag/ingest` | POST | Ingest documents into vector store |
| `/api/rag/search` | GET | Search for relevant documents |

#### Ingest Request Body
```typescript
{
  text: string;      // Document text
  id: string;        // Unique document ID
  metadata?: object; // Optional metadata (title, date, place, etc.)
}
```

#### Search Query Parameters
- `q`: Search query string
- `k`: Number of results (default: 5)

### Agent Chat

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/agent/chat` | POST | Chat with RAG-powered agent |

#### Chat Request Body
```typescript
{
  message: string;        // User message
  k?: number;             // Number of context results (default: 5)
  extra_context?: string; // Additional context
}
```

#### Chat Response
```typescript
{
  reply: string;           // Agent's response
  k: number;               // Number of results used
  hits: number;            // Number of documents found
  contexts: Array<{        // Source contexts
    text: string;
    metadata: object;
  }>
}
```

### Debug Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/debug/emb` | GET | Get embedding dimension |
| `/api/debug/ping_chroma` | GET | Test ChromaDB connection |
| `/api/debug/reset` | DELETE | Reset ChromaDB collection |
| `/api/debug/cleanup` | POST | Clean up embedding resources |

---

## Key Components

### Backend Services

#### 1. [`backend/app/services/agent_core.py`](backend/app/services/agent_core.py:33)
Core agent logic that combines RAG with LLM responses.

**Key Functions:**
- [`get_system_prompt()`](backend/app/services/agent_core.py:9) - Returns system prompt with time-aware context (current date, weekday, season)
- [`chat_once()`](backend/app/services/agent_core.py:33) - Main chat function using RAG

**System Prompt Features:**
- Campus activity assistant persona
- Time-aware recommendations (prioritizes current/upcoming events)
- Structured response format with activity sources

#### 2. [`backend/app/services/retriever.py`](backend/app/services/retriever.py:9)
ChromaDB-based document retrieval with embedding integration.

**Key Class:** `ChromaRetriever`

**Key Methods:**
- [`upsert()`](backend/app/services/retriever.py:25) - Store documents with embeddings
- [`query()`](backend/app/services/retriever.py:41) - Search for relevant documents
- [`cleanup()`](backend/app/services/retriever.py:75) - Clean up resources

**Features:**
- Singleton pattern via [`get_retriever()`](backend/app/services/retriever.py:86)
- Automatic collection recreation on dimension mismatch
- Numpy to Python list conversion for JSON serialization

#### 3. [`backend/app/services/embedding.py`](backend/app/services/embedding.py:16)
SiliconFlow API-based text embedding service.

**Key Class:** `Embedder`

**Key Methods:**
- [`embed()`](backend/app/services/embedding.py:97) - Generate embeddings asynchronously
- [`embed_sync()`](backend/app/services/embedding.py:145) - Synchronous wrapper
- [`cleanup()`](backend/app/services/embedding.py:161) - Clean up HTTP client
- [`_call_embedding_api()`](backend/app/services/embedding.py:52) - API call with retry logic

**Features:**
- Exponential backoff retry
- Zero-vector fallback on API failure
- Empty string filtering
- Dimension caching

#### 4. [`backend/app/services/llm.py`](backend/app/services/llm.py:14)
OpenAI chat completion wrapper.

**Key Functions:**
- [`get_client()`](backend/app/services/llm.py:7) - Create OpenAI client
- [`chat_completion()`](backend/app/services/llm.py:14) - Send messages and get response

### Frontend Routes

#### 1. [`src/routes/index.tsx`](src/routes/index.tsx:23)
Home page with AI chat interface.

**Features:**
- Uses Ant Design X (`@ant-design/x`) for chat components
- [`useXAgent`](src/routes/index.tsx:27) for AI response handling
- [`useXChat`](src/routes/index.tsx:43) for message management
- Bubble list display with user/AI roles
- Welcome component with system introduction

**Current Status:**
- Mock response implementation (lines 28-39)
- Needs integration with `/api/agent/chat` endpoint

#### 2. [`src/routes/schedule.tsx`](src/routes/schedule.tsx:93)
Schedule management with calendar view.

**Features:**
- Ant Design Calendar component
- Event types: course, activity, exam, meeting
- Date cell rendering with event badges
- Event list by selected date
- Color-coded event types

**Data Model:**
```typescript
interface ScheduleEvent {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location?: string;
  type: 'course' | 'activity' | 'exam' | 'meeting';
  description?: string;
}
```

#### 3. [`src/routes/profile.tsx`](src/routes/profile.tsx:8)
User profile display with static demo data.

#### 4. [`src/routes/__root.tsx`](src/routes/__root.tsx:14)
Root layout with navigation menu.

**Navigation Items:**
- Home (`/`) - Chat interface
- Schedule (`/schedule`) - Calendar view
- Profile (`/profile`) - User info

---

## Data Models

### RAG Document Format

See [`backend/sample_data/sample_events.json`](backend/sample_data/sample_events.json:1):

```json
{
  "id": "evt-1",
  "text": "11月8日 周六 14:00 在图书馆报告厅举办 AI 学术沙龙...",
  "metadata": {
    "title": "AI学术沙龙",
    "date": "2025-11-08",
    "place": "图书馆报告厅"
  }
}
```

### Schedule Event Model

```typescript
{
  id: string;
  title: string;
  date: string;        // Format: YYYY-MM-DD
  startTime: string;   // Format: HH:mm
  endTime: string;
  location?: string;
  type: 'course' | 'activity' | 'exam' | 'meeting';
  description?: string;
}
```

---

## Development Workflow

### Running the Application

**Frontend:**
```bash
cd /home/zero/src/ZeroAurora/XDU-PD25-School-Agent
bun install
bun run dev     # Starts on port 3000
bun run build   # Production build
```

**Backend:**
```bash
cd backend
python -m uvicorn app.main:app --reload
# Or using fastapi CLI
fastapi dev app/main.py
```

### Code Quality

```bash
# Biome linting and formatting
bun run format   # Format code
bun run lint     # Check for issues
bun run check    # Full check
```

### Backend Testing

```bash
cd backend
python -m pytest test_rag_api.py
python test_rag_api.py  # Direct execution
```

---

## Known Issues & Limitations

### Frontend
1. **Chat endpoint not integrated** - [`src/routes/index.tsx`](src/routes/index.tsx:28-39) uses mock responses instead of calling `/api/agent/chat`
2. **Static profile data** - [`src/routes/profile.tsx`](src/routes/profile.tsx:13-16) uses hardcoded demo data
3. **Static schedule data** - [`src/routes/schedule.tsx`](src/routes/schedule.tsx:22-80) uses hardcoded sample events

### Backend
1. **Dimension mismatch handling** - [`backend/app/services/retriever.py`](backend/app/services/retriever.py:56-72) deletes and recreates collection on dimension errors
2. **Resource cleanup** - [`backend/app/services/embedding.py`](backend/app/services/embedding.py:161-177) has async cleanup that may not be called properly
3. **No authentication** - [`backend/app/deps.py`](backend/app/deps.py:3-4) has placeholder user function

### Configuration
1. **Missing .env file** - No `.env` file in repository; need to create manually
2. **API keys required** - Both OpenAI and SiliconFlow API keys must be configured

---

## Common Development Tasks

### Adding a New Route

1. Create file in `src/routes/`, e.g., `events.tsx`
2. Use `createFileRoute('/events')` pattern
3. Export `Route` constant with component

### Modifying RAG Configuration

1. Update `backend/app/config.py` with new settings
2. Add environment variables to `.env`
3. Restart backend server

### Adding New API Endpoints

1. Create new router in `backend/app/routers/`
2. Register in `backend/app/main.py`
3. Add business logic in `backend/app/services/`

### Modifying Embedding Model

1. Change `EMBEDDING_MODEL` in `.env`
2. Update `CHROMA_COLLECTION` to trigger collection recreation
3. Re-ingest all documents

### Debugging ChromaDB Issues

Use debug endpoints:
```bash
curl http://localhost:8000/api/debug/ping_chroma
curl -X DELETE http://localhost:8000/api/debug/reset
```

---

## File Reference Summary

### Critical Files for Understanding

| File | Purpose |
|------|---------|
| [`backend/app/config.py`](backend/app/config.py) | Configuration management |
| [`backend/app/services/agent_core.py`](backend/app/services/agent_core.py) | RAG agent logic |
| [`backend/app/services/retriever.py`](backend/app/services/retriever.py) | Vector retrieval |
| [`backend/app/services/embedding.py`](backend/app/services/embedding.py) | Text embeddings |
| [`src/routes/index.tsx`](src/routes/index.tsx) | Main chat UI |
| [`src/routes/schedule.tsx`](src/routes/schedule.tsx) | Schedule view |

### Auto-Generated Files

| File | Generated By |
|------|-------------|
| `src/routeTree.gen.ts` | TanStack Router plugin |
| `backend/chroma_data/` | ChromaDB persistence |

---

## Linting & Formatting

This project uses **Biome** for code quality:

```bash
# Format code
bun run format

# Lint check
bun run lint

# Full check (format + lint)
bun run check
```

Configuration is in [`biome.json`](biome.json) with:
- VCS integration enabled (git)
- Recommended linting rules
- Import organization enabled
- Double quote formatting for JavaScript

---

## Styling

- **Tailwind CSS** with `@tailwindcss/vite` plugin
- Custom styles in [`src/styles.css`](src/styles.css)
- Ant Design components with default theme
- Dark mode navigation menu

---

## Type Safety

- Full TypeScript configuration in [`tsconfig.json`](tsconfig.json)
- Strict mode enabled
- Path aliases: `@/*` → `./src/*`
- TanStack Router type declarations in [`src/main.tsx`](src/main.tsx:25-29)
