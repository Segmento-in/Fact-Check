import os
import sys
import time
import json
import argparse
from pathlib import Path

# Enforce CPU execution before importing ML frameworks
os.environ["CUDA_VISIBLE_DEVICES"] = ""

import psutil


def get_process_ram_mb() -> float:
    process = psutil.Process(os.getpid())
    return process.memory_info().rss / (1024 * 1024)


def load_deberta():
    from transformers import AutoTokenizer, AutoModelForSequenceClassification
    import torch

    model_name = "MoritzLaurer/DeBERTa-v3-base-mnli-fever-anli"
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    model = AutoModelForSequenceClassification.from_pretrained(model_name)
    model.eval()

    # Dynamic label mapping from model config
    raw_id2label = model.config.id2label
    label_map = {}
    for idx, name in raw_id2label.items():
        clean_name = str(name).lower()
        if "entail" in clean_name:
            label_map[int(idx)] = "supports"
        elif "contradict" in clean_name:
            label_map[int(idx)] = "refutes"
        elif "neutral" in clean_name:
            label_map[int(idx)] = "neutral"
        else:
            label_map[int(idx)] = clean_name

    return tokenizer, model, label_map, model_name


def predict_deberta(tokenizer, model, label_map, claim: str, evidence: str):
    import torch

    # Premise is Evidence, Hypothesis is Claim. Truncate to 512 tokens.
    inputs = tokenizer(
        evidence,
        claim,
        truncation=True,
        max_length=512,
        return_tensors="pt"
    )

    with torch.no_grad():
        outputs = model(**inputs)
        logits = outputs.logits.squeeze(0)
        probs = torch.softmax(logits, dim=-1).cpu().tolist()

    pred_idx = int(torch.argmax(logits).item())
    pred_label = label_map.get(pred_idx, "unknown")

    prob_dict = {
        label_map.get(idx, f"label_{idx}"): round(float(prob), 4)
        for idx, prob in enumerate(probs)
    }

    return pred_label, prob_dict


def load_minicheck():
    from minicheck import MiniCheck

    model_name = "roberta-large"
    cache_dir = "./ckpts"
    scorer = MiniCheck(model_name=model_name, cache_dir=cache_dir)
    return scorer, "lytang/MiniCheck-RoBERTa-Large"


def predict_minicheck(scorer, claim: str, evidence: str):
    # MiniCheck scorer API expects lists of docs and claims
    pred_label_raw, raw_prob_raw = scorer.score(docs=[evidence], claims=[claim])

    # Unpack list or scalar output
    raw_label = pred_label_raw[0] if isinstance(pred_label_raw, (list, tuple)) else pred_label_raw
    raw_prob = raw_prob_raw[0] if isinstance(raw_prob_raw, (list, tuple)) else raw_prob_raw

    pred_int = int(raw_label)
    prob_val = float(raw_prob)

    # MiniCheck binary classification: 1 = supports, 0 = unsupported (cannot output refutes)
    pred_label = "supports" if pred_int == 1 else "unsupported"
    prob_dict = {"raw_prob": round(prob_val, 4)}

    return pred_label, prob_dict


