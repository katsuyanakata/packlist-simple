import { FormEvent, useEffect, useMemo, useReducer, useRef, useState } from 'react'

type Item = {
  id: string
  label: string
  icon: string
  done: boolean
  order: number
}

type PackListState = {
  version: 1
  listTitle: string
  listSubtitle: string
  items: Item[]
  updatedAt: number
}

type Action =
  | { type: 'TOGGLE_ITEM'; id: string }
  | { type: 'ADD_ITEM'; payload: { label: string; icon: string } }
  | { type: 'DELETE_ITEM'; id: string }
  | { type: 'MOVE_ITEM'; id: string; direction: -1 | 1 }
  | { type: 'RESET_DONE' }
  | { type: 'LOAD_STATE'; payload: PackListState }
  | { type: 'UPDATE_META'; payload: { listTitle: string; listSubtitle: string } }

const STORAGE_KEY = 'packlist:v1'

const TRAVEL_TEMPLATE: Array<{ icon: string; label: string }> = [
  { icon: '👕', label: '着替え' },
  { icon: '🧦', label: 'くつ下' },
  { icon: '🪥', label: 'はぶらし' },
  { icon: '🧴', label: '洗面用品' },
  { icon: '📱', label: 'スマホ' },
  { icon: '🔌', label: '充電器' },
  { icon: '💳', label: '財布' },
  { icon: '🪪', label: '身分証' },
  { icon: '💊', label: '薬' },
  { icon: '😷', label: 'マスク' }
]

const now = () => Date.now()

const createId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `${now()}-${Math.random().toString(16).slice(2)}`
}

const sortByOrder = (items: Item[]) => [...items].sort((a, b) => a.order - b.order)

const normalizeOrders = (items: Item[]) => sortByOrder(items).map((item, index) => ({ ...item, order: (index + 1) * 10 }))

const createInitialState = (): PackListState => ({
  version: 1,
  listTitle: '旅行のもちもの',
  listSubtitle: '出発前にこれだけ',
  items: TRAVEL_TEMPLATE.map((entry, index) => ({
    id: createId(),
    icon: entry.icon,
    label: entry.label,
    done: false,
    order: (index + 1) * 10
  })),
  updatedAt: now()
})

const isValidState = (value: unknown): value is PackListState => {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<PackListState>
  if (candidate.version !== 1) return false
  if (typeof candidate.listTitle !== 'string') return false
  if (typeof candidate.listSubtitle !== 'string') return false
  if (typeof candidate.updatedAt !== 'number') return false
  if (!Array.isArray(candidate.items)) return false

  return candidate.items.every((item) => {
    const row = item as Partial<Item>
    return (
      row &&
      typeof row.id === 'string' &&
      typeof row.label === 'string' &&
      typeof row.icon === 'string' &&
      typeof row.done === 'boolean' &&
      typeof row.order === 'number'
    )
  })
}

const loadStateSafely = (): PackListState => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return createInitialState()
    const parsed = JSON.parse(raw) as unknown
    if (!isValidState(parsed)) return createInitialState()
    return {
      ...parsed,
      items: normalizeOrders(parsed.items)
    }
  } catch {
    return createInitialState()
  }
}

const reducer = (state: PackListState, action: Action): PackListState => {
  switch (action.type) {
    case 'TOGGLE_ITEM':
      return {
        ...state,
        items: state.items.map((item) => (item.id === action.id ? { ...item, done: !item.done } : item)),
        updatedAt: now()
      }
    case 'ADD_ITEM': {
      const maxOrder = state.items.reduce((max, item) => Math.max(max, item.order), 0)
      return {
        ...state,
        items: [
          ...state.items,
          {
            id: createId(),
            label: action.payload.label,
            icon: action.payload.icon || '📦',
            done: false,
            order: maxOrder + 10
          }
        ],
        updatedAt: now()
      }
    }
    case 'DELETE_ITEM':
      return {
        ...state,
        items: normalizeOrders(state.items.filter((item) => item.id !== action.id)),
        updatedAt: now()
      }
    case 'MOVE_ITEM': {
      const sorted = sortByOrder(state.items)
      const currentIndex = sorted.findIndex((item) => item.id === action.id)
      const targetIndex = currentIndex + action.direction
      if (currentIndex < 0 || targetIndex < 0 || targetIndex >= sorted.length) {
        return state
      }

      const next = [...sorted]
      const [moved] = next.splice(currentIndex, 1)
      next.splice(targetIndex, 0, moved)

      return {
        ...state,
        items: normalizeOrders(next),
        updatedAt: now()
      }
    }
    case 'RESET_DONE':
      return {
        ...state,
        items: state.items.map((item) => ({ ...item, done: false })),
        updatedAt: now()
      }
    case 'LOAD_STATE':
      return action.payload
    case 'UPDATE_META':
      return {
        ...state,
        listTitle: action.payload.listTitle,
        listSubtitle: action.payload.listSubtitle,
        updatedAt: now()
      }
    default:
      return state
  }
}

