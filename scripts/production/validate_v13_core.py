#!/usr/bin/env python3
import json, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
def load(rel): return json.loads((ROOT/rel).read_text(encoding='utf-8'))
profile=load('data/production/core-v1-rule-profile.json')
files=['core-v1-yongshen-rules.json','core-v1-strength-rules.json','core-v1-dynamic-rules.json','core-v1-pattern-rules.json','core-v1-timing-rules.json']
candidate_files=['yongshen-rules-pro.json','strength-rules-pro.json','dynamic-rules-pro.json','pattern-rules-pro.json','timing-rules-pro.json']
expected=[45,24,14,47,18]
actual=[]
for f,candidate_f,e in zip(files,candidate_files,expected):
 d=load('data/production/'+f); items=d['items']; actual.append(len(items))
 candidate=load('data/production/'+candidate_f)['items']
 candidate_keys={f"{x['topic']}:{x['subtype']}" if 'topic' in x else x['code'] for x in candidate}
 assert len(items)==e,(f,len(items),e)
 assert all(x.get('release_tier')=='CORE_V1' for x in items),f
 assert all(x.get('enabled_by_default') is True for x in items),f
 assert all(x.get('status')!='REVIEW_REQUIRED' for x in items),f
 for x in items:
  key=f"{x['topic']}:{x['subtype']}" if 'topic' in x else x['code']
  assert key in candidate_keys,(f,key,candidate_f)
topic_pool=load('data/production/question-topics-pro.json')['items']
topic_keys={f"{x['topic']}:{x['subtype']}" for x in topic_pool}
topics=load('data/production/core-v1-question-topics.json')['items']
assert all(f"{x['topic']}:{x['subtype']}" in topic_keys for x in topics)
assert profile['rule_counts']['total_production_units']==148
assert sum(actual)==148
report=load('data/production/core-v1-report-policy.json')
assert len(report['dimensions'])==6
assert profile['report_evidence_budget']['hard_maximum']==15
matrix=load('data/production/all-rule-release-matrix-v1.3.json')['items']
assert not any(x['release_tier']=='REVIEW_REQUIRED' and x['enabled_by_default'] for x in matrix)
fixtures=load('fixtures/production/core-v1-scope-contract-fixtures.json')['items']
assert len(fixtures)>=148
print('V1.3 CORE SCOPE VALIDATION PASSED')
print({'counts':actual,'total':sum(actual),'fixtures':len(fixtures)})
