export const meta = {
  name: 'plan-verify',
  description: '산출물 기획 검증 — 포트폴리오·프로젝트·전략의 스코프를 개발 착수 전에 실증으로 판정. args: {plan, company, role, constraints?}',
  whenToUse: '새 포트폴리오/프로젝트/지원 전략을 기획했을 때, 만들기 전에. "열정이 아니라 실증이 스코프를 정한다"(페르소나 원칙 6)의 실행 도구.',
  phases: [
    { title: 'Research', detail: '합격 사례 / 업계 통념(과잉 스코프 리스크) / 기업 방향성 / 전형 실증 (병렬)' },
    { title: 'Judge', detail: '기획 항목별 핵심 포함/축소/이연/제외 판정 + 완성 가능 스코프 산출' },
  ],
}

const A = typeof args === 'string' ? JSON.parse(args) : (args || {})
const PLAN = A.plan          // 기획안·위시리스트 (문자열 또는 항목 배열)
const C = A.company          // 대상 기업
const R = A.role             // 대상 직무
const CONS = A.constraints || '명시 없음'  // 가용 시간·제약
if (!PLAN || !C || !R) return { error: 'args.plan(기획안)·company·role 필요 — 예: {plan: "...", company: "OO", role: "백엔드", constraints: "재직 병행 4주"}' }

const P = `[페르소나] 너는 해당 업계 채용을 10년간 검토해온 채용 전문가다(CLAUDE.md 페르소나). 추측 금지 — 웹 검색으로 실증(후기·사례·공식 자료)을 찾고 작성 시점을 명시하라. 지원자 도씨에가 필요하면 ./memory/를 Read하라.
[대상] 기업: ${C} / 직무: ${R} / 제약: ${CONS}
[검증할 기획안]\n${typeof PLAN === 'string' ? PLAN : JSON.stringify(PLAN)}`

const F = {
  type: 'object',
  required: ['topic', 'findings', 'sources'],
  properties: {
    topic: { type: 'string' },
    findings: { type: 'string', description: '실증 중심 결론 — 사례·인용 포함, 통념과 반론 모두' },
    sources: { type: 'array', items: { type: 'object', required: ['url', 'what'], properties: { url: { type: 'string' }, date: { type: 'string' }, what: { type: 'string' } } } },
  },
}

const V = {
  type: 'object',
  required: ['scope_table', 'recommended_scope', 'risks', 'fit_summary'],
  properties: {
    scope_table: { type: 'array', items: { type: 'object', required: ['item', 'verdict', 'reason'], properties: {
      item: { type: 'string' }, verdict: { type: 'string', enum: ['핵심 포함', '축소 포함', 'v2 이연', '제외'] }, reason: { type: 'string' } } } },
    recommended_scope: { type: 'string', description: '제약 안에서 완성 가능한 최종 스코프 — 주차별 개요 포함' },
    risks: { type: 'string' },
    fit_summary: { type: 'string', description: '기업 인재상·직무 요구와의 정합 — 자소서·면접용 프레임' },
  },
}

const TOPICS = [
  { key: '합격 사례', q: `${C}(및 동종 업계) ${R} 직군 합격자들의 포트폴리오/산출물 실사례를 수집하라 — 어떤 구성이 실제로 붙었고, 전형에서 무엇을 파고들었는지. 최근 2~3년 우선.` },
  { key: '업계 통념·과잉 스코프', q: `기획안의 각 구성 요소에 대한 업계 채용 통념을 조사하라 — 각 항목이 고평가되는 조건과, "너무 광범위하면 오히려 감점"이라는 통념의 실증(현직 채용자 발언). 찬반 모두.` },
  { key: '기업 방향성', q: `${C}의 공식 인재상·개발 문화·최근 1~2년 기술 방향성(공식 발표·보도)을 조사하라. ${R} 관련 조직의 실무·과제 정보가 있으면 특히.` },
  { key: '전형 실증', q: `${C} ${R} 전형(코테·면접·포트폴리오 리뷰)에서 실제로 검증하는 역량을 후기로 수집하라 — 최근 회차 우선.` },
]

phase('Research')
const scans = await parallel(TOPICS.map((t) => () =>
  agent(`${P}\n\n[임무] ${t.key} 조사.\n${t.q}`, { label: `research:${t.key}`, phase: 'Research', schema: F, effort: 'medium' })
))

phase('Judge')
const valid = scans.filter(Boolean)
const verdict = await agent(
  `${P}\n\n[임무] 종합 판정. 아래 조사 결과를 근거로 기획안의 각 항목을 '핵심 포함/축소 포함/v2 이연/제외'로 판정하라.\n\n[조사 결과]\n${JSON.stringify(valid, null, 1).slice(0, 30000)}\n\n판정 원칙: ①완성도가 1순위 — 제약(${CONS}) 안에서 완성 불가능한 스코프는 축소·이연 ②지원자의 기존 강점을 재사용하는 항목 우대 ③실증(합격 사례·현직 발언)이 열정보다 우선. 최종 스코프·주차 개요·리스크·정합 프레임까지 산출.`,
  { label: 'judge:종합판정', phase: 'Judge', schema: V, effort: 'high' }
)

return { verdict, research: valid }
