/**
 * BA Studio app UI.
 *
 * A lightweight, dependency-light editor/viewer for the WorkflowStudioDemoV11
 * artifact bundle (requirements, conflicts, process graph, trade-offs,
 * sign-off), reading and writing live per-project data through the BaUiApi
 * RPC capability instead of a local fixture.
 */

import { useEffect, useMemo, useState } from 'react'
import type { RpcStub } from 'capnweb'
import type { BaUiApi } from '../src/ba-ui-types'
import type {
  BaProjectRecord,
  StakeholderSuggestionV11,
  WorkflowRunRecordV1,
  WorkflowStudioDemoV11,
} from '../src/types'

type Tab = 'requirements' | 'conflicts' | 'process' | 'tradeoffs' | 'signoff'

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'requirements', label: 'Requirements' },
  { id: 'conflicts', label: 'Conflicts' },
  { id: 'process', label: 'Process map' },
  { id: 'tradeoffs', label: 'Trade-offs' },
  { id: 'signoff', label: 'Sign-off' },
]

type RequirementCategory = 'functional' | 'nonFunctional' | 'data' | 'integration' | 'compliance' | 'reporting'
type RequirementPriority = 'must' | 'should' | 'could' | 'wont'
type ConflictImpact = 'scope' | 'cost' | 'timeline' | 'risk' | 'compliance'

const REQUIREMENT_CATEGORIES: RequirementCategory[] = [
  'functional',
  'nonFunctional',
  'data',
  'integration',
  'compliance',
  'reporting',
]
const REQUIREMENT_PRIORITIES: RequirementPriority[] = ['must', 'should', 'could', 'wont']
const CONFLICT_IMPACTS: ConflictImpact[] = ['scope', 'cost', 'timeline', 'risk', 'compliance']

const LIFECYCLE_STAGES = ['Interview', 'Review', 'Handoff', 'Signed off', 'Running'] as const
type LifecycleStage = (typeof LIFECYCLE_STAGES)[number]

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

const emptyRequirementForm = {
  title: '',
  category: 'functional' as RequirementCategory,
  statement: '',
  priority: 'should' as RequirementPriority,
}

const emptyConflictForm = {
  summary: '',
  impact: 'scope' as ConflictImpact,
  requirementIds: [] as string[],
  resolutionOwnerStakeholderId: '',
}

