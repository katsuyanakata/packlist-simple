import { ChangeEvent, DragEvent, FormEvent, PointerEvent, useEffect, useMemo, useReducer, useRef, useState } from 'react'

type Item = {
  id: string
  label: string
  icon: string
  done: boolean
  order: number
  category?: string
}

type TemplateItem = {
  label: string
  emoji: string
  category: string
}

type Template = {
  id: string
  name: string
  description: string
  items: TemplateItem[]
}

type PackListState = {
  version: 1
  started: boolean
  selectedTemplateId: string | null
  listTitle: string
  items: Item[]
  updatedAt: number
}

type StoredState = {
  version: 1
  listTitle: string
  items: Item[]
  updatedAt: number
  started?: boolean
  selectedTemplateId?: string | null
}

type ItemNotesById = Record<string, string>

type Action =
  | { type: 'TOGGLE_ITEM'; id: string }
  | { type: 'ADD_ITEM'; payload: { label: string; icon: string } }
  | { type: 'DELETE_ITEM'; id: string }
  | { type: 'RESET_DONE' }
  | { type: 'UPDATE_META'; payload: { listTitle: string } }
  | { type: 'APPLY_TEMPLATE'; template: Template | null }

const STORAGE_KEY = 'packlist:v1'
const ITEM_NOTES_STORAGE_KEY = 'packlist:item-notes:v1'
const PHOTO_DB_NAME = 'packlist-media-v1'
const PHOTO_STORE_NAME = 'item-photos'
const LONG_PRESS_MS = 450
const DEFAULT_LIST_TITLE = '持ち物チェックリスト'
const ICON_OPTIONS = [
  '📦',
  '👕',
  '🧦',
  '🪥',
  '🧴',
  '📱',
  '🔌',
  '🔋',
  '💳',
  '👛',
  '🪪',
  '💊',
  '😷',
  '🧻',
  '🧼',
  '🧢',
  '🧥',
  '👟',
  '🕶️',
  '🌂',
  '🎫',
  '🗂️',
  '✏️',
  '💻',
  '🛍️',
  '🩹',
  '🍪',
  '🥤',
  '🍱',
  '🧸'
]

type Screen = 'template' | 'checklist'

