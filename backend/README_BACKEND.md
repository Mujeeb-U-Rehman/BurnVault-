# BurnVault Backend

This folder was missing in the provided workspace extract.

The backend is a Django + DRF + Channels app that serves the existing frontend in `../frontend/` and exposes the REST + WebSocket contracts described in the repository docs.

Quick start (Windows PowerShell):

```powershell
cd backend
python -m venv venv
venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
```

Then open: http://localhost:8000/
