# -*- coding: utf-8 -*-
"""간이 로컬 저지 — 프로그래머스식 제출·채점.

사용법 (산출물/코테/ 에서):
  python judge.py 문제/<폴더명>            # "코드 실행": 예제 케이스만
  python judge.py 문제/<폴더명> --submit   # "제출": 예제 + 채점 케이스 전체, 점수 출력

문제 폴더 구성:
  문제.md · solution.py(여기에 풀이 작성) · testcases.json

testcases.json 형식:
  {"timeout_sec": 10,
   "examples": [{"input": [...], "output": ...}, ...],
   "grading":  [{"input": [...], "output": ..., "kind": "정확성"|"효율성"}, ...]}

주의: testcases.json의 grading 케이스는 열어보지 않는 것이 훈련 원칙(실전과 동일한 블라인드 채점).
"""
import importlib.util
import json
import multiprocessing as mp
import queue as _queue
import sys
import time
from pathlib import Path


def _child(sol_path, case_input, q):
    try:
        spec = importlib.util.spec_from_file_location('solution_module', sol_path)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        t0 = time.perf_counter()
        out = mod.solution(*case_input)
        ms = (time.perf_counter() - t0) * 1000
        q.put(('ok', out, ms))
    except Exception as e:  # 채점기이므로 광범위 캐치가 맞다
        q.put(('err', f'{type(e).__name__}: {e}', 0.0))


def run_case(sol_path, case, timeout_sec):
    q = mp.Queue()
    p = mp.Process(target=_child, args=(str(sol_path), case['input'], q))
    p.start()
    # 반드시 큐를 먼저 비운 뒤 join 한다.
    # 반환값이 OS 파이프 버퍼(수십 KB)보다 크면 자식의 feeder 스레드가 파이프에 다 쓰지 못해
    # 블록되고, 부모가 join()부터 하면 서로 기다리다 정답 풀이까지 시간 초과로 잡힌다.
    # (리스트를 반환하는 문제는 이 순서가 아니면 전부 오판된다.)
    deadline = time.perf_counter() + timeout_sec
    result = None
    while True:
        try:
            result = q.get(timeout=0.05)
            break
        except _queue.Empty:
            pass
        if not p.is_alive():
            try:  # 종료 직후 큐에 늦게 도착한 값 회수
                result = q.get(timeout=0.5)
            except _queue.Empty:
                result = ('err', '프로세스 비정상 종료', 0.0)
            break
        if time.perf_counter() >= deadline:
            break
    if result is None:
        p.terminate()
        p.join()
        return ('timeout', None, timeout_sec * 1000)
    p.join(5)
    if p.is_alive():
        p.terminate()
        p.join()
    return result


def judge(cases, sol_path, timeout_sec, title):
    if not cases:
        return 0, 0
    print(f'\n[{title}]')
    passed = 0
    for i, case in enumerate(cases, 1):
        status, out, ms = run_case(sol_path, case, timeout_sec)
        kind = case.get('kind', '')
        tag = f' ({kind})' if kind else ''
        if status == 'ok' and out == case['output']:
            passed += 1
            print(f'테스트 {i} 〉 통과 ({ms:.2f}ms){tag}')
        elif status == 'ok':
            print(f'테스트 {i} 〉 실패 (기댓값과 다른 값 반환){tag}')
            if title == '예제':  # 예제만 상세 공개 — 채점 케이스는 실전처럼 비공개
                print(f'    입력: {json.dumps(case["input"], ensure_ascii=False)[:200]}')
                # 리스트를 반환하는 문제는 잘라서 — 안 그러면 콘솔이 통째로 밀린다
                print(f'    기댓값: {str(case["output"])[:200]} / 반환값: {str(out)[:200]}')
        elif status == 'timeout':
            print(f'테스트 {i} 〉 실패 (시간 초과 {timeout_sec}s){tag}')
        else:
            print(f'테스트 {i} 〉 실패 (런타임 에러: {out}){tag}')
    return passed, len(cases)


def main():
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    prob_dir = Path(__file__).parent / sys.argv[1] if not Path(sys.argv[1]).is_absolute() else Path(sys.argv[1])
    submit = '--submit' in sys.argv
    sol_path = prob_dir / 'solution.py'
    tc_path = prob_dir / 'testcases.json'
    if not sol_path.exists() or not tc_path.exists():
        print(f'문제 폴더가 아닙니다: {prob_dir} (solution.py / testcases.json 필요)')
        sys.exit(1)
    tc = json.loads(tc_path.read_text(encoding='utf-8'))
    timeout_sec = tc.get('timeout_sec', 10)

    ex_pass, ex_total = judge(tc.get('examples', []), sol_path, timeout_sec, '예제')

    if not submit:
        print(f'\n예제 {ex_pass}/{ex_total} 통과 — 제출하려면 --submit')
        return

    grading = tc.get('grading', [])
    g_pass, g_total = judge(grading, sol_path, timeout_sec, '채점')
    acc = [c for c in grading if c.get('kind', '정확성') == '정확성']
    eff = [c for c in grading if c.get('kind') == '효율성']
    # 그룹별 통과 수 재계산용 인덱스 매핑 대신 단순 재실행을 피하려면 위 judge에서 분리하는 게 정석이나,
    # 케이스 수가 적어 kind별 표시는 위 목록으로 충분 — 총점은 균등 배점.
    score = (g_pass / g_total * 100) if g_total else 0.0
    print(f'\n합계: 예제 {ex_pass}/{ex_total} · 채점 {g_pass}/{g_total} (정확성 {len(acc)}개·효율성 {len(eff)}개 구성)')
    print(f'점수: {score:.1f} / 100.0')
    if ex_pass == ex_total and score == 100.0:
        print('결과: 정답입니다! 🎉')


if __name__ == '__main__':
    main()
