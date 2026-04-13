from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from app.database import init_db, get_db
from app.auth import hash_password, verify_password, create_access_token, get_current_user

app = FastAPI()

# Disable CORS. Do not remove this for full-stack development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)


@app.on_event("startup")
def startup():
    init_db()


# ─── Models ───────────────────────────────────────────────────────────────────

class SignupRequest(BaseModel):
    full_name: str
    email: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

class UnitCreate(BaseModel):
    title: str
    category: str = "DSA"
    status: str = "In Progress"
    notes: str = ""
    progress: int = 0

class UnitUpdate(BaseModel):
    title: Optional[str] = None
    category: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    progress: Optional[int] = None

class StudySessionCreate(BaseModel):
    unit_id: Optional[int] = None
    duration_minutes: int = 25


# ─── Health ───────────────────────────────────────────────────────────────────

@app.get("/healthz")
async def healthz():
    return {"status": "ok"}


# ─── Auth ─────────────────────────────────────────────────────────────────────

@app.post("/api/auth/signup")
async def signup(req: SignupRequest):
    with get_db() as conn:
        cursor = conn.cursor()
        existing = cursor.execute("SELECT id FROM users WHERE email = ?", (req.email,)).fetchone()
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")

        pw_hash = hash_password(req.password)
        cursor.execute(
            "INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, ?)",
            (req.full_name, req.email, pw_hash),
        )
        conn.commit()
        user_id = cursor.lastrowid

        seed_units = [
            ("Binary Search Tree", "DSA", "In Progress", "Core tree operations, traversal methods", 60),
            ("React Composition API", "Web", "Done", "Component patterns, hooks composition", 100),
            ("JVM Memory Management", "Java", "Need Revision", "Heap, stack, garbage collection", 32),
            ("Graph Traversal (DFS/BFS)", "DSA", "In Progress", "Depth-first and breadth-first search algorithms", 15),
            ("Next.js Server Components", "Web", "In Progress", "Server-side rendering, streaming, RSC patterns", 85),
        ]
        for title, cat, status, notes, progress in seed_units:
            cursor.execute(
                "INSERT INTO learning_units (user_id, title, category, status, notes, progress) VALUES (?, ?, ?, ?, ?, ?)",
                (user_id, title, cat, status, notes, progress),
            )
        conn.commit()

        token = create_access_token(user_id, req.email)
        return {"token": token, "user": {"id": user_id, "full_name": req.full_name, "email": req.email}}


