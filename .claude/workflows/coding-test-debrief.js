export const meta = {
  name: 'coding-test-debrief',
  description: '코테 응시 직후 복기 — 후기 수집 + 문제별 정답 구현·검증 + 이후 일정 확인. args: {company, date?, recollection, links?}',
  whenToUse: '코테 응시 당일~직후. 기억이 휘발되기 전 응시자 기억(recollection)을 받아 정답 재구성과 판세 수집을 병렬로 돌린다. 결과는 다음 단계(면접 코테 리뷰) 자산이 된다.',
  phases: [
    { title: 'Research', detail: '커뮤니티 후기·판세 / 이후 전형 일정 (병렬)' },
    { title: 'Solve', detail: '문제별 정답 구현 + 로컬 실행 검증 (브루트포스/랜덤 대조)' },
  ],
}

const A = typeof args === 'string' ? JSON.parse(args) : (args || {})  // args는 문자열로 올 수 있음
const C = A.company
const D = A.date
const MEM = A.recollection
if (!C || !MEM) return { error: 'args.company·args.recollection(응시자가 기억나는 대로 쓴 문제·접근 텍스트) 필요. date 권장, links(커뮤니티 URL 배열) 선택. 예: {company: "OO", date: "YYYY-MM-DD", recollection: "1번: 그래프 문제, 다익스트라로 접근했는데 2번 조건이 기억 안 남", links: ["https://..."]}' }
const LINKS = Array.isArray(A.links) && A.links.length ? `\n응시자가 제보한 커뮤니티 링크(우선 정독): ${A.links.join(' , ')}` : ''

const P = `[페르소나] 너는 IT 대기업 채용 전문가이자 코딩테스트 코치다(CLAUDE.md 페르소나). 사용자가 ${D || '최근'} "${C}" 코딩테스트를 응시했다. 확인 사실과 추정을 엄격히 구분하라. StructuredOutput으로만 반환.`

const R_SCHEMA = {
  type: 'object',
  properties: {
    findings: { type: 'string' },
    sources: { type: 'array', items: { type: 'object', properties: { url: { type: 'string' }, note: { type: 'string' } }, required: ['url', 'note'] } },
    reliability: { type: 'string' },
  },
  required: ['findings', 'sources', 'reliability'],
}

const SOLVE_SCHEMA = {
  type: 'object',
  properties: {
    interpretation: { type: 'string', description: '문제 해석 확정 + 대안 해석 검토' },
    algorithm: { type: 'string', description: '정답 알고리즘·근거·복잡도. 응시자 접근과의 차이' },
    code: { type: 'string', description: '최종 코드 전문' },
    validation: { type: 'string', description: '로컬 실행 검증 실측(랜덤/브루트포스 대조 수치) — 실행 없이 "맞을 것"이라 쓰지 말 것' },
    score_outlook: { type: 'string', description: '응시자 접근의 득점 전망(부분점수 구조 가정 시 시나리오)' },
    interview_card: { type: 'string', description: '면접 코테 리뷰용 한 문단 (막힌 지점 → 복기 개선 서사)' },
  },
  required: ['interpretation', 'algorithm', 'code', 'validation', 'score_outlook', 'interview_card'],
}

phase('Research')
const [community, timeline, solve] = await parallel([
  () => agent(`${P}\n임무: 응시 당일~직후 커뮤니티 후기를 수색하라(커뮤니티·블로그·검색 다각도).${LINKS}\n수집: ①문제 내용·제약(N 상한·시간제한·부분점수 구조) ②풀이 다수설 ③체감 난이도·몇 솔 분포·커트라인 발언 ④채점·발표 관련 정보. 당일이라 글이 적으면 적다고 보고(24~72시간 후 재수색 권고 포함).`, { label: '후기수집', phase: 'Research', schema: R_SCHEMA }),
  () => agent(`${P}\n임무: "${C}"의 코테 이후 전형 일정을 확인하라 — 결과 발표까지 소요일(과거 회차 실적), 다음 단계(면접 등) 형식·시기. 공식 공고·과거 회차 후기 대조, 회차 명기.`, { label: '일정확인', phase: 'Research', schema: R_SCHEMA }),
  () => agent(`${P}\n【응시자 기억(원문)】\n${MEM}\n\n임무: 위 기억을 기반으로 각 문제를 재구성하고 정답을 구현·검증하라.\n절차(문제마다): ①해석 확정(모호하면 대안 해석 비교) ②알고리즘 도출 ③구현 ④**로컬 실행 검증 필수** — 소형 케이스 브루트포스 전수 대조 또는 랜덤 수백 케이스 대조, 실측 수치 보고(임시 파일은 시스템 임시 폴더에) ⑤응시자 접근과의 차이·시간복잡도 판정 ⑥면접 리뷰용 한 문단. 응시자 접근이 정확했다면 그것도 검증으로 확인해줄 것.`, { label: '정답구현검증', phase: 'Solve', schema: SOLVE_SCHEMA }),
])

return {
  company: C, date: D || null,
  community: community || null,
  timeline: timeline || null,
  solutions: solve || null,
  next_steps: '이 결과로 산출물/에 복기 문서를 작성하고, 회사 status.md와 연대기에 반영할 것. 후기가 적었다면 24~72시간 후 후기 수집만 재실행.',
}