export default function App({ api }: { api: RpcStub<BaUiApi> }) {
  const [processId, setProcessId] = useState('proc-onboarding-001')
  const [record, setRecord] = useState<BaProjectRecord | null>(null)
  const [bundle, setBundle] = useState<WorkflowStudioDemoV11 | null>(null)
  const [tab, setTab] = useState<Tab>('requirements')
  const [status, setStatus] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<StakeholderSuggestionV11[]>([])
  const [runs, setRuns] = useState<WorkflowRunRecordV1[]>([])
  const [activeRun, setActiveRun] = useState<WorkflowRunRecordV1 | null>(null)
  const [runNote, setRunNote] = useState('')
  const [decisionCondition, setDecisionCondition] = useState('')

  const [requirementForm, setRequirementForm] = useState(emptyRequirementForm)
  const [editingRequirementId, setEditingRequirementId] = useState<string | null>(null)
  const [conflictForm, setConflictForm] = useState(emptyConflictForm)
  const [editingConflictId, setEditingConflictId] = useState<string | null>(null)

  async function loadRuns(id: string) {
    try {
      const list = await api.listWorkflowRuns(id)
      setRuns(list)
      setActiveRun(list[0] ?? null)
    } catch (err) {
      setStatus(`Failed to load workflow runs: ${(err as Error).message}`)
    }
  }

  async function load(id: string) {
    setLoading(true)
    setStatus('')
    try {
      const existing = await api.getProject(id)
      const activeBundle = existing ? existing.bundle : await api.createStarterBundle(id, id)
      setRecord(existing)
      setBundle(activeBundle)
      setStatus(
        existing
          ? `Loaded version ${existing.version}, saved ${new Date(existing.updatedAt).toLocaleString()}.`
          : 'No saved project yet — showing a starter template. Save to persist it.',
      )
      setSuggestions(await api.getStakeholderSuggestions(activeBundle))
    } catch (err) {
      setStatus(`Failed to load: ${(err as Error).message}`)
    } finally {
      setLoading(false)
    }
    await loadRuns(id)
  }

  useEffect(() => {
    load(processId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function save() {
    if (!bundle) return
    setLoading(true)
    setStatus('')
    try {
      const saved = await api.saveProject(processId, bundle)
      setRecord(saved)
      setBundle(saved.bundle)
      setStatus(`Saved version ${saved.version}.`)
      setSuggestions(await api.getStakeholderSuggestions(saved.bundle))
    } catch (err) {
      setStatus(`Failed to save: ${(err as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  const requirementCount = bundle?.requirements.requirements.length ?? 0
  const openConflictCount = useMemo(
    () => bundle?.conflictRegister.conflicts.filter((c) => c.decision.status === 'open').length ?? 0,
    [bundle],
  )

  function resetRequirementForm() {
    setRequirementForm(emptyRequirementForm)
    setEditingRequirementId(null)
  }

  function startEditRequirement(id: string) {
    const req = bundle?.requirements.requirements.find((r) => r.id === id)
    if (!req) return
    setRequirementForm({
      title: req.title,
      category: req.category,
      statement: req.statement,
      priority: req.priority,
    })
    setEditingRequirementId(id)
  }

  async function submitRequirementForm() {
    if (!bundle) return
    const title = requirementForm.title.trim()
    const statement = requirementForm.statement.trim()
    if (!title || !statement) {
      setStatus('Requirement needs a title and statement.')
      return
    }
    const requirements = bundle.requirements.requirements
    let nextRequirements
    if (editingRequirementId) {
      nextRequirements = requirements.map((r) =>
        r.id === editingRequirementId
          ? { ...r, title, category: requirementForm.category, statement, priority: requirementForm.priority }
          : r,
      )
    } else {
      nextRequirements = [
        ...requirements,
        {
          id: makeId('req'),
          title,
          category: requirementForm.category,
          statement,
          acceptanceCriteria: [],
          priority: requirementForm.priority,
          ownerStakeholderId: bundle.requirements.stakeholders[0]?.id ?? '',
          sourceStakeholderIds: [],
          fitCriterion: '',
          benefitHypothesis: '',
        },
      ]
    }
    const nextBundle: WorkflowStudioDemoV11 = {
      ...bundle,
      requirements: { ...bundle.requirements, requirements: nextRequirements },
    }
    setBundle(nextBundle)
    resetRequirementForm()
    await save()
  }

  function deleteRequirement(id: string) {
    if (!bundle) return
    const nextBundle: WorkflowStudioDemoV11 = {
      ...bundle,
      requirements: {
        ...bundle.requirements,
        requirements: bundle.requirements.requirements.filter((r) => r.id !== id),
      },
    }
    setBundle(nextBundle)
    if (editingRequirementId === id) resetRequirementForm()
    save()
  }

  function resetConflictForm() {
    setConflictForm(emptyConflictForm)
    setEditingConflictId(null)
  }

  function startEditConflict(id: string) {
    const c = bundle?.conflictRegister.conflicts.find((c) => c.id === id)
    if (!c) return
    setConflictForm({
      summary: c.summary,
      impact: c.impact,
      requirementIds: c.requirementIds,
      resolutionOwnerStakeholderId: c.resolutionOwnerStakeholderId,
    })
    setEditingConflictId(id)
  }

  function toggleConflictRequirementId(id: string) {
    setConflictForm((f) => ({
      ...f,
      requirementIds: f.requirementIds.includes(id)
        ? f.requirementIds.filter((r) => r !== id)
        : [...f.requirementIds, id],
    }))
  }

  async function submitConflictForm() {
    if (!bundle) return
    const summary = conflictForm.summary.trim()
    if (!summary) {
      setStatus('Conflict needs a summary.')
      return
    }
    const conflicts = bundle.conflictRegister.conflicts
    let nextConflicts
    if (editingConflictId) {
      nextConflicts = conflicts.map((c) =>
        c.id === editingConflictId
          ? {
              ...c,
              summary,
              impact: conflictForm.impact,
              requirementIds: conflictForm.requirementIds,
              resolutionOwnerStakeholderId: conflictForm.resolutionOwnerStakeholderId.trim(),
            }
          : c,
      )
    } else {
      nextConflicts = [
        ...conflicts,
        {
          id: makeId('conflict'),
          summary,
          requirementIds: conflictForm.requirementIds,
          stakeholderIds: [],
          impact: conflictForm.impact,
          resolutionOwnerStakeholderId: conflictForm.resolutionOwnerStakeholderId.trim(),
          decision: { status: 'open' as const },
        },
      ]
    }
    const nextBundle: WorkflowStudioDemoV11 = {
      ...bundle,
      conflictRegister: { ...bundle.conflictRegister, conflicts: nextConflicts },
    }
    setBundle(nextBundle)
    resetConflictForm()
    await save()
  }

  function setConflictStatus(id: string, status: 'open' | 'inReview' | 'resolved' | 'deferred' | 'rejected') {
    if (!bundle) return
    const nextBundle: WorkflowStudioDemoV11 = {
      ...bundle,
      conflictRegister: {
        ...bundle.conflictRegister,
        conflicts: bundle.conflictRegister.conflicts.map((c) =>
          c.id === id ? { ...c, decision: { ...c.decision, status } } : c,
        ),
      },
    }
    setBundle(nextBundle)
    save()
  }

  async function runProcess() {
    setLoading(true)
    setStatus('')
    try {
      const run = await api.startWorkflowRun(processId, runNote.trim() || undefined)
      setActiveRun(run)
      setRunNote('')
      setStatus(`Started run ${run.runId} — status: ${run.status}.`)
      await loadRuns(processId)
    } catch (err) {
      setStatus(`Failed to start run: ${(err as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  async function submitApproval(decision: 'approved' | 'rejected') {
    if (!activeRun) return
    setLoading(true)
    setStatus('')
    try {
      const run = await api.advanceWorkflowRun(processId, activeRun.runId, { approvalDecision: decision })
      setActiveRun(run)
      setStatus(`Run ${run.runId} now ${run.status}.`)
      await loadRuns(processId)
    } catch (err) {
      setStatus(`Failed to record approval: ${(err as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  async function submitDecision() {
    if (!activeRun) return
    setLoading(true)
    setStatus('')
    try {
      const run = await api.advanceWorkflowRun(processId, activeRun.runId, {
        condition: decisionCondition.trim() || undefined,
      })
      setActiveRun(run)
      setDecisionCondition('')
      setStatus(`Run ${run.runId} now ${run.status}.`)
      await loadRuns(processId)
    } catch (err) {
      setStatus(`Failed to record decision: ${(err as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  const pendingNode = useMemo(() => {
    if (!activeRun?.pendingNodeId || !bundle) return null
    return bundle.processGraph.nodes.find((n) => n.id === activeRun.pendingNodeId) ?? null
  }, [activeRun, bundle])

  const pendingEdgeConditions = useMemo(() => {
    if (!pendingNode || !bundle) return []
    return bundle.processGraph.edges
      .filter((e) => e.source === pendingNode.id && e.condition)
      .map((e) => e.condition as string)
  }, [pendingNode, bundle])

  const currentStage: LifecycleStage = useMemo(() => {
    if (activeRun && activeRun.status !== 'completed' && activeRun.status !== 'failed') return 'Running'
    const hasApproval = bundle?.signoffPacket.approvers.some(
      (a) => a.decision === 'approved' || a.decision === 'approvedWithConditions',
    )
    if (hasApproval) return 'Signed off'
    const resolvedConflicts = bundle?.conflictRegister.conflicts.filter((c) => c.decision.status === 'resolved').length ?? 0
    const totalConflicts = bundle?.conflictRegister.conflicts.length ?? 0
    if (requirementCount > 0 && totalConflicts > 0 && resolvedConflicts === totalConflicts) return 'Handoff'
    if (requirementCount > 0 && openConflictCount > 0) return 'Review'
    return 'Interview'
  }, [activeRun, bundle, requirementCount, openConflictCount])

  return (
    <div style={{ padding: 16, maxWidth: 960, margin: '0 auto' }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>BA Studio — {bundle?.processName ?? processId}</h1>
      <p style={{ opacity: 0.7, fontSize: 13, marginTop: 0 }}>
        {requirementCount} requirement(s) · {openConflictCount} open conflict(s)
        {record ? ` · v${record.version}` : ' · unsaved'}
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        <input
          value={processId}
          onChange={(e) => setProcessId(e.target.value)}
          style={{ flex: 1, padding: '6px 8px' }}
          placeholder="Project id"
        />
        <button onClick={() => load(processId)} disabled={loading}>
          Load
        </button>
        <button onClick={save} disabled={loading || !bundle}>
          Save
        </button>
      </div>

      {status && <div style={{ fontSize: 13, marginBottom: 12, opacity: 0.85 }}>{status}</div>}

      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {LIFECYCLE_STAGES.map((stage) => (
          <span
            key={stage}
            style={{
              padding: '4px 10px',
              borderRadius: 999,
              fontSize: 12,
              border: '1px solid #999',
              background: stage === currentStage ? '#333' : 'transparent',
              color: stage === currentStage ? '#fff' : 'inherit',
              fontWeight: stage === currentStage ? 600 : 400,
            }}
          >
            {stage}
          </span>
        ))}
      </div>

      {suggestions.length > 0 && (
        <div
          style={{
            border: '1px solid #e0a72e',
            background: 'rgba(224, 167, 46, 0.1)',
            borderRadius: 6,
            padding: 10,
            marginBottom: 12,
            fontSize: 13,
          }}
        >
          <strong>Suggested stakeholders to consider</strong>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            {suggestions.map((s) => (
              <li key={s.id}>
                {s.name ? `${s.name} — ` : ''}
                <em>{s.role}</em>: {s.reason}
              </li>
            ))}
          </ul>
          <p style={{ margin: '6px 0 0', opacity: 0.75 }}>
            These are suggestions only — nobody has been contacted. Add them to the stakeholder
            list yourself if you'd like to involve them.
          </p>
        </div>
      )}

      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #ccc', marginBottom: 12 }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '6px 10px',
              border: 'none',
              borderBottom: tab === t.id ? '2px solid currentColor' : '2px solid transparent',
              background: 'none',
              cursor: 'pointer',
              fontWeight: tab === t.id ? 600 : 400,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {bundle && tab === 'requirements' && (
        <div>
          <div style={{ border: '1px solid #ccc', borderRadius: 6, padding: 10, marginBottom: 12 }}>
            <h3 style={{ fontSize: 14, margin: '0 0 8px' }}>
              {editingRequirementId ? 'Edit requirement' : 'Add requirement'}
            </h3>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              <input
                value={requirementForm.title}
                onChange={(e) => setRequirementForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Title"
                style={{ flex: '1 1 200px', padding: '6px 8px' }}
              />
              <select
                value={requirementForm.category}
                onChange={(e) =>
                  setRequirementForm((f) => ({ ...f, category: e.target.value as RequirementCategory }))
                }
                style={{ padding: '6px 8px' }}
              >
                {REQUIREMENT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                value={requirementForm.priority}
                onChange={(e) =>
                  setRequirementForm((f) => ({ ...f, priority: e.target.value as RequirementPriority }))
                }
                style={{ padding: '6px 8px' }}
              >
                {REQUIREMENT_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <textarea
              value={requirementForm.statement}
              onChange={(e) => setRequirementForm((f) => ({ ...f, statement: e.target.value }))}
              placeholder="Statement"
              style={{ width: '100%', padding: '6px 8px', marginBottom: 8, minHeight: 60 }}
            />
            <button onClick={submitRequirementForm} disabled={loading} style={{ marginRight: 8 }}>
              {editingRequirementId ? 'Save requirement' : 'Add requirement'}
            </button>
            {editingRequirementId && (
              <button onClick={resetRequirementForm} disabled={loading}>
                Cancel
              </button>
            )}
          </div>

          <ul style={{ paddingLeft: 0, listStyle: 'none' }}>
            {bundle.requirements.requirements.map((r) => (
              <li
                key={r.id}
                style={{ marginBottom: 10, border: '1px solid #ddd', borderRadius: 6, padding: 8 }}
              >
                <strong>{r.title}</strong> ({r.priority}, {r.category}) — {r.statement}
                <div style={{ marginTop: 6 }}>
                  <button onClick={() => startEditRequirement(r.id)} style={{ marginRight: 8 }}>
                    Edit
                  </button>
                  <button onClick={() => deleteRequirement(r.id)}>Delete</button>
                </div>
              </li>
            ))}
            {bundle.requirements.requirements.length === 0 && <p>No requirements captured yet.</p>}
          </ul>
        </div>
      )}

      {bundle && tab === 'conflicts' && (
        <div>
          <div style={{ border: '1px solid #ccc', borderRadius: 6, padding: 10, marginBottom: 12 }}>
            <h3 style={{ fontSize: 14, margin: '0 0 8px' }}>
              {editingConflictId ? 'Edit conflict' : 'Log conflict'}
            </h3>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              <input
                value={conflictForm.summary}
                onChange={(e) => setConflictForm((f) => ({ ...f, summary: e.target.value }))}
                placeholder="Summary"
                style={{ flex: '1 1 200px', padding: '6px 8px' }}
              />
              <select
                value={conflictForm.impact}
                onChange={(e) => setConflictForm((f) => ({ ...f, impact: e.target.value as ConflictImpact }))}
                style={{ padding: '6px 8px' }}
              >
                {CONFLICT_IMPACTS.map((i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </select>
              <input
                value={conflictForm.resolutionOwnerStakeholderId}
                onChange={(e) =>
                  setConflictForm((f) => ({ ...f, resolutionOwnerStakeholderId: e.target.value }))
                }
                placeholder="Resolution owner (stakeholder id)"
                style={{ flex: '1 1 200px', padding: '6px 8px' }}
              />
            </div>
            <div style={{ marginBottom: 8 }}>
              <p style={{ margin: '0 0 4px', fontSize: 13, opacity: 0.75 }}>Related requirements:</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {bundle.requirements.requirements.map((r) => (
                  <label key={r.id} style={{ fontSize: 13 }}>
                    <input
                      type="checkbox"
                      checked={conflictForm.requirementIds.includes(r.id)}
                      onChange={() => toggleConflictRequirementId(r.id)}
                    />{' '}
                    {r.title}
                  </label>
                ))}
                {bundle.requirements.requirements.length === 0 && (
                  <span style={{ fontSize: 13, opacity: 0.6 }}>No requirements yet.</span>
                )}
              </div>
            </div>
            <button onClick={submitConflictForm} disabled={loading} style={{ marginRight: 8 }}>
              {editingConflictId ? 'Save conflict' : 'Log conflict'}
            </button>
            {editingConflictId && (
              <button onClick={resetConflictForm} disabled={loading}>
                Cancel
              </button>
            )}
          </div>

          <ul style={{ paddingLeft: 0, listStyle: 'none' }}>
            {bundle.conflictRegister.conflicts.map((c) => (
              <li
                key={c.id}
                style={{ marginBottom: 10, border: '1px solid #ddd', borderRadius: 6, padding: 8 }}
              >
                <strong>{c.summary}</strong> — {c.impact} — status: {c.decision.status}
                <div style={{ marginTop: 6 }}>
                  <button onClick={() => startEditConflict(c.id)} style={{ marginRight: 8 }}>
                    Edit
                  </button>
                  {c.decision.status !== 'resolved' && (
                    <button onClick={() => setConflictStatus(c.id, 'resolved')} style={{ marginRight: 8 }}>
                      Mark resolved
                    </button>
                  )}
                  {c.decision.status !== 'open' && (
                    <button onClick={() => setConflictStatus(c.id, 'open')}>Reopen</button>
                  )}
                </div>
              </li>
            ))}
            {bundle.conflictRegister.conflicts.length === 0 && <p>No conflicts recorded.</p>}
          </ul>
        </div>
      )}

      {bundle && tab === 'process' && (
        <ul>
          {bundle.processGraph.nodes.map((n) => (
            <li key={n.id}>
              {n.label} ({n.type})
            </li>
          ))}
        </ul>
      )}

      {bundle && tab === 'tradeoffs' && (
        <ul>
          {bundle.tradeoffRegister.options.map((o) => (
            <li key={o.id} style={{ marginBottom: 10 }}>
              <strong>{o.title}</strong>
              {o.id === bundle.tradeoffRegister.preferredOptionId ? ' ⭐ preferred' : ''} — {o.summary}
            </li>
          ))}
        </ul>
      )}

      {bundle && tab === 'signoff' && (
        <div>
          <p>Baseline version: {bundle.signoffPacket.baselineVersion}</p>
          <ul>
            {bundle.signoffPacket.approvers.map((a, i) => (
              <li key={i}>
                {a.role}: {a.decision}
              </li>
            ))}
            {bundle.signoffPacket.approvers.length === 0 && <p>No approvals recorded yet.</p>}
          </ul>

          <div style={{ borderTop: '1px solid #ccc', marginTop: 16, paddingTop: 12 }}>
            <h2 style={{ fontSize: 16, marginBottom: 8 }}>Run this process</h2>
            <p style={{ opacity: 0.75, fontSize: 13 }}>
              Executes the saved process map step by step. Decision and approval nodes pause the
              run for input; every other node completes automatically (no real system actions are
              triggered yet — this proves out the run/audit trail ahead of wiring real actions).
            </p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input
                value={runNote}
                onChange={(e) => setRunNote(e.target.value)}
                placeholder="Optional note for this run"
                style={{ flex: 1, padding: '6px 8px' }}
              />
              <button onClick={runProcess} disabled={loading || !record}>
                Start run
              </button>
            </div>
            {!record && <p style={{ fontSize: 13, opacity: 0.75 }}>Save the project before starting a run.</p>}

            {activeRun && (
              <div style={{ border: '1px solid #ccc', borderRadius: 6, padding: 10, marginBottom: 12 }}>
                <p style={{ margin: 0, fontSize: 13 }}>
                  Run <code>{activeRun.runId}</code> — <strong>{activeRun.status}</strong>
                  {activeRun.startedByNote ? ` — "${activeRun.startedByNote}"` : ''}
                </p>
                <ul style={{ margin: '8px 0', paddingLeft: 18, fontSize: 13 }}>
                  {activeRun.steps.map((s, i) => (
                    <li key={i}>
                      {s.label} ({s.type}) — {s.status}
                      {s.chosenCondition ? ` — chose "${s.chosenCondition}"` : ''}
                      {s.approvalDecision ? ` — ${s.approvalDecision}` : ''}
                    </li>
                  ))}
                </ul>

                {activeRun.status === 'waitingForInput' && pendingNode?.type === 'approval' && (
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600 }}>
                      Awaiting approval: {pendingNode.label}
                    </p>
                    <button onClick={() => submitApproval('approved')} disabled={loading} style={{ marginRight: 8 }}>
                      Approve
                    </button>
                    <button onClick={() => submitApproval('rejected')} disabled={loading}>
                      Reject
                    </button>
                  </div>
                )}

                {activeRun.status === 'waitingForInput' && pendingNode?.type === 'decision' && (
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600 }}>
                      Awaiting decision: {pendingNode.label}
                    </p>
                    {pendingEdgeConditions.length > 0 ? (
                      <select
                        value={decisionCondition}
                        onChange={(e) => setDecisionCondition(e.target.value)}
                        style={{ marginRight: 8, padding: '4px 6px' }}
                      >
                        <option value="">Choose branch…</option>
                        {pendingEdgeConditions.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    ) : null}
                    <button onClick={submitDecision} disabled={loading}>
                      Confirm
                    </button>
                  </div>
                )}
              </div>
            )}

            {runs.length > 0 && (
              <details>
                <summary style={{ cursor: 'pointer', fontSize: 13 }}>Run history ({runs.length})</summary>
                <ul style={{ fontSize: 13 }}>
                  {runs.map((r) => (
                    <li key={r.runId}>
                      <button
                        onClick={() => setActiveRun(r)}
                        style={{ background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}
                      >
                        {r.runId}
                      </button>{' '}
                      — {r.status} — started {new Date(r.startedAt).toLocaleString()}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
