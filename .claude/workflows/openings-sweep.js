export const meta = {
  name: 'openings-sweep',
  description: '공채·수시 통합 채용공고 스윕 — 모든 타깃에 2축(회차형 이벤트 감시 + 수시 신입핏 스캔)을 함께 적용, 변화 발견은 적대적 재검증. args: {targets, profile?, fit?}',
  whenToUse: '주 1회 정례 + 공고 러시 구간은 주기 단축. 회사를 "공채용 회사/수시용 회사"로 나누지 말 것 — 같은 회사가 두 축 모두에 걸린다. 상시채용 전환 그룹(정기 공채를 폐지한 대기업들)은 신입이 수시로만 흐르므로, 회차 감시만 하면 통째로 사각이 된다. 그룹사는 통합 채용 보드 단위로 targets에 넣는 게 효율적이다.',
  phases: [
    { title: 'Sweep', detail: '타깃별 2축 스캔 (병렬)' },
    { title: 'Verify', detail: '변화·액션 발견 적대적 재검증' },
  ],
}

// args 예시:
// {
//   profile: '홍OO — 2025-02 학사 졸업, 백엔드 주특기, Java·Spring, 병역필',
//   fit: '①정규직 수시(인턴·교육형은 별도 표기) ②신입 허용 또는 경력 연차 무명시 ③AI/ML/백엔드 핏',
//   targets: [
//     { name: 'OO그룹(통합보드)', boards: ['https://careers.example.com'],
//       events: '하반기 공채(작년 9월 초 접수) — 게시 여부 감시',
//       baseline: '직전 스윕(8/9): 미공고, 수시는 경력만' },
//     { name: 'XX(수시 100% 그룹)', boards: ['https://xxcareers.com'],
//       events: '채용연계 인턴십 N기(작년 9월 접수)',
//       baseline: '첫 스캔 — 그룹 채용 정책(공채/수시 구조)부터 판정할 것' },
//   ],
// }
const A = typeof args === 'string' ? JSON.parse(args) : (args || {})
const TARGETS = A.targets
if (!Array.isArray(TARGETS) || !TARGETS.length) return { error: 'args.targets 필요 — 파일 상단 주석의 예시 형태로 전달. 회사가 아니라 "감시 단위"(그룹 통합 보드 포함)로 넣을 것.' }
const PROFILE = A.profile || '(프로필 미제공 — 핏 판정은 보수적으로)'
const FIT = A.fit || '①정규직 수시(인턴·교육과정은 별도 표기) ②신입 허용 또는 경력 연차 무명시 ③지원 직무 핏'

const P = `[페르소나] 너는 IT 대기업 채용 전문가다(CLAUDE.md 페르소나). 확인된 사실과 추정을 엄격히 구분하고 모든 근거에 URL과 게시/확인 시점을 명기하라.
지원자 프로필(핏 판정 기준): ${PROFILE}
수시 핏 조건: ${FIT}
핵심 규율 4가지:
1. "직전 회차 실적 [확정]" ≠ "올해 정책 [확정]" — 절대 혼동 금지. certainty를 확정/예상/미확인으로 구분.
2. **2축 모두 스캔**: 축① 회차형 이벤트(공채·챌린지·인턴십)가 게시됐는가 / 축② 같은 보드의 수시 공고 중 핏 조건 충족 포지션이 있는가. 한 축만 보고 끝내지 마라 — 특히 "진행 공고 전부 경력"으로 보여도 핏 스캔을 실제로 수행한 뒤에 그렇게 기록하라.
3. 감시용 API·URL은 사이트 프론트가 실제 호출하는 백엔드인지 검증한 것만 신뢰(다른 채널을 정본으로 오인한 전례 있음). 감시 채널의 "급감·전멸" 신호는 제2 채널 교차 확인 후에만 채택.
4. 접속 실패한 소스는 실패로 기록하고 추측으로 메우지 마라. JS 렌더링 실패 시 뉴스·잡포털 교차로 보완.
도구: 먼저 ToolSearch로 WebSearch·WebFetch를 로드해 사용하라. 최종 텍스트는 사람에게 보이지 않으니 StructuredOutput으로만 반환하라.`

