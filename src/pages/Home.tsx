import { useEffect, useState, type FormEvent } from 'react'
import { Mark } from '../components/ShellIcons'
import type { Workspace } from '../data'

export function Home({
  workspaces: items,
  loading,
  onOpen,
  onCreate,
  onUpdate,
  onDelete,
}: {
  workspaces: Workspace[]
  loading: boolean
  onOpen: (id: string) => void
  onCreate: (payload: { name: string; description: string }) => Promise<void>
  onUpdate: (id: string, payload: { name: string; description: string }) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [menuId, setMenuId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editBusy, setEditBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!menuId) return
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Element | null
      if (target?.closest(`[data-workspace-menu="${menuId}"]`)) return
      setMenuId(null)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuId(null)
    }
    window.addEventListener('mousedown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [menuId])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim()) {
      setError('Give the workspace a name.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await onCreate({ name: name.trim(), description: description.trim() })
      setName('')
      setDescription('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create workspace')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="home">
      <section className="pane-header stage__head home__head">
        <div className="pane-header__main">
          <p className="stage__eyebrow">All agents</p>
          <h1>Workspaces</h1>
          <p>Select an agent to secure, or create a new workspace.</p>
        </div>
        <div className="pane-header__actions">
          <button
            className="btn btn--primary"
            type="submit"
            form="workspace-create"
            disabled={busy}
          >
            {busy ? 'Creating…' : 'Create workspace'}
          </button>
        </div>
      </section>

      <form
        id="workspace-create"
        className="home__create"
        onSubmit={(event) => void submit(event)}
      >
        <label>
          Name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="checkout-agent"
            autoComplete="off"
          />
        </label>
        <label className="home__create-desc">
          Description
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What this agent does and why it needs a gate."
            rows={3}
          />
        </label>
        {error ? <p className="home__error">{error}</p> : null}
      </form>

      {loading ? <p className="home__empty">Loading workspaces…</p> : null}
      {!loading && items.length === 0 ? (
        <p className="home__empty">No workspaces yet. Create one above.</p>
      ) : null}
      <ul className="home__list">
        {items.map((item) => (
          <li key={item.id} className="home__row">
            <button type="button" className="home__card" onClick={() => onOpen(item.id)}>
              <Mark icon={item.icon} />
              <div>
                <strong>{item.name}</strong>
                <small>{item.description || 'No description'}</small>
              </div>
            </button>
            <div className="home__menu" data-workspace-menu={item.id}>
              <button
                type="button"
                className={menuId === item.id ? 'home__more home__more--on' : 'home__more'}
                aria-label={`Workspace actions for ${item.name}`}
                aria-haspopup="menu"
                aria-expanded={menuId === item.id}
                disabled={deletingId === item.id}
                onClick={(event) => {
                  event.stopPropagation()
                  setMenuId((current) => (current === item.id ? null : item.id))
                }}
              >
                <span aria-hidden="true">⋯</span>
              </button>
              {menuId === item.id ? (
                <div className="home__menu-panel" role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    className="home__menu-item"
                    disabled={deletingId === item.id || editBusy}
                    onClick={(event) => {
                      event.stopPropagation()
                      setMenuId(null)
                      setEditingId(item.id)
                      setEditName(item.name)
                      setEditDescription(item.description || '')
                      setError(null)
                    }}
                  >
                    Update
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="home__menu-item home__menu-item--danger"
                    disabled={deletingId === item.id}
                    onClick={(event) => {
                      event.stopPropagation()
                      setMenuId(null)
                      setDeletingId(item.id)
                      void onDelete(item.id)
                        .catch((err) => {
                          setError(err instanceof Error ? err.message : 'Could not delete workspace')
                        })
                        .finally(() => setDeletingId(null))
                    }}
                  >
                    {deletingId === item.id ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              ) : null}
            </div>
            {editingId === item.id ? (
              <form
                className="home__edit"
                onSubmit={(event) => {
                  event.preventDefault()
                  if (!editName.trim()) {
                    setError('Give the workspace a name.')
                    return
                  }
                  setEditBusy(true)
                  setError(null)
                  void onUpdate(item.id, {
                    name: editName.trim(),
                    description: editDescription.trim(),
                  })
                    .then(() => setEditingId(null))
                    .catch((err) => {
                      setError(err instanceof Error ? err.message : 'Could not update workspace')
                    })
                    .finally(() => setEditBusy(false))
                }}
              >
                <label>
                  Name
                  <input
                    value={editName}
                    onChange={(event) => setEditName(event.target.value)}
                    autoComplete="off"
                  />
                </label>
                <label>
                  Description
                  <textarea
                    value={editDescription}
                    onChange={(event) => setEditDescription(event.target.value)}
                    rows={2}
                  />
                </label>
                <div className="home__edit-actions">
                  <button className="btn" type="button" disabled={editBusy} onClick={() => setEditingId(null)}>
                    Cancel
                  </button>
                  <button className="btn btn--primary" type="submit" disabled={editBusy}>
                    {editBusy ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}
