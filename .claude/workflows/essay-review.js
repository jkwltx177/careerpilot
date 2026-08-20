export const meta = {
  name: 'essay-review',
  description: '자소서·이력서 적대적 다각도 검토 — 4렌즈 병렬 + 지적별 재검증. args: {file, company, questions?}',
  whenToUse: '제출 전 최종 검토. 듣기 좋은 총평이 아니라 "합격 확률을 바꾸는 지적"만 남긴다.',
  phases: [
    { title: 'Review', detail: '검토관 시뮬레이션 / 사실·수치 검증 / 요건 대조 / 서사·차별화 (병렬)' },
    { title: 'Verify', detail: '지적별 적대적 재검증 — 틀린 지적 걸러내기' },
  ],
}

const A = typeof args === 'string' ? JSON.parse(args) : (args || {})  // args는 문자열로 올 수 있음
const FILE = A.file
const C = A.company
if (!FILE || !C) return { error: 'args.file(문서 경로)·args.company 필요 — 예: {file: "산출물/지원서/OO/제출물/자소서_v3.md", company: "OO"}' }
const Q = A.questions ? `\n문항·글자수 제한: ${A.questions}` : ''

const P = `[페르소나] 너는 IT 대기업 서류를 10년간 검토해온 채용 전문가다(CLAUDE.md 페르소나). 대상 문서를 Read로 정독하고, 근거가 필요한 주장은 ./memory/의 도씨에와 대조하라. 칭찬은 반환하지 말고 합격 확률을 바꾸는 지적만. StructuredOutput으로만 반환.`

const F_SCHEMA = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['치명', '중요', '경미'] },
          location: { type: 'string', description: '문항/문단 위치' },
          issue: { type: 'string', description: '무엇이 문제인가 — 한 문장' },
          fix: { type: 'string', description: '구체적 수정안 (대체 문장 포함 가능)' },
        },
        required: ['severity', 'location', 'issue', 'fix'],
      },
    },
    overall: { type: 'string', description: '이 렌즈에서의 통과/탈락 인상 한 문장' },
  },
  required: ['findings', 'overall'],
}

const V_SCHEMA = {
  type: 'object',
  properties: {
    valid: { type: 'boolean', description: '지적이 실제로 유효한가' },
    reason: { type: 'string' },
    revised_fix: { type: 'string', description: '유효 시 최종 수정안 (원안 유지면 그대로)' },
  },
  required: ['valid', 'reason', 'revised_fix'],
}

const LENSES = [
  { key: '검토관 시뮬레이션', prompt: `"${C}" 서류 검토관이 30초 스킴 → 3분 정독하는 과정을 시뮬레이션하라. 30초 안에 잡히는 훅이 있는가, 탈락 사유가 될 문장은 무엇인가.` },
  { key: '사실·수치 검증', prompt: `문서의 모든 수치·역할·성과 주장을 추출해 ./memory/ 도씨에와 대조하라. 도씨에에 근거 없는 수치, 과장·귀속 오류(팀 성과를 개인 성과로 등)를 적발하라.` },
  { key: '요건 대조', prompt: `"${C}"의 문항 요구·글자수·JD 필수역량과 문서를 1:1 대조하라. 요구에 답하지 않은 문항, 낭비된 분량, 기업 키워드 미정렬을 적발하라.${Q}` },
  { key: '서사·차별화', prompt: `경쟁자 관점: 같은 스펙대 지원자 대비 이 문서만의 차별점이 문장으로 존재하는가. 일반론 문장(누구나 쓸 수 있는 문장)을 적발하고 대체안을 제시하라.` },
]

phase('Review')
const results = await pipeline(
  LENSES,
  l => agent(`${P}\n대상 문서: ${FILE}\n렌즈: ${l.prompt}`, { label: `review:${l.key}`, phase: 'Review', schema: F_SCHEMA }),
  (rev, l) => rev ? parallel(rev.findings.map(f => () =>
    agent(`${P}\n대상 문서: ${FILE}\n다음 지적을 적대적으로 재검증하라 — 문서 원문·도씨에를 다시 읽고 이 지적이 틀렸을 가능성을 먼저 찾아라. 확신 없으면 valid=false.\n지적: [${f.severity}] ${f.location} — ${f.issue} / 수정안: ${f.fix}`,
      { label: `verify:${l.key}`, phase: 'Verify', schema: V_SCHEMA })
      .then(v => v && v.valid ? { ...f, fix: v.revised_fix, lens: l.key } : null)
  )).then(fs => ({ lens: l.key, overall: rev.overall, findings: fs.filter(Boolean) })) : null,
)

const ok = results.filter(Boolean)
const confirmed = ok.flatMap(r => r.findings)
const order = { '치명': 0, '중요': 1, '경미': 2 }
confirmed.sort((a, b) => order[a.severity] - order[b.severity])
return { file: FILE, company: C, confirmed_findings: confirmed, lens_overalls: ok.map(r => `${r.lens}: ${r.overall}`) }
