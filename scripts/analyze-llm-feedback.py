#!/usr/bin/env python3
"""Analyze LLM feedback (thumbs up/down) to identify patterns and common issues."""
import sys
import json
import re
from collections import Counter
from datetime import datetime

def main():
    feedback_file = sys.argv[1] if len(sys.argv) > 1 else "backend/data/llm_feedback.jsonl"
    
    try:
        with open(feedback_file, 'r') as f:
            data = [json.loads(line) for line in f if line.strip()]
    except FileNotFoundError:
        print(f"File not found: {feedback_file}")
        sys.exit(1)
    
    if not data:
        print("No feedback data found.")
        return
    
    ups = [d for d in data if d.get('label') == 'up']
    downs = [d for d in data if d.get('label') == 'down']
    
    print(f"Total feedback: {len(data)} (👍 {len(ups)}, 👎 {len(downs)})")
    print(f"Approval rate: {len(ups) / len(data) * 100:.1f}%")
    print("")
    
    # Common issues in thumbs down
    print("=== Common Issues in Thumbs Down ===")
    forbidden_words = {
        'the weather is': 0,
        'weather is': 0,
        'humid': 0,
        'calm': 0,
        'this morning': 0,
        'this afternoon': 0,
        'this evening': 0,
    }
    
    for d in downs:
        desc = (d.get('description') or '').lower()
        for word in forbidden_words:
            if word in desc:
                forbidden_words[word] += 1
    
    print("Forbidden words/phrases in thumbs down:")
    for word, count in sorted(forbidden_words.items(), key=lambda x: -x[1]):
        if count > 0:
            print(f"  '{word}': {count} occurrences")
    
    print("")
    
    # Time phrase accuracy
    print("=== Time Phrase Accuracy ===")
    wrong_time = []
    for d in downs:
        desc = d.get('description', '')
        received = d.get('receivedAt', '')
        if not received:
            continue
        try:
            dt = datetime.fromisoformat(received.replace('Z', '+00:00'))
            hour = dt.hour
            has_morning = bool(re.search(r'\bthis morning\b', desc.lower()))
            has_afternoon = bool(re.search(r'\bthis afternoon\b', desc.lower()))
            has_evening = bool(re.search(r'\bthis evening\b', desc.lower()))
            
            wrong = False
            if has_morning and not (0 <= hour < 12):
                wrong = True
            if has_afternoon and not (12 <= hour < 17):
                wrong = True
            if has_evening and not (17 <= hour < 21):
                wrong = True
            
            if wrong:
                wrong_time.append({
                    'description': desc[:60],
                    'hour': hour,
                    'received': received[:19]
                })
        except:
            pass
    
    if wrong_time:
        print(f"Found {len(wrong_time)} descriptions with wrong time phrases:")
        for item in wrong_time[:10]:
            print(f"  Hour {item['hour']}: '{item['description']}...' ({item['received']})")
    else:
        print("No wrong time phrases found in thumbs down.")
    
    print("")
    
    # Sample thumbs down descriptions
    print("=== Sample Thumbs Down Descriptions ===")
    for i, d in enumerate(downs[-5:], 1):
        desc = d.get('description', 'N/A')
        print(f"{i}. {desc[:80]}...")

    # Category breakdown (when available)
    if any(d.get('category') for d in downs):
        print("")
        print("=== Category Breakdown (thumbs down) ===")
        cat_counts = Counter()
        for d in downs:
            for c in (d.get('category') or []):
                if isinstance(c, str):
                    cat_counts[c] += 1
        for cat, count in cat_counts.most_common():
            print(f"  {cat}: {count}")

    # Rewrites (user-provided preferred descriptions)
    rewrites = [d for d in downs if d.get('rewrite')]
    if rewrites:
        print("")
        print("=== User Rewrites (last 5) ===")
        for i, d in enumerate(rewrites[-5:], 1):
            r = d.get('rewrite', '')
            print(f"{i}. {r[:80]}...")

if __name__ == '__main__':
    main()
