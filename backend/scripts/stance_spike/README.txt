Stance model evaluation spike measuring DeBERTa-v3 and MiniCheck on CPU.
Throwaway code: isolated under scripts/stance_spike, never import into app.
DeBERTa run: python scripts/stance_spike/run_spike.py --model deberta
MiniCheck run: python scripts/stance_spike/run_spike.py --model minicheck
Results write to results_deberta.json and results_minicheck.json.