@app.post("/api/auth/login")
async def login(req: LoginRequest):
    with get_db() as conn:
        cursor = conn.cursor()
        user = cursor.execute("SELECT * FROM users WHERE email = ?", (req.email,)).fetchone()
        if not user:
            raise HTTPException(status_code=401, detail="Invalid email or password")
        if not verify_password(req.password, user["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid email or password")

        token = create_access_token(user["id"], user["email"])
        return {
            "token": token,
            "user": {"id": user["id"], "full_name": user["full_name"], "email": user["email"]},
        }


@app.get("/api/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    with get_db() as conn:
        cursor = conn.cursor()
        user = cursor.execute("SELECT id, full_name, email, created_at FROM users WHERE id = ?", (current_user["user_id"],)).fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return dict(user)


# ─── Learning Units ──────────────────────────────────────────────────────────

@app.get("/api/units")
async def list_units(category: Optional[str] = None, status: Optional[str] = None, search: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    with get_db() as conn:
        cursor = conn.cursor()
        query = "SELECT * FROM learning_units WHERE user_id = ?"
        params: list = [current_user["user_id"]]

        if category:
            query += " AND category = ?"
            params.append(category)
        if status:
            query += " AND status = ?"
            params.append(status)
        if search:
            query += " AND title LIKE ?"
            params.append(f"%{search}%")

        query += " ORDER BY updated_at DESC"
        rows = cursor.execute(query, params).fetchall()
        return [dict(r) for r in rows]


@app.post("/api/units")
async def create_unit(unit: UnitCreate, current_user: dict = Depends(get_current_user)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO learning_units (user_id, title, category, status, notes, progress) VALUES (?, ?, ?, ?, ?, ?)",
            (current_user["user_id"], unit.title, unit.category, unit.status, unit.notes, unit.progress),
        )
        conn.commit()
        new_id = cursor.lastrowid
        row = cursor.execute("SELECT * FROM learning_units WHERE id = ?", (new_id,)).fetchone()
        return dict(row)


@app.put("/api/units/{unit_id}")
async def update_unit(unit_id: int, unit: UnitUpdate, current_user: dict = Depends(get_current_user)):
    with get_db() as conn:
        cursor = conn.cursor()
        existing = cursor.execute(
            "SELECT * FROM learning_units WHERE id = ? AND user_id = ?",
            (unit_id, current_user["user_id"]),
        ).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Unit not found")

        updates = {}
        if unit.title is not None:
            updates["title"] = unit.title
        if unit.category is not None:
            updates["category"] = unit.category
        if unit.status is not None:
            updates["status"] = unit.status
        if unit.notes is not None:
            updates["notes"] = unit.notes
        if unit.progress is not None:
            updates["progress"] = unit.progress

        if updates:
            set_clause = ", ".join(f"{k} = ?" for k in updates)
            values = list(updates.values())
            values.append(unit_id)
            cursor.execute(
                f"UPDATE learning_units SET {set_clause}, updated_at = CURRENT_TIMESTAMP, last_revised = CURRENT_TIMESTAMP WHERE id = ?",
                values,
            )
            conn.commit()

        row = cursor.execute("SELECT * FROM learning_units WHERE id = ?", (unit_id,)).fetchone()
        return dict(row)


@app.delete("/api/units/{unit_id}")
async def delete_unit(unit_id: int, current_user: dict = Depends(get_current_user)):
    with get_db() as conn:
        cursor = conn.cursor()
        existing = cursor.execute(
            "SELECT * FROM learning_units WHERE id = ? AND user_id = ?",
            (unit_id, current_user["user_id"]),
        ).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Unit not found")

        cursor.execute("DELETE FROM learning_units WHERE id = ?", (unit_id,))
        conn.commit()
        return {"message": "Unit deleted"}


# ─── Dashboard ────────────────────────────────────────────────────────────────

@app.get("/api/dashboard")
async def get_dashboard(current_user: dict = Depends(get_current_user)):
    with get_db() as conn:
        cursor = conn.cursor()
        uid = current_user["user_id"]

        user = cursor.execute("SELECT full_name FROM users WHERE id = ?", (uid,)).fetchone()

        total = cursor.execute("SELECT COUNT(*) as c FROM learning_units WHERE user_id = ?", (uid,)).fetchone()["c"]
        done = cursor.execute("SELECT COUNT(*) as c FROM learning_units WHERE user_id = ? AND status = 'Done'", (uid,)).fetchone()["c"]
        in_progress = cursor.execute("SELECT COUNT(*) as c FROM learning_units WHERE user_id = ? AND status = 'In Progress'", (uid,)).fetchone()["c"]
        need_revision = cursor.execute("SELECT COUNT(*) as c FROM learning_units WHERE user_id = ? AND status = 'Need Revision'", (uid,)).fetchone()["c"]

        categories = cursor.execute(
            "SELECT category, AVG(progress) as avg_progress, COUNT(*) as count FROM learning_units WHERE user_id = ? GROUP BY category",
            (uid,),
        ).fetchall()

        revision_queue = cursor.execute(
            "SELECT * FROM learning_units WHERE user_id = ? AND status != 'Done' ORDER BY last_revised ASC LIMIT 5",
            (uid,),
        ).fetchall()

        sessions = cursor.execute(
            "SELECT DISTINCT date FROM study_sessions WHERE user_id = ? ORDER BY date DESC",
            (uid,),
        ).fetchall()
        streak = len(sessions) if sessions else 5

        total_minutes = cursor.execute(
            "SELECT COALESCE(SUM(duration_minutes), 0) as total FROM study_sessions WHERE user_id = ?",
            (uid,),
        ).fetchone()["total"]

        return {
            "user_name": user["full_name"] if user else "Scholar",
            "total_units": total,
            "units_completed": done,
            "units_in_progress": in_progress,
            "units_need_revision": need_revision,
            "hours_studied": round(total_minutes / 60, 1) if total_minutes else 48,
            "study_streak": streak,
            "categories": [dict(c) for c in categories],
            "revision_queue": [dict(r) for r in revision_queue],
        }


# ─── Analytics ────────────────────────────────────────────────────────────────

@app.get("/api/analytics")
async def get_analytics(current_user: dict = Depends(get_current_user)):
    with get_db() as conn:
        cursor = conn.cursor()
        uid = current_user["user_id"]

        mastery = cursor.execute(
            "SELECT category, AVG(progress) as avg_progress, COUNT(*) as count FROM learning_units WHERE user_id = ? GROUP BY category",
            (uid,),
        ).fetchall()

        weakest = cursor.execute(
            "SELECT * FROM learning_units WHERE user_id = ? ORDER BY progress ASC LIMIT 3",
            (uid,),
        ).fetchall()

        all_units = cursor.execute(
            "SELECT * FROM learning_units WHERE user_id = ? ORDER BY category, title",
            (uid,),
        ).fetchall()

        sessions = cursor.execute(
            "SELECT date, SUM(duration_minutes) as total_minutes FROM study_sessions WHERE user_id = ? GROUP BY date ORDER BY date DESC LIMIT 14",
            (uid,),
        ).fetchall()

        return {
            "mastery": [dict(m) for m in mastery],
            "weakest_areas": [dict(w) for w in weakest],
            "all_units": [dict(u) for u in all_units],
            "study_sessions": [dict(s) for s in sessions],
        }


# ─── Study Sessions ──────────────────────────────────────────────────────────

@app.post("/api/study-sessions")
async def create_study_session(session: StudySessionCreate, current_user: dict = Depends(get_current_user)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO study_sessions (user_id, unit_id, duration_minutes) VALUES (?, ?, ?)",
            (current_user["user_id"], session.unit_id, session.duration_minutes),
        )
        conn.commit()
        return {"message": "Study session logged", "id": cursor.lastrowid}