const TEMPLATES: Template[] = [
  {
    id: 'travel-basic',
    name: '旅行（国内1泊2日/汎用）',
    description: '短期旅行に必要な基本セット',
    items: [
      { label: '財布', emoji: '👛', category: '必須' },
      { label: 'スマホ', emoji: '📱', category: '必須' },
      { label: '充電器', emoji: '🔌', category: '必須' },
      { label: 'モバイルバッテリー', emoji: '🔋', category: '必須' },
      { label: '身分証', emoji: '🪪', category: '必須' },
      { label: '交通系IC/チケット', emoji: '🎫', category: '必須' },
      { label: '常備薬', emoji: '💊', category: '必須' },
      { label: '着替え', emoji: '👕', category: '衣類' },
      { label: '下着', emoji: '🩲', category: '衣類' },
      { label: '靴下', emoji: '🧦', category: '衣類' },
      { label: '羽織り', emoji: '🧥', category: '衣類' },
      { label: '歯ブラシ', emoji: '🪥', category: '衛生' },
      { label: '洗顔/化粧品', emoji: '🧴', category: '衛生' },
      { label: 'ヘアブラシ', emoji: '💇', category: '衛生' },
      { label: 'コンタクト/メガネ', emoji: '👓', category: '衛生' },
      { label: '折りたたみ傘', emoji: '🌂', category: 'その他' },
      { label: 'エコバッグ', emoji: '🛍️', category: 'その他' },
      { label: 'ハンカチ/ティッシュ', emoji: '🧻', category: 'その他' },
      { label: 'ビニール袋', emoji: '🛍️', category: 'その他' }
    ]
  },
  {
    id: 'travel-kids',
    name: '旅行（子連れ）',
    description: '子ども連れ向けの持ち物を強化',
    items: [
      { label: '保険証/医療証', emoji: '🏥', category: '必須' },
      { label: '常備薬', emoji: '💊', category: '必須' },
      { label: '連絡先メモ', emoji: '📝', category: '必須' },
      { label: 'おむつ', emoji: '🩲', category: '育児' },
      { label: 'おしりふき', emoji: '🧻', category: '育児' },
      { label: '消毒/除菌', emoji: '🧴', category: '育児' },
      { label: '着替え(多め)', emoji: '👕', category: '育児' },
      { label: 'タオル', emoji: '🧼', category: '育児' },
      { label: 'おやつ', emoji: '🍪', category: '食事' },
      { label: '飲み物', emoji: '🥤', category: '食事' },
      { label: '離乳食(必要なら)', emoji: '🥣', category: '食事' },
      { label: '抱っこ紐', emoji: '🧸', category: '移動' },
      { label: 'ベビーカー', emoji: '🛒', category: '移動' },
      { label: '絵本/おもちゃ', emoji: '📚', category: '移動' }
    ]
  },
  {
    id: 'theme-park',
    name: 'テーマパーク',
    description: '一日中歩く日に最適化',
    items: [
      { label: 'チケット/予約QR', emoji: '🎟️', category: '必須' },
      { label: '財布', emoji: '👛', category: '必須' },
      { label: 'スマホ', emoji: '📱', category: '必須' },
      { label: 'モバイルバッテリー', emoji: '🔋', category: '必須' },
      { label: '歩きやすい靴', emoji: '👟', category: '服装' },
      { label: '帽子', emoji: '🧢', category: '服装' },
      { label: '日焼け止め', emoji: '🧴', category: '服装' },
      { label: '雨具(ポンチョ/傘)', emoji: '🌧️', category: '服装' },
      { label: 'ハンカチ/ティッシュ', emoji: '🧻', category: '衛生' },
      { label: '除菌シート', emoji: '🧽', category: '衛生' },
      { label: '飲み物', emoji: '🥤', category: '食事' },
      { label: '軽食', emoji: '🥪', category: '食事' },
      { label: '絆創膏', emoji: '🩹', category: '衛生' }
    ]
  },
  {
    id: 'music-fes',
    name: '音楽フェス（日帰り）',
    description: '屋外イベント向け',
    items: [
      { label: 'チケット/リストバンド', emoji: '🎫', category: '必須' },
      { label: '身分証', emoji: '🪪', category: '必須' },
      { label: '財布', emoji: '👛', category: '必須' },
      { label: 'スマホ', emoji: '📱', category: '必須' },
      { label: 'モバイルバッテリー', emoji: '🔋', category: '必須' },
      { label: '耳栓', emoji: '🎧', category: '装備' },
      { label: 'タオル', emoji: '🧼', category: '装備' },
      { label: '帽子', emoji: '🧢', category: '装備' },
      { label: 'サングラス', emoji: '🕶️', category: '装備' },
      { label: '日焼け止め', emoji: '🧴', category: '装備' },
      { label: 'ポンチョ', emoji: '🌧️', category: '装備' },
      { label: '替えTシャツ', emoji: '👕', category: '衣類' },
      { label: '羽織り', emoji: '🧥', category: '衣類' },
      { label: '飲み物', emoji: '🥤', category: '食事' },
      { label: '軽食', emoji: '🥪', category: '食事' },
      { label: 'ゴミ袋', emoji: '🗑️', category: 'その他' },
      { label: 'レジャーシート', emoji: '🧺', category: 'その他' }
    ]
  },
  {
    id: 'camp-beginner',
    name: 'キャンプ（デイキャンプ/初心者）',
    description: '日帰りキャンプの基本セット',
    items: [
      { label: '食材', emoji: '🍖', category: '食事' },
      { label: '飲み物', emoji: '🥤', category: '食事' },
      { label: 'クーラーボックス', emoji: '🧊', category: '食事' },
      { label: '紙皿/箸', emoji: '🍽️', category: '食事' },
      { label: '調味料', emoji: '🧂', category: '食事' },
      { label: 'レジャーシート', emoji: '🧺', category: '装備' },
      { label: 'ライト/ランタン', emoji: '🔦', category: '装備' },
      { label: '虫よけ', emoji: '🦟', category: '装備' },
      { label: '日焼け止め', emoji: '🧴', category: '装備' },
      { label: '軍手', emoji: '🧤', category: '装備' },
      { label: 'ゴミ袋', emoji: '🗑️', category: '装備' },
      { label: 'ウェットティッシュ', emoji: '🧻', category: '衛生' },
      { label: 'タオル', emoji: '🧼', category: '衛生' },
      { label: '絆創膏', emoji: '🩹', category: '衛生' }
    ]
  },
  {
    id: 'sea-pool',
    name: '海・プール',
    description: '水辺レジャー向け',
    items: [
      { label: '水着', emoji: '🩱', category: '衣類' },
      { label: 'タオル', emoji: '🧼', category: '衣類' },
      { label: 'サンダル', emoji: '🩴', category: '衣類' },
      { label: '日焼け止め', emoji: '🧴', category: '装備' },
      { label: '帽子', emoji: '🧢', category: '装備' },
      { label: 'ラッシュガード', emoji: '👕', category: '衣類' },
      { label: '着替え', emoji: '👚', category: '衣類' },
      { label: 'ビニール袋', emoji: '🛍️', category: 'その他' },
      { label: '防水ケース(スマホ)', emoji: '📱', category: '装備' },
      { label: '飲み物', emoji: '🥤', category: '食事' },
      { label: 'ゴーグル(必要なら)', emoji: '🥽', category: '装備' }
    ]
  },
  {
    id: 'business-trip',
    name: '出張（ビジネス）',
    description: '仕事道具と身だしなみ中心',
    items: [
      { label: '名刺', emoji: '🪪', category: '必須' },
      { label: 'スマホ', emoji: '📱', category: '必須' },
      { label: '充電器', emoji: '🔌', category: '必須' },
      { label: 'PC', emoji: '💻', category: '必須' },
      { label: '身分証', emoji: '🪪', category: '必須' },
      { label: '財布', emoji: '👛', category: '必須' },
      { label: '替えシャツ', emoji: '👔', category: '衣類' },
      { label: 'ベルト', emoji: '🧷', category: '衣類' },
      { label: '革靴', emoji: '👞', category: '衣類' },
      { label: '歯ブラシ', emoji: '🪥', category: '衛生' },
      { label: '整髪料', emoji: '🧴', category: '衛生' },
      { label: '領収書入れ', emoji: '🗂️', category: '仕事' },
      { label: '筆記用具', emoji: '✏️', category: '仕事' }
    ]
  },
  {
    id: 'onsen-stay',
    name: '温泉・宿泊（旅館/ホテル）',
    description: '温泉宿泊向けの軽装セット',
    items: [
      { label: '予約情報', emoji: '📄', category: '必須' },
      { label: '財布', emoji: '👛', category: '必須' },
      { label: 'スマホ', emoji: '📱', category: '必須' },
      { label: '充電器', emoji: '🔌', category: '必須' },
      { label: '着替え', emoji: '👕', category: '衣類' },
      { label: '下着', emoji: '🩲', category: '衣類' },
      { label: '靴下', emoji: '🧦', category: '衣類' },
      { label: '羽織り', emoji: '🧥', category: '衣類' },
      { label: 'スキンケア', emoji: '🧴', category: '衛生' },
      { label: 'ヘアゴム', emoji: '🎀', category: '衛生' },
      { label: 'ビニール袋', emoji: '🛍️', category: 'その他' }
    ]
  },
  {
    id: 'hiking-light',
    name: '登山・ハイキング（軽め）',
    description: '日帰りハイク向け',
    items: [
      { label: '飲み物', emoji: '🥤', category: '必須' },
      { label: '行動食', emoji: '🍫', category: '必須' },
      { label: '帽子', emoji: '🧢', category: '装備' },
      { label: '雨具', emoji: '🌧️', category: '装備' },
      { label: '地図/スマホ', emoji: '🗺️', category: '装備' },
      { label: 'モバイルバッテリー', emoji: '🔋', category: '装備' },
      { label: '救急セット', emoji: '🩹', category: '安全' },
      { label: '虫よけ', emoji: '🦟', category: '安全' },
      { label: '日焼け止め', emoji: '🧴', category: '安全' },
      { label: 'ライト', emoji: '🔦', category: '安全' },
      { label: '防寒', emoji: '🧥', category: '衣類' },
      { label: '替え靴下', emoji: '🧦', category: '衣類' },
      { label: 'ゴミ袋', emoji: '🗑️', category: 'その他' }
    ]
  },
  {
    id: 'disaster-mini',
    name: '防災（持ち出し袋ミニ）',
    description: '最低限の緊急持ち出しセット',
    items: [
      { label: '水', emoji: '💧', category: '必須' },
      { label: '非常食', emoji: '🥫', category: '必須' },
      { label: 'ライト', emoji: '🔦', category: '必須' },
      { label: 'モバイルバッテリー', emoji: '🔋', category: '必須' },
      { label: '現金(小銭)', emoji: '💰', category: '必須' },
      { label: 'ウェットティッシュ', emoji: '🧻', category: '衛生' },
      { label: '簡易トイレ', emoji: '🚻', category: '衛生' },
      { label: 'マスク', emoji: '😷', category: '衛生' },
      { label: '消毒', emoji: '🧴', category: '衛生' },
      { label: '救急セット', emoji: '🩹', category: '安全' },
      { label: 'アルミブランケット', emoji: '🛌', category: '安全' },
      { label: '笛', emoji: '🪈', category: '安全' },
      { label: '身分証コピー', emoji: '📄', category: '安全' },
      { label: '連絡先メモ', emoji: '📝', category: '安全' }
    ]
  }
]

