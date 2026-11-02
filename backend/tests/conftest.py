import sys
import os

# Set offline test environment variables before importing app
os.environ["TESTING"] = "1"
os.environ["DATABASE_URL"] = "sqlite:///./test_brandguard.db"
os.environ["EMBEDDING_PROVIDER"] = "mock"
os.environ["VISION_MODE"] = "mock"
os.environ["EXTRACTION_MODE"] = "heuristic"
os.environ["LLM_ENABLED"] = "false"
os.environ["DEMO_MODE"] = "true"

# Add backend and project root directory to sys.path so 'app' and 'scripts' can be imported everywhere
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
project_root = os.path.dirname(backend_dir)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)
if project_root not in sys.path:
    sys.path.insert(0, project_root)
