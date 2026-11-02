import json
import os

def test_postman_collection_structure():
    with open("postman.json", "r", encoding="utf-8") as f:
        col = json.load(f)

    assert "item" in col
    folders = [item["name"] for item in col["item"]]
    print("Folders present in postman.json:")
    for f in folders:
        print(" -", f)

    assert any("System & Health" in f for f in folders)
    assert any("Authentication" in f for f in folders)
    assert any("Creator Studio" in f for f in folders)
    assert any("Creative Assets" in f for f in folders)
    assert any("Review Terminal" in f for f in folders)
    assert any("Brand Governance Center" in f for f in folders)
    assert any("Operations" in f for f in folders)
    assert any("Rate Limiting" in f for f in folders)

    total_requests = 0
    for folder in col["item"]:
        total_requests += len(folder.get("item", []))

    print(f"\nTotal Requests in Collection: {total_requests}")
    assert total_requests >= 20

if __name__ == "__main__":
    test_postman_collection_structure()
    print(">>> POSTMAN COLLECTION STRUCTURE VERIFIED 100%! <<<")