function App() {
  const [state, dispatch] = useReducer(reducer, undefined, loadStateSafely)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newIcon, setNewIcon] = useState('')
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [showReady, setShowReady] = useState(false)
  const [listTitleInput, setListTitleInput] = useState(state.listTitle)
  const [listSubtitleInput, setListSubtitleInput] = useState(state.listSubtitle)

  const sortedItems = useMemo(() => sortByOrder(state.items), [state.items])
  const todoItems = sortedItems.filter((item) => !item.done)
  const doneItems = sortedItems.filter((item) => item.done)
  const allDone = state.items.length > 0 && state.items.every((item) => item.done)

  const prevAllDone = useRef(allDone)

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  useEffect(() => {
    if (!prevAllDone.current && allDone) {
      setShowReady(true)
      const id = window.setTimeout(() => setShowReady(false), 1000)
      return () => window.clearTimeout(id)
    }
    prevAllDone.current = allDone
    return
  }, [allDone])

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(''), 1000)
    return () => window.clearTimeout(id)
  }, [toast])

  const showToast = (message: string) => setToast(message)

  const openEditor = () => {
    setListTitleInput(state.listTitle)
    setListSubtitleInput(state.listSubtitle)
    setNewIcon('')
    setNewLabel('')
    setError('')
    setIsEditOpen(true)
  }

  const addItem = (e: FormEvent) => {
    e.preventDefault()
    const label = newLabel.trim()
    if (!label || label.length > 20) {
      setError('アイテム名は1〜20文字で入力してください')
      return
    }

    dispatch({
      type: 'ADD_ITEM',
      payload: {
        label,
        icon: newIcon.trim() || '📦'
      }
    })

    setNewLabel('')
    setNewIcon('')
    setError('')
  }

  const saveMeta = () => {
    dispatch({
      type: 'UPDATE_META',
      payload: {
        listTitle: listTitleInput.trim() || '旅行のもちもの',
        listSubtitle: listSubtitleInput.trim() || '出発前にこれだけ'
      }
    })
    showToast('編集を保存しました')
  }

  const resetDone = () => {
    const ok = window.confirm('完了状態をリセットしますか？')
    if (!ok) return
    dispatch({ type: 'RESET_DONE' })
  }

  const copyLink = async () => {
    const link = `${window.location.origin}${window.location.pathname}`
    try {
      await navigator.clipboard.writeText(link)
      showToast('リンクをコピーしました')
    } catch {
      window.prompt('このリンクをコピーしてください', link)
      showToast('リンクをコピーしました')
    }
  }

  return (
    <main className="app">
      <header className="header">
        <h1>{state.listTitle}</h1>
        <p>{state.listSubtitle}</p>
      </header>

      {showReady && <div className="ready-banner">準備OK</div>}

      <section className="section">
        <h2>まだ</h2>
        <div className="list">
          {todoItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className="item-card"
              onClick={() => dispatch({ type: 'TOGGLE_ITEM', id: item.id })}
            >
              <span className="item-icon">{item.icon}</span>
              <span className="item-label">{item.label}</span>
            </button>
          ))}
          {todoItems.length === 0 && <p className="empty">未完了のアイテムはありません</p>}
        </div>
      </section>

      <section className="section">
        <h2>できた</h2>
        <div className="list">
          {doneItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className="item-card done"
              onClick={() => dispatch({ type: 'TOGGLE_ITEM', id: item.id })}
            >
              <span className="item-icon">{item.icon}</span>
              <span className="item-label">{item.label}</span>
            </button>
          ))}
          {doneItems.length === 0 && <p className="empty">完了したアイテムはありません</p>}
        </div>
      </section>

      <footer className="footer">
        <button type="button" onClick={resetDone}>
          リセット
        </button>
        <button type="button" onClick={openEditor}>
          編集
        </button>
        <button type="button" onClick={copyLink}>
          リンクをコピー
        </button>
      </footer>

      {isEditOpen && (
        <div className="modal-overlay" role="presentation" onClick={() => setIsEditOpen(false)}>
          <section className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h3>編集</h3>

            <div className="meta-edit">
              <label>
                タイトル
                <input
                  value={listTitleInput}
                  maxLength={30}
                  onChange={(e) => setListTitleInput(e.target.value)}
                />
              </label>
              <label>
                サブタイトル
                <input
                  value={listSubtitleInput}
                  maxLength={40}
                  onChange={(e) => setListSubtitleInput(e.target.value)}
                />
              </label>
              <button type="button" onClick={saveMeta}>
                タイトルを保存
              </button>
            </div>

            <form className="add-form" onSubmit={addItem}>
              <label>
                アイコン
                <input
                  placeholder="未入力で📦"
                  maxLength={2}
                  value={newIcon}
                  onChange={(e) => setNewIcon(e.target.value)}
                />
              </label>
              <label>
                アイテム名
                <input
                  placeholder="1〜20文字"
                  maxLength={20}
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                />
              </label>
              <button type="submit">追加</button>
              {error && <p className="error">{error}</p>}
            </form>

            <div className="edit-list">
              {sortedItems.map((item, index) => (
                <div key={item.id} className="edit-row">
                  <span>
                    {item.icon} {item.label}
                  </span>
                  <div className="edit-actions">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => dispatch({ type: 'MOVE_ITEM', id: item.id, direction: -1 })}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={index === sortedItems.length - 1}
                      onClick={() => dispatch({ type: 'MOVE_ITEM', id: item.id, direction: 1 })}
                    >
                      ↓
                    </button>
                    <button type="button" onClick={() => dispatch({ type: 'DELETE_ITEM', id: item.id })}>
                      削除
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button type="button" className="close-button" onClick={() => setIsEditOpen(false)}>
              閉じる
            </button>
          </section>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </main>
  )
}

export default App