const now = () => Date.now()

const createId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `${now()}-${Math.random().toString(16).slice(2)}`
}

const sortByOrder = (items: Item[]) => [...items].sort((a, b) => a.order - b.order)

const normalizeOrders = (items: Item[]) =>
  sortByOrder(items).map((item, index) => ({
    ...item,
    order: (index + 1) * 10
  }))

const createEmptyState = (): PackListState => ({
  version: 1,
  started: false,
  selectedTemplateId: null,
  listTitle: DEFAULT_LIST_TITLE,
  items: [],
  updatedAt: now()
})

const buildItemsFromTemplate = (template: Template | null): Item[] => {
  if (!template) return []

  const seen = new Set<string>()
  const unique: TemplateItem[] = []

  template.items.forEach((entry) => {
    const label = entry.label.trim()
    if (!label) return
    const key = label.toLocaleLowerCase('ja-JP')
    if (seen.has(key)) return
    seen.add(key)
    unique.push({ ...entry, label })
  })

  return unique.map((entry, index) => ({
    id: createId(),
    label: entry.label,
    icon: entry.emoji || '📦',
    category: entry.category,
    done: false,
    order: (index + 1) * 10
  }))
}

const isValidState = (value: unknown): value is StoredState => {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<StoredState>

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
      typeof row.order === 'number' &&
      (row.category === undefined || typeof row.category === 'string')
    )
  })
}

