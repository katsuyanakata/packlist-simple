import { DragEvent, FormEvent, PointerEvent, useEffect, useMemo, useReducer, useRef, useState } from 'react'

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
  items: Item[]
  updatedAt: number
}

type Action =
  | { type: 'TOGGLE_ITEM'; id: string }
  | { type: 'ADD_ITEM'; payload: { label: string; icon: string } }
  | { type: 'DELETE_ITEM'; id: string }
  | { type: 'RESET_DONE' }
  | { type: 'LOAD_STATE'; payload: PackListState }
  | { type: 'UPDATE_META'; payload: { listTitle: string } }

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
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [isTrashOver, setIsTrashOver] = useState(false)

  const trashZoneRef = useRef<HTMLButtonElement | null>(null)
  const pointerDragRef = useRef<{
    pointerId: number | null
    id: string | null
    startX: number
    startY: number
    dragging: boolean
  }>({
    pointerId: null,
    id: null,
    startX: 0,
    startY: 0,
    dragging: false
  })
  const suppressNextClickRef = useRef(false)

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

  const editTitle = () => {
    const input = window.prompt('タイトルを編集してください', state.listTitle)
    if (input === null) return
    const nextTitle = input.trim() || '旅行のもちもの'
    dispatch({
      type: 'UPDATE_META',
      payload: { listTitle: nextTitle }
    })
  }

  const resetDragState = () => {
    setDraggingId(null)
    setIsTrashOver(false)
    pointerDragRef.current = {
      pointerId: null,
      id: null,
      startX: 0,
      startY: 0,
      dragging: false
    }
  }

  const isPointInTrash = (clientX: number, clientY: number) => {
    const rect = trashZoneRef.current?.getBoundingClientRect()
    if (!rect) return false
    return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom
  }

  const deleteItemById = (id: string) => {
    dispatch({ type: 'DELETE_ITEM', id })
    showToast('アイテムを削除しました')
  }

  const handleItemDragStart = (e: DragEvent<HTMLButtonElement>, id: string) => {
    setDraggingId(id)
    setIsTrashOver(false)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
  }

  const handleItemDragEnd = () => {
    resetDragState()
  }

  const handleTrashDragOver = (e: DragEvent<HTMLButtonElement>) => {
    e.preventDefault()
    if (draggingId) setIsTrashOver(true)
    e.dataTransfer.dropEffect = 'move'
  }

  const handleTrashDragLeave = () => {
    setIsTrashOver(false)
  }

  const handleTrashDrop = (e: DragEvent<HTMLButtonElement>) => {
    e.preventDefault()
    const id = draggingId || e.dataTransfer.getData('text/plain')
    if (id) deleteItemById(id)
    resetDragState()
  }

  const handleItemPointerDown = (e: PointerEvent<HTMLButtonElement>, id: string) => {
    if (e.pointerType === 'mouse') return
    pointerDragRef.current = {
      pointerId: e.pointerId,
      id,
      startX: e.clientX,
      startY: e.clientY,
      dragging: false
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const handleItemPointerMove = (e: PointerEvent<HTMLButtonElement>, id: string) => {
    const current = pointerDragRef.current
    if (current.pointerId !== e.pointerId || current.id !== id) return

    const distance = Math.hypot(e.clientX - current.startX, e.clientY - current.startY)
    if (!current.dragging && distance > 10) {
      current.dragging = true
      suppressNextClickRef.current = true
      setDraggingId(id)
    }

    if (!current.dragging) return
    setIsTrashOver(isPointInTrash(e.clientX, e.clientY))
  }

  const finishTouchDrag = (e: PointerEvent<HTMLButtonElement>, id: string, allowDelete: boolean) => {
    const current = pointerDragRef.current
    if (current.pointerId !== e.pointerId || current.id !== id) return

    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }

    if (allowDelete && current.dragging && current.id && isPointInTrash(e.clientX, e.clientY)) {
      deleteItemById(current.id)
    }

    if (current.dragging) {
      suppressNextClickRef.current = true
      window.setTimeout(() => {
        suppressNextClickRef.current = false
      }, 0)
    }

    resetDragState()
  }

  const handleItemPointerUp = (e: PointerEvent<HTMLButtonElement>, id: string) => {
    finishTouchDrag(e, id, true)
  }

  const handleItemPointerCancel = (e: PointerEvent<HTMLButtonElement>, id: string) => {
    finishTouchDrag(e, id, false)
  }

  const handleItemClick = (id: string) => {
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false
      return
    }
    dispatch({ type: 'TOGGLE_ITEM', id })
  }

  return (
    <main className="app">
      <header className="header">
        <div className="title-row">
          <h1>{state.listTitle}</h1>
          <button type="button" className="title-edit-button" onClick={editTitle} aria-label="タイトルを編集">
            ✏️
          </button>
        </div>
      </header>

      {showReady && <div className="ready-banner">準備OK</div>}

      <section className="section">
        <h2>まだ</h2>
        <ul className="list">
          {todoItems.map((item) => (
            <li key={item.id} className="list-item">
              <button
                type="button"
                className="item-card"
                draggable
                onDragStart={(e) => handleItemDragStart(e, item.id)}
                onDragEnd={handleItemDragEnd}
                onPointerDown={(e) => handleItemPointerDown(e, item.id)}
                onPointerMove={(e) => handleItemPointerMove(e, item.id)}
                onPointerUp={(e) => handleItemPointerUp(e, item.id)}
                onPointerCancel={(e) => handleItemPointerCancel(e, item.id)}
                onClick={() => handleItemClick(item.id)}
              >
                <span className="item-icon">{item.icon}</span>
                <span className="item-label">{item.label}</span>
              </button>
            </li>
          ))}
          {todoItems.length === 0 && (
            <li className="empty" aria-live="polite">
              未完了のアイテムはありません
            </li>
          )}
        </ul>
      </section>

      <section className="section">
        <h2>できた</h2>
        <ul className="list">
          {doneItems.map((item) => (
            <li key={item.id} className="list-item">
              <button
                type="button"
                className="item-card done"
                draggable
                onDragStart={(e) => handleItemDragStart(e, item.id)}
                onDragEnd={handleItemDragEnd}
                onPointerDown={(e) => handleItemPointerDown(e, item.id)}
                onPointerMove={(e) => handleItemPointerMove(e, item.id)}
                onPointerUp={(e) => handleItemPointerUp(e, item.id)}
                onPointerCancel={(e) => handleItemPointerCancel(e, item.id)}
                onClick={() => handleItemClick(item.id)}
              >
                <span className="item-icon">{item.icon}</span>
                <span className="item-label">{item.label}</span>
              </button>
            </li>
          ))}
          {doneItems.length === 0 && (
            <li className="empty" aria-live="polite">
              完了したアイテムはありません
            </li>
          )}
        </ul>
      </section>

      <footer className="footer">
        <button type="button" className="icon-button" onClick={openEditor} aria-label="アイテムを追加">
          ＋
        </button>
        <button
          type="button"
          ref={trashZoneRef}
          className={`icon-button trash-button${isTrashOver ? ' active' : ''}`}
          aria-label="ゴミ箱"
          onDragOver={handleTrashDragOver}
          onDragLeave={handleTrashDragLeave}
          onDrop={handleTrashDrop}
        >
          🗑️
        </button>
        <button type="button" className="icon-button" onClick={resetDone} aria-label="リセット">
          ↺
        </button>
        <button type="button" className="icon-button" onClick={copyLink} aria-label="リンクをコピー">
          🔗
        </button>
      </footer>

      {isEditOpen && (
        <div className="modal-overlay" role="presentation" onClick={() => setIsEditOpen(false)}>
          <section className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h3>アイテムを追加</h3>

            <form className="add-form" onSubmit={addItem}>
              <div className="add-row">
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
              </div>
              <button type="submit">追加</button>
              {error && <p className="error">{error}</p>}
            </form>

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
