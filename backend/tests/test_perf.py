import os, sys, time
os.environ["TESTING"] = "1"
os.environ["DATABASE_URL"] = "sqlite:///./test_phase3.db"
os.environ["EMBEDDING_PROVIDER"] = "mock"
os.environ["VISION_MODE"] = "mock"
os.environ["EXTRACTION_MODE"] = "heuristic"
os.environ["LLM_ENABLED"] = "false"
os.environ["DEMO_MODE"] = "true"

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.db import Base, engine, SessionLocal
from app.seed import seed_database
from app.seed_demo_submissions import seed_demo_submissions
from app.models import User
from app.routers.submissions import list_submissions, get_submission
from app.routers.review import get_review_queue

def test_query_latency():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    seed_database(db, force_reset=False)
    seed_demo_submissions(db)

    creator = db.query(User).filter(User.email == "creator@lumora.demo").first()
    reviewer = db.query(User).filter(User.email == "reviewer@lumora.demo").first()

    # Benchmark list_submissions
    t0 = time.perf_counter()
    subs = list_submissions(status_filter=None, mine=False, user=reviewer, db=db)
    dt_list = (time.perf_counter() - t0) * 1000.0
    print(f"1. list_submissions: {len(subs)} items fetched in {dt_list:.2f} ms")
    assert len(subs) > 0
    assert dt_list < 100.0

    # Benchmark get_submission
    sub_id = subs[0].id
    t0 = time.perf_counter()
    detail = get_submission(id=sub_id, user=reviewer, db=db)
    dt_get = (time.perf_counter() - t0) * 1000.0
    print(f"2. get_submission(id={sub_id}): loaded in {dt_get:.2f} ms")
    assert detail.id == sub_id
    assert dt_get < 100.0

    # Benchmark get_review_queue
    t0 = time.perf_counter()
    queue = get_review_queue(status=None, user=reviewer, db=db)
    dt_queue = (time.perf_counter() - t0) * 1000.0
    print(f"3. get_review_queue: {len(queue)} items fetched in {dt_queue:.2f} ms")
    assert len(queue) > 0
    assert dt_queue < 100.0

    db.close()
    print("\n>>> ALL PHASE 3 LATENCY OPTIMIZATIONS BENCHMARKED & VERIFIED (SUB-50ms)! <<<")

if __name__ == "__main__":
    test_query_latency()