const loadStateSafely = (): PackListState | null => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as unknown
    if (!isValidState(parsed)) return null

    const started = typeof parsed.started === 'boolean' ? parsed.started : true
    const selectedTemplateId =
      typeof parsed.selectedTemplateId === 'string' || parsed.selectedTemplateId === null
        ? parsed.selectedTemplateId
        : started
          ? 'none'
          : null

    return {
      version: 1,
      started,
      selectedTemplateId,
      listTitle: parsed.listTitle,
      items: normalizeOrders(parsed.items),
      updatedAt: parsed.updatedAt
    }
  } catch {
    return null
  }
}

const loadItemNotesSafely = (): ItemNotesById => {
  try {
    if (typeof window === 'undefined') return {}
    const raw = window.localStorage.getItem(ITEM_NOTES_STORAGE_KEY)
    if (!raw) return {}

    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}

    const entries = Object.entries(parsed as Record<string, unknown>).filter(
      ([id, value]) => typeof id === 'string' && typeof value === 'string'
    )
    return Object.fromEntries(entries)
  } catch {
    return {}
  }
}

type ItemPhotoRecord = {
  itemId: string
  blob: Blob
  updatedAt: number
}

const openPhotoDatabase = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      reject(new Error('IndexedDB is not available'))
      return
    }

    const request = window.indexedDB.open(PHOTO_DB_NAME, 1)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(PHOTO_STORE_NAME)) {
        db.createObjectStore(PHOTO_STORE_NAME, { keyPath: 'itemId' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'))
  })

const waitForTransaction = (tx: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'))
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'))
  })

const readItemPhotoBlob = async (itemId: string): Promise<Blob | null> => {
  const db = await openPhotoDatabase()
  try {
    const tx = db.transaction(PHOTO_STORE_NAME, 'readonly')
    const store = tx.objectStore(PHOTO_STORE_NAME)
    const request = store.get(itemId) as IDBRequest<ItemPhotoRecord | undefined>

    const record = await new Promise<ItemPhotoRecord | undefined>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('Failed to load photo'))
    })

    await waitForTransaction(tx)
    return record?.blob ?? null
  } finally {
    db.close()
  }
}

const saveItemPhotoBlob = async (itemId: string, blob: Blob): Promise<void> => {
  const db = await openPhotoDatabase()
  try {
    const tx = db.transaction(PHOTO_STORE_NAME, 'readwrite')
    tx.objectStore(PHOTO_STORE_NAME).put({
      itemId,
      blob,
      updatedAt: now()
    } as ItemPhotoRecord)
    await waitForTransaction(tx)
  } finally {
    db.close()
  }
}

const deleteItemPhotoBlob = async (itemId: string): Promise<void> => {
  const db = await openPhotoDatabase()
  try {
    const tx = db.transaction(PHOTO_STORE_NAME, 'readwrite')
    tx.objectStore(PHOTO_STORE_NAME).delete(itemId)
    await waitForTransaction(tx)
  } finally {
    db.close()
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
            category: 'custom',
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

    case 'UPDATE_META':
      return {
        ...state,
        listTitle: action.payload.listTitle,
        updatedAt: now()
      }

    case 'APPLY_TEMPLATE': {
      const selectedTemplateId = action.template ? action.template.id : 'none'
      return {
        version: 1,
        started: true,
        selectedTemplateId,
        listTitle: action.template?.name || DEFAULT_LIST_TITLE,
        items: buildItemsFromTemplate(action.template),
        updatedAt: now()
      }
    }

    default:
      return state
  }
}

const getInitialData = (): { state: PackListState; screen: Screen } => {
  const loaded = loadStateSafely()
  if (!loaded) {
    return {
      state: createEmptyState(),
      screen: 'template'
    }
  }

  return {
    state: loaded,
    screen: loaded.started ? 'checklist' : 'template'
  }
}

