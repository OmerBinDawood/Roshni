import os
import tempfile

# Tests always use a throwaway SQLite database, never the real DATABASE_URL from .env
# (load_dotenv does not override variables that are already set).
os.environ["DATABASE_URL"] = f"sqlite:///{tempfile.mkdtemp()}/test.db"
os.environ["ADMIN_TOKEN"] = "test-admin"
