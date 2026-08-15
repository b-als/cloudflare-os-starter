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
        <ul>
          {bundle.requirements.requirements.map((r) => (
            <li key={r.id} style={{ marginBottom: 10 }}>
              <strong>{r.title}</strong> ({r.priority}) — {r.statement}
            </li>
          ))}
          {bundle.requirements.requirements.length === 0 && <p>No requirements captured yet.</p>}
        </ul>
      )}

      {bundle && tab === 'conflicts' && (
        <ul>
          {bundle.conflictRegister.conflicts.map((c) => (
            <li key={c.id} style={{ marginBottom: 10 }}>
              <strong>{c.summary}</strong> — {c.impact} — status: {c.decision.status}
            </li>
          ))}
          {bundle.conflictRegister.conflicts.length === 0 && <p>No conflicts recorded.</p>}
        </ul>
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