def main():
    parser = argparse.ArgumentParser(description="Stance Model Benchmark Spike")
    parser.add_argument(
        "--model",
        type=str,
        required=True,
        choices=["deberta", "minicheck"],
        help="Model candidate to evaluate: deberta or minicheck"
    )
    args = parser.parse_args()

    script_dir = Path(__file__).resolve().parent
    pairs_file = script_dir / "pairs.json"

    if not pairs_file.exists():
        print(f"Error: pairs.json not found at {pairs_file}")
        sys.exit(1)

    with open(pairs_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    test_pairs = data.get("pairs", [])
    if not test_pairs:
        print("Error: No test pairs found in pairs.json")
        sys.exit(1)

    print("=" * 80)
    print(f"STANCE MODEL SPIKE BENCHMARK — MODEL: {args.model.upper()}")
    print("=" * 80)
    print("Environment: CPU only (CUDA_VISIBLE_DEVICES='')")
    print(f"Initial Process RAM: {get_process_ram_mb():.1f} MB\n")

    # 1. Load model once and measure RAM & load time
    start_load = time.perf_counter()
    if args.model == "deberta":
        tokenizer, model, label_map, model_full_name = load_deberta()
    else:
        scorer, model_full_name = load_minicheck()
        print("Note: MiniCheck only outputs 1 (supports) or 0 (unsupported). It cannot output 'refutes'.")
    end_load = time.perf_counter()

    load_time_sec = end_load - start_load
    ram_after_load_mb = get_process_ram_mb()
    peak_ram_mb = ram_after_load_mb

    print(f"Loaded: {model_full_name}")
    print(f"Load time: {load_time_sec:.2f} seconds")
    print(f"Process RAM after load: {ram_after_load_mb:.1f} MB\n")

    # 2. Run pairs
    results = []
    latencies_ms = []

    print("-" * 80)
    if args.model == "deberta":
        header = f"{'ID':<10} {'Expected':<12} {'Predicted':<12} {'Latency (ms)':<14} {'Probabilities'}"
    else:
        header = f"{'ID':<10} {'Expected':<12} {'Predicted':<14} {'Latency (ms)':<14} {'Raw Prob'}"
    print(header)
    print("-" * 80)

    for item in test_pairs:
        pair_id = item.get("id", "unknown")
        claim = item.get("claim", "")
        evidence = item.get("evidence", "")
        expected = item.get("expected", "")

        t0 = time.perf_counter()
        try:
            if args.model == "deberta":
                predicted, probs = predict_deberta(tokenizer, model, label_map, claim, evidence)
            else:
                predicted, probs = predict_minicheck(scorer, claim, evidence)
            t1 = time.perf_counter()
            elapsed_ms = (t1 - t0) * 1000
            latencies_ms.append(elapsed_ms)

            current_ram = get_process_ram_mb()
            if current_ram > peak_ram_mb:
                peak_ram_mb = current_ram

            probs_str = json.dumps(probs)
            print(f"{pair_id:<10} {expected:<12} {predicted:<14} {elapsed_ms:<14.1f} {probs_str}")

            results.append({
                "id": pair_id,
                "expected": expected,
                "predicted": predicted,
                "probabilities": probs,
                "latency_ms": round(elapsed_ms, 2),
                "error": None
            })
        except Exception as e:
            t1 = time.perf_counter()
            elapsed_ms = (t1 - t0) * 1000
            print(f"{pair_id:<10} {expected:<12} {'ERROR':<14} {elapsed_ms:<14.1f} {str(e)}")
            results.append({
                "id": pair_id,
                "expected": expected,
                "predicted": "error",
                "probabilities": {},
                "latency_ms": round(elapsed_ms, 2),
                "error": str(e)
            })

    # 3. Print Summary
    print("\n" + "=" * 80)
    print("BENCHMARK SUMMARY")
    print("=" * 80)

    mean_ms = sum(latencies_ms) / len(latencies_ms) if latencies_ms else 0.0
    max_ms = max(latencies_ms) if latencies_ms else 0.0

    summary_metrics = {
        "total_pairs": len(test_pairs),
        "mean_latency_ms": round(mean_ms, 2),
        "max_latency_ms": round(max_ms, 2),
        "peak_ram_mb": round(peak_ram_mb, 1),
    }

    if args.model == "deberta":
        # Group accuracy by expected label
        counts = {"supports": {"correct": 0, "total": 0},
                  "refutes": {"correct": 0, "total": 0},
                  "neutral": {"correct": 0, "total": 0}}
        total_correct = 0

        for r in results:
            exp = r["expected"]
            pred = r["predicted"]
            if exp in counts:
                counts[exp]["total"] += 1
                if pred == exp:
                    counts[exp]["correct"] += 1
                    total_correct += 1

        print("Accuracy by expected class:")
        for label, c in counts.items():
            acc = (c["correct"] / c["total"] * 100) if c["total"] > 0 else 0.0
            print(f"  - {label:<10}: {c['correct']}/{c['total']} ({acc:.1f}%)")

        overall_acc = (total_correct / len(test_pairs) * 100) if test_pairs else 0.0
        print(f"\nOverall 3-Class Accuracy: {total_correct}/{len(test_pairs)} ({overall_acc:.1f}%)")

        summary_metrics["class_breakdown"] = counts
        summary_metrics["overall_accuracy_pct"] = round(overall_acc, 2)

    else:
        # MiniCheck: binary scoring supports vs not supports
        print("Note: MiniCheck only classifies supported (1) vs unsupported (0).")
        print("Scoring: Expected 'supports' vs 'not supports' (refutes + neutral mapped to unsupported).")

        binary_counts = {
            "supports": {"correct": 0, "total": 0},
            "not_supports": {"correct": 0, "total": 0}
        }
        total_binary_correct = 0

        for r in results:
            exp = r["expected"]
            pred = r["predicted"]
            if exp == "supports":
                binary_counts["supports"]["total"] += 1
                if pred == "supports":
                    binary_counts["supports"]["correct"] += 1
                    total_binary_correct += 1
            else:
                binary_counts["not_supports"]["total"] += 1
                if pred == "unsupported":
                    binary_counts["not_supports"]["correct"] += 1
                    total_binary_correct += 1

        for cat, c in binary_counts.items():
            acc = (c["correct"] / c["total"] * 100) if c["total"] > 0 else 0.0
            print(f"  - {cat:<14}: {c['correct']}/{c['total']} ({acc:.1f}%)")

        overall_binary_acc = (total_binary_correct / len(test_pairs) * 100) if test_pairs else 0.0
        print(f"\nOverall Binary Accuracy: {total_binary_correct}/{len(test_pairs)} ({overall_binary_acc:.1f}%)")

        summary_metrics["binary_breakdown"] = binary_counts
        summary_metrics["overall_binary_accuracy_pct"] = round(overall_binary_acc, 2)

    print(f"\nMean latency per pair : {mean_ms:.1f} ms")
    print(f"Max latency per pair  : {max_ms:.1f} ms")
    print(f"Process RAM after load: {ram_after_load_mb:.1f} MB")
    print(f"Peak process RAM      : {peak_ram_mb:.1f} MB")

    # 4. Save results to JSON
    output_filename = f"results_{args.model}.json"
    output_path = script_dir / output_filename

    output_payload = {
        "model_arg": args.model,
        "model_name": model_full_name,
        "load_time_seconds": round(load_time_sec, 2),
        "ram_after_load_mb": round(ram_after_load_mb, 1),
        "peak_ram_mb": round(peak_ram_mb, 1),
        "mean_latency_ms": round(mean_ms, 2),
        "max_latency_ms": round(max_ms, 2),
        "summary": summary_metrics,
        "results": results
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output_payload, f, indent=2)

    print(f"\nResults saved to: {output_path}")


if __name__ == "__main__":
    main()

