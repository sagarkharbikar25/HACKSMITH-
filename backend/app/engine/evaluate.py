"""
Evaluation script to benchmark deterministic engine precision, recall, and F1 score.
Outputs docs/eval_results.json for inclusion in the Round 2 PDF submission.
"""
import os
import json
from collections import defaultdict
from app.engine.rules import evaluate_rules
from app.engine.facts import evaluate_facts

def run_evaluation():
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    testset_path = os.path.join(base_dir, "data", "testset", "testset.json")
    rules_path = os.path.join(base_dir, "data", "seed", "rules.json")
    facts_path = os.path.join(base_dir, "data", "seed", "facts.json")
    docs_dir = os.path.join(base_dir, "docs")
    os.makedirs(docs_dir, exist_ok=True)
    out_path = os.path.join(docs_dir, "eval_results.json")

    with open(testset_path, "r", encoding="utf-8") as f:
        test_items = json.load(f)
    with open(rules_path, "r", encoding="utf-8") as f:
        rules = json.load(f)
    with open(facts_path, "r", encoding="utf-8") as f:
        facts = json.load(f)

    substantiations = [f for f in facts if f.get("kind") == "substantiation"]
    general_facts = [f for f in facts if f.get("kind") != "substantiation"]

    total_expected = 0
    total_detected = 0
    true_positives = 0

    category_stats = defaultdict(lambda: {"tp": 0, "expected": 0, "detected": 0})

    for item in test_items:
        text = item["text"]
        expected_ids = set(item.get("expected_evidence_ids", []))
        cat = item.get("expected_category", "general")

        rf = evaluate_rules(text, rules, substantiations)
        ff = evaluate_facts(text, general_facts)
        detected_ids = {f.evidence_id for f in (rf + ff)}

        total_expected += len(expected_ids)
        total_detected += len(detected_ids)

        tp = len(expected_ids.intersection(detected_ids))
        true_positives += tp

        category_stats[cat]["expected"] += len(expected_ids)
        category_stats[cat]["detected"] += len(detected_ids)
        category_stats[cat]["tp"] += tp

    overall_precision = round(true_positives / total_detected, 3) if total_detected > 0 else 1.0
    overall_recall = round(true_positives / total_expected, 3) if total_expected > 0 else 1.0
    overall_f1 = round(2 * overall_precision * overall_recall / (overall_precision + overall_recall), 3) if (overall_precision + overall_recall) > 0 else 0.0

    cat_results = {}
    for cat, s in category_stats.items():
        p = round(s["tp"] / s["detected"], 3) if s["detected"] > 0 else 1.0
        r = round(s["tp"] / s["expected"], 3) if s["expected"] > 0 else 1.0
        f1 = round(2 * p * r / (p + r), 3) if (p + r) > 0 else 0.0
        cat_results[cat] = {
            "precision": p,
            "recall": r,
            "f1": f1,
            "test_cases": s["expected"]
        }

    results = {
        "benchmark": "BrandGuard AI Round 2 Compliance Test Suite",
        "total_test_items": len(test_items),
        "overall": {
            "precision": overall_precision,
            "recall": overall_recall,
            "f1_score": overall_f1,
            "true_positives": true_positives,
            "total_expected": total_expected,
            "total_detected": total_detected
        },
        "by_category": cat_results,
        "methodology_note": "Evaluated on 20 synthetic labelled marketing drafts covering Round 1 test scenarios. Note on optimistic bias: Evaluator and rules were curated by the team."
    }

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)

    print("\n--- Compliance Engine Evaluation Results ---")
    print(f"Total Test Items: {len(test_items)}")
    print(f"Precision: {overall_precision * 100:.1f}%")
    print(f"Recall:    {overall_recall * 100:.1f}%")
    print(f"F1 Score:  {overall_f1 * 100:.1f}%")
    print(f"Saved to:  {out_path}\n")

if __name__ == "__main__":
    run_evaluation()
