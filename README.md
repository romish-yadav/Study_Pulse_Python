# StudyPulse

An academic learning management system designed for deep work. Track your progress, manage learning units, and achieve cognitive mastery.



## Features

- **Landing Page** - Beautiful homepage with features overview and CTA
- **Authentication** - Signup & Login with JWT-based auth
- **Dashboard** - Stats (units completed, hours studied, in progress), category progress bars, revision queue
- **Learning Library** - Browse, search, filter (by category/status), add, edit, delete learning units
- **Analytics** - Mastery levels by category, weakest areas identification
- **Database** - SQLite with persistent storage (users, learning_units, study_sessions)
- **Responsive** - Mobile-friendly with bottom navigation

## Tech Stack

- **Backend**: Python, FastAPI, SQLite, JWT (PyJWT), bcrypt
- **Frontend**: HTML, CSS (Tailwind CSS), JavaScript (vanilla)
- **Design**: Material Design 3 tokens, Manrope + Inter fonts

## Project Structure

```
Study_Pulse_Python/
├── backend/                    # FastAPI backend
│   ├── app/
│   │   ├── main.py            # All API endpoints
│   │   ├── auth.py            # JWT auth & password hashing
│   │   └── database.py        # SQLite database setup
│   ├── pyproject.toml         # Python dependencies
│   └── poetry.lock
├── frontend/                   # Vanilla HTML/CSS/JS frontend
│   ├── index.html             # Single-page application (all pages)
│   └── app.js                 # Application logic & API communication
└── README.md
```

## Prerequisites

- **Python 3.12+**
- **Poetry** (Python package manager)
- A modern web browser

### Install Poetry (if not installed)

```bash
curl -sSL https://install.python-poetry.org | python3 -
```

## How to Run Locally

### 1. Clone the repo

```bash
git clone https://github.com/romish-yadav/Study_Pulse_Python.git
cd StudyPulse
```

### 2. Start the Backend

```bash
cd backend
poetry install
poetry run fastapi dev app/main.py --port 8000
```

The backend will run at `http://localhost:8000`.

### 3. Open the Frontend

Open `frontend/index.html` directly in your browser:

**Option A** - Double-click the file in your file explorer

**Option B** - Use a simple HTTP server (recommended):
```bash
cd frontend
python3 -m http.server 3000
```
Then open `http://localhost:3000` in your browser.

### 4. Use the App

1. Click **"Get Started Free"** on the homepage
2. Create an account (you'll get 5 sample learning units automatically)
3. Navigate between **Dashboard**, **Learning Library**, and **Analytics**
4. Add, edit, or delete learning units from the Library

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | Create new account |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Get current user |
| GET | `/api/units` | List learning units |
| POST | `/api/units` | Create a unit |
| PUT | `/api/units/{id}` | Update a unit |
| DELETE | `/api/units/{id}` | Delete a unit |
| GET | `/api/dashboard` | Dashboard stats |
| GET | `/api/analytics` | Analytics data |
| POST | `/api/study-sessions` | Log study session |

## Database Schema

- **users** - id, full_name, email, password_hash, created_at
- **learning_units** - id, user_id, title, category, status, notes, progress, created_at, updated_at, last_revised
- **study_sessions** - id, user_id, unit_id, duration_minutes, date, created_at

