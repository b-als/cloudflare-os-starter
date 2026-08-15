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
import type { BaProjectRecord, WorkflowStudioDemoV11 } from '../src/types'

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

  async function load(id: string) {
    setLoading(true)
    setStatus('')
    try {
      const existing = await api.getProject(id)
      if (existing) {
        setRecord(existing)
        setBundle(existing.bundle)
        setStatus(`Loaded version ${existing.version}, saved ${new Date(existing.updatedAt).toLocaleString()}.`)
      } else {
        const starter = await api.createStarterBundle(id, id)
        setRecord(null)
        setBundle(starter)
        setStatus('No saved project yet — showing a starter template. Save to persist it.')
      }
    } catch (err) {
      setStatus(`Failed to load: ${(err as Error).message}`)
    } finally {
      setLoading(false)
    }
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
        </div>
      )}
    </div>
  )
}