const FINDER_SCHEMA = {
  type: 'object',
  required: ['target', 'findings', 'checked_sources'],
  properties: {
    target: { type: 'string' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['company', 'title', 'axis', 'status_change', 'evidence', 'priority', 'certainty'],
        properties: {
          company: { type: 'string' },
          title: { type: 'string' },
          axis: { type: 'string', enum: ['회차', '수시', '정책'], description: '회차형 이벤트 / 수시 포지션 / 채용 정책 판정' },
          url: { type: 'string' },
          status_change: { type: 'string', enum: ['new', 'changed', 'closed', 'unchanged'], description: 'baseline 대비 — baseline 없으면 첫 스캔이므로 new' },
          deadline: { type: 'string' },
          eligibility: { type: 'string' },
          evidence: { type: 'string', description: '근거 요약 + 게시/확인 시점' },
          fit_note: { type: 'string' },
          priority: { type: 'integer', description: '1(즉시 액션)~5(참고)' },
          certainty: { type: 'string', enum: ['확정', '예상', '미확인'] },
        },
      },
    },
    checked_sources: {
      type: 'array',
      items: { type: 'object', required: ['url', 'result'], properties: { url: { type: 'string' }, result: { type: 'string' } } },
    },
    notes: { type: 'string', description: '총평 — 다음 점검 권장 주기·감시 단위(정본 보드 URL) 포함' },
  },
}

const VERDICT_SCHEMA = {
  type: 'object',
  required: ['verdict', 'evidence'],
  properties: {
    verdict: { type: 'string', enum: ['confirmed', 'refuted', 'unverifiable'] },
    evidence: { type: 'string', description: '재검증 근거 URL + 확인 시점' },
    corrected: { type: 'string', description: '원 발견에서 정정할 내용 (없으면 빈 문자열)' },
  },
}

phase('Sweep')
log(`스윕 개시 — 감시 단위 ${TARGETS.length}개, 각각 2축(회차+수시) 스캔`)

const results = await parallel(
  TARGETS.map((t) => () =>
    agent(
      `${P}\n\n[감시 단위: ${t.name}]\n보드: ${(t.boards || []).join(', ') || '(미지정 — 공식 채용 채널을 직접 찾아 기록)'}\n축① 회차형 이벤트: ${t.events || '(알려진 회차 없음 — 공채/챌린지/인턴십 존재 여부 자체를 판정)'}\n baseline: ${t.baseline || '(첫 스캔 — 이 감시 단위의 채용 정책(공채 유지/수시 전환/채용연계형)부터 판정해 axis=정책 finding으로 넣어라)'}\n\n두 축 모두 수행하라: ①회차형 이벤트 게시 여부 ②보드 전체에서 수시 핏 조건 충족 포지션 스캔. 핏 충족 건과 baseline 대비 변화만 findings로.`,
      { label: `sweep:${t.name}`, phase: 'Sweep', schema: FINDER_SCHEMA }
    )
  )
)

const ok = results.filter(Boolean)
const failed = TARGETS.filter((t, i) => !results[i]).map((t) => t.name)
if (failed.length) log(`⚠️실패한 감시 단위: ${failed.join(', ')}`)

const all = ok.flatMap((r) => (r.findings || []).map((f) => ({ ...f, target: r.target })))
const actionable = all.filter((f) => f.status_change !== 'unchanged' || (f.priority || 9) <= 2)
actionable.sort((a, b) => (a.priority || 9) - (b.priority || 9))
const toVerify = actionable.slice(0, 6)
if (actionable.length > 6) log(`검증 대상 ${actionable.length}건 중 상위 6건만 재검증 — 나머지는 unverified 표기`)
log(`스캔 완료: 발견 ${all.length}건 → ${toVerify.length}건 적대적 재검증`)

phase('Verify')
const verified = (await parallel(
  toVerify.map((f) => () =>
    agent(
      `${P}\n\n아래 발견을 적대적으로 재검증하라 — 기본 태도는 "반박 시도". 원 URL 재접속, 날짜·마감·자격을 원문에서 확인. 작년 정보를 올해로 오인하지 않았는지, 정책 판정이면 반례를 적극 수색하라. 원문 확인 불가면 unverifiable로 판정하고 무엇이 막혔는지 기록.\n발견: ${JSON.stringify(f)}`,
      { label: `verify:${f.company}`, phase: 'Verify', schema: VERDICT_SCHEMA }
    ).then((v) => ({ finding: f, verdict: v }))
  )
)).filter(Boolean)

return {
  failed,
  targets: ok.map((r) => ({ target: r.target, notes: r.notes || '', checked_sources: r.checked_sources || [], findings: r.findings || [] })),
  verified,
  unverified: actionable.slice(6),
}
