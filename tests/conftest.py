"""
Patch supabase.create_client before any test module imports bot.db,
so the module-level `supabase = create_client(...)` line never hits
the real Supabase validation.
"""
import sys
from unittest.mock import MagicMock, patch

# Provide dummy env vars so load_dotenv() finds nothing and os.environ lookups succeed
import os
os.environ.setdefault("SUPABASE_URL", "https://fake.supabase.co")
os.environ.setdefault("SUPABASE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.fake")

# Patch create_client globally for the entire test session
_mock_client = MagicMock()
_patcher = patch("supabase.create_client", return_value=_mock_client)
_patcher.start()

# If bot.db was somehow already imported, remove it so the patched version loads fresh
sys.modules.pop("bot.db", None)