function App() {
  const initialData = useMemo(getInitialData, [])
  const [state, dispatch] = useReducer(reducer, initialData.state)
  const [screen, setScreen] = useState<Screen>(initialData.screen)

  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newIcon, setNewIcon] = useState('')
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [showReady, setShowReady] = useState(false)
  const [openedFromChecklist, setOpenedFromChecklist] = useState(false)
  const [itemNotes, setItemNotes] = useState<ItemNotesById>(loadItemNotesSafely)
  const [detailItemId, setDetailItemId] = useState<string | null>(null)
  const [detailNote, setDetailNote] = useState('')
  const [detailPhotoUrl, setDetailPhotoUrl] = useState('')
  const [detailPhotoError, setDetailPhotoError] = useState('')
  const [isDetailPhotoLoading, setIsDetailPhotoLoading] = useState(false)

  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [isTrashNear, setIsTrashNear] = useState(false)
  const [isTrashOver, setIsTrashOver] = useState(false)

  const trashZoneRef = useRef<HTMLButtonElement | null>(null)
  const photoFileInputRef = useRef<HTMLInputElement | null>(null)
  const detailPhotoObjectUrlRef = useRef<string | null>(null)
  const detailPhotoLoadSeqRef = useRef(0)
  const prevItemIdsRef = useRef<Set<string>>(new Set(initialData.state.items.map((item) => item.id)))
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
  const longPressRef = useRef<{
    pointerId: number | null
    itemId: string | null
    startX: number
    startY: number
    timerId: number | null
    triggered: boolean
  }>({
    pointerId: null,
    itemId: null,
    startX: 0,
    startY: 0,
    timerId: null,
    triggered: false
  })

  const sortedItems = useMemo(() => sortByOrder(state.items), [state.items])
  const todoItems = sortedItems.filter((item) => !item.done)
  const doneItems = sortedItems.filter((item) => item.done)
  const allDone = state.items.length > 0 && state.items.every((item) => item.done)
  const selectedIcon = newIcon.trim() || '📦'
  const detailItem = useMemo(() => state.items.find((item) => item.id === detailItemId) ?? null, [state.items, detailItemId])

  const prevAllDone = useRef(allDone)

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  useEffect(() => {
    if (!prevAllDone.current && allDone) {
      setShowReady(true)
      prevAllDone.current = true
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

  useEffect(() => {
    window.localStorage.setItem(ITEM_NOTES_STORAGE_KEY, JSON.stringify(itemNotes))
  }, [itemNotes])

  useEffect(() => {
    const itemIds = new Set(state.items.map((item) => item.id))
    setItemNotes((prev) => {
      const next: ItemNotesById = {}
      let changed = false

      Object.entries(prev).forEach(([itemId, note]) => {
        if (itemIds.has(itemId)) {
          next[itemId] = note
          return
        }
        changed = true
      })

      return changed ? next : prev
    })
  }, [state.items])

  useEffect(() => {
    const currentIds = new Set(state.items.map((item) => item.id))
    const removedIds: string[] = []

    prevItemIdsRef.current.forEach((itemId) => {
      if (!currentIds.has(itemId)) removedIds.push(itemId)
    })
    prevItemIdsRef.current = currentIds

    if (removedIds.length === 0) return

    removedIds.forEach((itemId) => {
      void deleteItemPhotoBlob(itemId).catch(() => undefined)
    })
  }, [state.items])

  useEffect(() => {
    if (!detailItemId) return
    if (state.items.some((item) => item.id === detailItemId)) return
    closeDetailEditor()
  }, [state.items, detailItemId])

  useEffect(() => {
    return () => {
      if (longPressRef.current.timerId !== null) {
        window.clearTimeout(longPressRef.current.timerId)
        longPressRef.current.timerId = null
      }
      if (detailPhotoObjectUrlRef.current) {
        window.URL.revokeObjectURL(detailPhotoObjectUrlRef.current)
        detailPhotoObjectUrlRef.current = null
      }
    }
  }, [])

  const showToast = (message: string) => setToast(message)

  const clearDetailPhotoPreview = () => {
    if (detailPhotoObjectUrlRef.current) {
      window.URL.revokeObjectURL(detailPhotoObjectUrlRef.current)
      detailPhotoObjectUrlRef.current = null
    }
    setDetailPhotoUrl('')
  }

  const loadDetailPhoto = async (itemId: string) => {
    const seq = detailPhotoLoadSeqRef.current + 1
    detailPhotoLoadSeqRef.current = seq
    setIsDetailPhotoLoading(true)
    setDetailPhotoError('')

    try {
      const blob = await readItemPhotoBlob(itemId)
      if (detailPhotoLoadSeqRef.current !== seq) return

      clearDetailPhotoPreview()
      if (!blob) return

      const url = window.URL.createObjectURL(blob)
      detailPhotoObjectUrlRef.current = url
      setDetailPhotoUrl(url)
    } catch {
      if (detailPhotoLoadSeqRef.current !== seq) return
      clearDetailPhotoPreview()
      setDetailPhotoError('写真の読み込みに失敗しました')
    } finally {
      if (detailPhotoLoadSeqRef.current === seq) {
        setIsDetailPhotoLoading(false)
      }
    }
  }

  const openDetailEditor = (itemId: string) => {
    setDetailItemId(itemId)
    setDetailNote(itemNotes[itemId] ?? '')
    setDetailPhotoError('')
    clearDetailPhotoPreview()
    void loadDetailPhoto(itemId)
  }

  const closeDetailEditor = () => {
    detailPhotoLoadSeqRef.current += 1
    setDetailItemId(null)
    setDetailNote('')
    setIsDetailPhotoLoading(false)
    setDetailPhotoError('')
    clearDetailPhotoPreview()
  }

  const closeEditor = () => {
    setIsEditOpen(false)
    setIsIconPickerOpen(false)
  }

  const openEditor = () => {
    setNewIcon('')
    setNewLabel('')
    setError('')
    setIsIconPickerOpen(false)
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
        icon: selectedIcon
      }
    })

    setNewLabel('')
    setNewIcon('')
    setError('')
    setIsIconPickerOpen(false)
  }

  const updateDetailNote = (value: string) => {
    if (!detailItemId) return

    setDetailNote(value)
    setItemNotes((prev) => {
      const next = { ...prev }
      if (value.trim().length === 0) {
        delete next[detailItemId]
      } else {
        next[detailItemId] = value
      }
      return next
    })
  }

  const openPhotoPicker = () => {
    photoFileInputRef.current?.click()
  }

  const handlePhotoFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !detailItemId) return

    setDetailPhotoError('')
    setIsDetailPhotoLoading(true)

    try {
      await saveItemPhotoBlob(detailItemId, file)
      await loadDetailPhoto(detailItemId)
      showToast('写真を保存しました')
    } catch {
      setIsDetailPhotoLoading(false)
      setDetailPhotoError('写真の保存に失敗しました')
    }
  }

  const deleteDetailPhoto = async () => {
    if (!detailItemId) return

    setDetailPhotoError('')
    setIsDetailPhotoLoading(true)

    try {
      await deleteItemPhotoBlob(detailItemId)
      clearDetailPhotoPreview()
      setIsDetailPhotoLoading(false)
      showToast('写真を削除しました')
    } catch {
      setIsDetailPhotoLoading(false)
      setDetailPhotoError('写真の削除に失敗しました')
    }
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

    const nextTitle = input.trim() || DEFAULT_LIST_TITLE
    dispatch({
      type: 'UPDATE_META',
      payload: { listTitle: nextTitle }
    })
  }

  const openTemplateScreen = () => {
    setOpenedFromChecklist(true)
    setScreen('template')
  }

  const applyTemplate = (templateId: string | null) => {
    const selected = templateId ? TEMPLATES.find((template) => template.id === templateId) ?? null : null
    dispatch({ type: 'APPLY_TEMPLATE', template: selected })
    setScreen('checklist')
    setOpenedFromChecklist(false)
    closeEditor()
  }

  const returnToChecklist = () => {
    setScreen('checklist')
    setOpenedFromChecklist(false)
  }

  const resetDragState = () => {
    setDraggingId(null)
    setIsTrashNear(false)
    setIsTrashOver(false)
    pointerDragRef.current = {
      pointerId: null,
      id: null,
      startX: 0,
      startY: 0,
      dragging: false
    }
  }

  const clearLongPressTimer = () => {
    if (longPressRef.current.timerId !== null) {
      window.clearTimeout(longPressRef.current.timerId)
      longPressRef.current.timerId = null
    }
  }

  const resetLongPressState = () => {
    clearLongPressTimer()
    longPressRef.current = {
      pointerId: null,
      itemId: null,
      startX: 0,
      startY: 0,
      timerId: null,
      triggered: false
    }
  }

  const startLongPress = (e: PointerEvent<HTMLButtonElement>, itemId: string) => {
    resetLongPressState()

    longPressRef.current.pointerId = e.pointerId
    longPressRef.current.itemId = itemId
    longPressRef.current.startX = e.clientX
    longPressRef.current.startY = e.clientY
    longPressRef.current.triggered = false
    longPressRef.current.timerId = window.setTimeout(() => {
      if (longPressRef.current.pointerId !== e.pointerId) return
      if (longPressRef.current.itemId !== itemId) return
      if (longPressRef.current.triggered) return

      longPressRef.current.triggered = true
      suppressNextClickRef.current = true
      openDetailEditor(itemId)
      window.setTimeout(() => {
        suppressNextClickRef.current = false
      }, 500)
    }, LONG_PRESS_MS)
  }

  const cancelLongPressOnMove = (e: PointerEvent<HTMLButtonElement>, itemId: string) => {
    if (longPressRef.current.pointerId !== e.pointerId) return
    if (longPressRef.current.itemId !== itemId) return
    if (longPressRef.current.triggered) return

    const distance = Math.hypot(e.clientX - longPressRef.current.startX, e.clientY - longPressRef.current.startY)
    if (distance > 8) {
      clearLongPressTimer()
    }
  }

  const finishLongPress = (e: PointerEvent<HTMLButtonElement>, itemId: string) => {
    if (longPressRef.current.pointerId !== e.pointerId) return
    if (longPressRef.current.itemId !== itemId) return
    resetLongPressState()
  }

  const isPointInTrash = (clientX: number, clientY: number) => {
    const rect = trashZoneRef.current?.getBoundingClientRect()
    if (!rect) return false
    return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom
  }

  const getDistanceToTrash = (clientX: number, clientY: number) => {
    const rect = trashZoneRef.current?.getBoundingClientRect()
    if (!rect) return Number.POSITIVE_INFINITY

    const dx = Math.max(rect.left - clientX, 0, clientX - rect.right)
    const dy = Math.max(rect.top - clientY, 0, clientY - rect.bottom)
    return Math.hypot(dx, dy)
  }

  const deleteItemById = (id: string) => {
    dispatch({ type: 'DELETE_ITEM', id })
    setItemNotes((prev) => {
      if (!(id in prev)) return prev
      const next = { ...prev }
      delete next[id]
      return next
    })
    if (detailItemId === id) {
      closeDetailEditor()
    }
    void deleteItemPhotoBlob(id).catch(() => undefined)
    showToast('アイテムを削除しました')
  }

  const handleItemDragStart = (e: DragEvent<HTMLButtonElement>, id: string) => {
    resetLongPressState()
    setDraggingId(id)
    setIsTrashNear(false)
    setIsTrashOver(false)
    suppressNextClickRef.current = true
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
  }

  const handleItemDrag = (e: DragEvent<HTMLButtonElement>) => {
    if (!draggingId) return
    if (e.clientX <= 0 && e.clientY <= 0) return

    const over = isPointInTrash(e.clientX, e.clientY)
    const near = getDistanceToTrash(e.clientX, e.clientY) <= 96
    setIsTrashOver(over)
    setIsTrashNear(near || over)
  }

  const handleItemDragEnd = () => {
    resetDragState()
    window.setTimeout(() => {
      suppressNextClickRef.current = false
    }, 0)
  }

  const handleTrashDragOver = (e: DragEvent<HTMLButtonElement>) => {
    e.preventDefault()
    if (draggingId) {
      setIsTrashNear(true)
      setIsTrashOver(true)
    }
    e.dataTransfer.dropEffect = 'move'
  }

  const handleTrashDragLeave = () => {
    setIsTrashNear(false)
    setIsTrashOver(false)
  }

  const handleTrashDrop = (e: DragEvent<HTMLButtonElement>) => {
    e.preventDefault()
    const id = draggingId || e.dataTransfer.getData('text/plain')
    if (id) deleteItemById(id)
    resetDragState()
  }

  const handleItemPointerDown = (e: PointerEvent<HTMLButtonElement>, id: string) => {
    startLongPress(e, id)

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
    cancelLongPressOnMove(e, id)
    if (e.pointerType === 'mouse') return

    const current = pointerDragRef.current
    if (current.pointerId !== e.pointerId || current.id !== id) return

    const distance = Math.hypot(e.clientX - current.startX, e.clientY - current.startY)
    if (!current.dragging && distance > 10) {
      current.dragging = true
      suppressNextClickRef.current = true
      setDraggingId(id)
    }

    if (!current.dragging) return

    const over = isPointInTrash(e.clientX, e.clientY)
    const near = getDistanceToTrash(e.clientX, e.clientY) <= 96
    setIsTrashOver(over)
    setIsTrashNear(near || over)
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
    finishLongPress(e, id)
    if (e.pointerType === 'mouse') return
    finishTouchDrag(e, id, true)
  }

  const handleItemPointerCancel = (e: PointerEvent<HTMLButtonElement>, id: string) => {
    finishLongPress(e, id)
    if (e.pointerType === 'mouse') return
    finishTouchDrag(e, id, false)
  }

  const handleItemClick = (id: string) => {
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false
      return
    }

    dispatch({ type: 'TOGGLE_ITEM', id })
  }

  if (screen === 'template') {
    return (
      <main className="app template-screen">
        <header className="header">
          <h1>テンプレートを選択</h1>
          <p>最初に使う持ち物セットを選んでください</p>
        </header>

        <section className="template-list" aria-label="テンプレート一覧">
          <button type="button" className="template-card empty-start" onClick={() => applyTemplate(null)}>
            <h3>テンプレートなし（空で開始）</h3>
            <p>アイテムを手動で追加して始めます</p>
            <span className="template-meta">0項目</span>
          </button>

          {TEMPLATES.map((template) => (
            <button key={template.id} type="button" className="template-card" onClick={() => applyTemplate(template.id)}>
              <h3>{template.name}</h3>
              <p>{template.description}</p>
              <span className="template-meta">{template.items.length}項目</span>
            </button>
          ))}
        </section>

        {openedFromChecklist && (
          <div className="template-actions">
            <button type="button" onClick={returnToChecklist}>
              現在のリストに戻る
            </button>
          </div>
        )}
      </main>
    )
  }

  return (
    <main className="app checklist-screen">
      <header className="header">
        <div className="title-row">
          <h1>{state.listTitle}</h1>
          <button type="button" className="title-edit-button" onClick={editTitle} aria-label="タイトルを編集">
            ✏️
          </button>
          <button type="button" className="template-change-button" onClick={openTemplateScreen}>
            テンプレ変更
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
                onDrag={handleItemDrag}
                onDragEnd={handleItemDragEnd}
                onPointerDown={(e) => handleItemPointerDown(e, item.id)}
                onPointerMove={(e) => handleItemPointerMove(e, item.id)}
                onPointerUp={(e) => handleItemPointerUp(e, item.id)}
                onPointerCancel={(e) => handleItemPointerCancel(e, item.id)}
                onContextMenu={(e) => e.preventDefault()}
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
                onDrag={handleItemDrag}
                onDragEnd={handleItemDragEnd}
                onPointerDown={(e) => handleItemPointerDown(e, item.id)}
                onPointerMove={(e) => handleItemPointerMove(e, item.id)}
                onPointerUp={(e) => handleItemPointerUp(e, item.id)}
                onPointerCancel={(e) => handleItemPointerCancel(e, item.id)}
                onContextMenu={(e) => e.preventDefault()}
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
          className={`icon-button trash-button${isTrashOver ? ' active' : isTrashNear ? ' near' : ''}`}
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

      {detailItem && (
        <div className="modal-overlay" role="presentation" onClick={closeDetailEditor}>
          <section className="modal detail-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="modal-top-row">
              <h3>
                {detailItem.icon} {detailItem.label}
              </h3>
              <button type="button" className="back-button" onClick={closeDetailEditor}>
                戻る
              </button>
            </div>

            <label className="detail-field">
              <span className="detail-label">メモ</span>
              <textarea
                value={detailNote}
                onChange={(e) => updateDetailNote(e.target.value)}
                placeholder="メモを入力（任意）"
                maxLength={500}
              />
            </label>

            <div className="detail-actions">
              <input
                ref={photoFileInputRef}
                type="file"
                accept="image/*"
                className="hidden-file-input"
                onChange={handlePhotoFileChange}
              />
              <button type="button" className="detail-action-button" onClick={openPhotoPicker}>
                写真を追加
              </button>
              {detailPhotoUrl && (
                <button type="button" className="detail-action-button" onClick={deleteDetailPhoto}>
                  写真を削除
                </button>
              )}
            </div>

            <div className="detail-photo-panel">
              {isDetailPhotoLoading ? (
                <p className="detail-status">写真を読み込み中...</p>
              ) : detailPhotoUrl ? (
                <img src={detailPhotoUrl} className="detail-photo-preview" alt={`${detailItem.label} の写真`} />
              ) : (
                <p className="detail-status">写真は未登録です</p>
              )}
              {detailPhotoError && <p className="error">{detailPhotoError}</p>}
            </div>
          </section>
        </div>
      )}

      {isEditOpen && (
        <div className="modal-overlay" role="presentation" onClick={closeEditor}>
          <section className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            {isIconPickerOpen ? (
              <div className="icon-picker-screen">
                <div className="modal-top-row">
                  <h3>アイコンを選択</h3>
                  <button type="button" className="back-button" onClick={() => setIsIconPickerOpen(false)}>
                    戻る
                  </button>
                </div>

                <div id="icon-picker-grid" className="icon-picker picker-screen-grid" role="listbox" aria-label="アイコン候補">
                  {ICON_OPTIONS.map((icon) => (
                    <button
                      key={icon}
                      type="button"
                      className={`icon-option${selectedIcon === icon ? ' selected' : ''}`}
                      onClick={() => {
                        setNewIcon(icon)
                        setIsIconPickerOpen(false)
                      }}
                      aria-label={`アイコン ${icon}`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <h3>アイテムを追加</h3>

                <form className="add-form" onSubmit={addItem}>
                  <div className="add-row">
                    <label className="icon-field">
                      <button
                        type="button"
                        className="icon-picker-trigger"
                        aria-label="アイコンを選択"
                        aria-expanded={isIconPickerOpen}
                        aria-controls="icon-picker-grid"
                        aria-haspopup="listbox"
                        onClick={() => setIsIconPickerOpen(true)}
                      >
                        <span className="icon-picker-current">{selectedIcon}</span>
                      </button>
                    </label>
                    <label className="name-field">
                      <input
                        aria-label="アイテム名"
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

                <button type="button" className="close-button" onClick={closeEditor}>
                  閉じる
                </button>
              </>
            )}
          </section>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </main>
  )
}

export default App
