'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import MarkAsBorrowedButton from './MarkAsBorrowedButton'
import MarkAsReturnedButton from './MarkAsReturnedButton'
import DeleteButton from './DeleteButton'

export type LoanRecord = {
  id: number
  title: string
  author: string | null
  library: string
  loan_date: string | null
  return_date: string | null
  status: string | null
  rank: string | null
  pickup_library: string | null
  pickup_deadline: string | null
  due_date: string | null
  renewed: boolean | null
}

// 返却期限/取置期限までの残り日数を計算する(期限日は00:00基準で比較する)
function daysUntilDue(dueDate: string | null): number | null {
  if (!dueDate) return null
  const due = new Date(`${dueDate}T00:00:00`)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function DueBadge({ dueDate }: { dueDate: string | null }) {
  const days = daysUntilDue(dueDate)
  if (days === null) return null

  const label =
    days < 0 ? `期限切れ ${Math.abs(days)}日超過` : days === 0 ? '今日が期限' : `あと${days}日`
  const colorClass =
    days < 0
      ? 'bg-red-600 text-white'
      : days <= 3
        ? 'bg-red-100 text-red-700'
        : days <= 7
          ? 'bg-yellow-100 text-yellow-800'
          : 'bg-gray-100 text-gray-600'

  return (
    <span
      className={`inline-block text-xs font-bold px-2 py-0.5 rounded ${colorClass}`}
    >
      {label}
    </span>
  )
}

// 図書館ごとに色分けして見分けやすくする
const LIBRARY_COLORS: Record<string, string> = {
  横浜市立図書館: 'bg-blue-100 text-blue-800',
  横須賀図書館: 'bg-green-100 text-green-800',
  神奈川県立図書館: 'bg-purple-100 text-purple-800',
}

function RenewBadge({ renewed }: { renewed: boolean | null }) {
  if (renewed === null) return null
  return (
    <span
      className={`inline-block text-xs font-medium px-2 py-0.5 rounded ${
        renewed ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'
      }`}
    >
      {renewed ? '延長可能' : '延長不可'}
    </span>
  )
}

function LibraryBadge({ library }: { library: string }) {
  const colorClass = LIBRARY_COLORS[library] ?? 'bg-gray-100 text-gray-700'
  return (
    <span
      className={`inline-block text-xs font-medium px-2 py-0.5 rounded ${colorClass}`}
    >
      {library}
    </span>
  )
}

export default function RecordList({ records }: { records: LoanRecord[] }) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleBulkReturn() {
    const ids = Array.from(selected)
    if (ids.length === 0) return

    setBusy(true)
    setError(null)
    const res = await fetch('/api/records/bulk-return', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
    setBusy(false)

    if (!res.ok) {
      const body = await res.json().catch(() => null)
      setError(body?.error ?? '更新に失敗しました')
    } else {
      setSelected(new Set())
      router.refresh()
    }
  }

  async function handleBulkDelete() {
    const ids = Array.from(selected)
    if (ids.length === 0) return
    if (
      !window.confirm(
        `選択した${ids.length}件を削除しますか?この操作は取り消せません。`
      )
    ) {
      return
    }

    setBusy(true)
    setError(null)
    const res = await fetch('/api/records/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
    setBusy(false)

    if (!res.ok) {
      const body = await res.json().catch(() => null)
      setError(body?.error ?? '削除に失敗しました')
    } else {
      setSelected(new Set())
      router.refresh()
    }
  }

  return (
    <div>
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-3 p-2 bg-gray-50 border rounded">
          <span className="text-sm text-gray-600">
            {selected.size}件選択中
          </span>
          <button
            onClick={handleBulkReturn}
            disabled={busy}
            className="text-xs bg-gray-700 text-white rounded px-2 py-1 disabled:opacity-50"
          >
            選択した本を返却した
          </button>
          <button
            onClick={handleBulkDelete}
            disabled={busy}
            className="text-xs bg-red-700 text-white rounded px-2 py-1 disabled:opacity-50"
          >
            選択した本を削除
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-600 mb-2">エラー: {error}</p>}

      <ul className="space-y-3">
        {records.map((r) => (
          <li key={r.id} className="border-b pb-2">
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={selected.has(r.id)}
                onChange={() => toggle(r.id)}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="font-medium">{r.title}</div>
                {r.status === '予約中' ? (
                  <div className="text-sm text-gray-500">
                    <div className="flex flex-wrap items-center gap-2">
                      <LibraryBadge library={r.library} />
                      <span>
                        予約日: {r.loan_date} ・ 状況/順位: {r.rank} ・
                        受取館: {r.pickup_library}
                        {r.pickup_deadline
                          ? ` ・ 取置期限: ${r.pickup_deadline}`
                          : ''}
                      </span>
                      <DueBadge dueDate={r.pickup_deadline} />
                    </div>
                    <div className="flex flex-wrap gap-2 mt-1">
                      <MarkAsBorrowedButton id={r.id} />
                      <DeleteButton id={r.id} title={r.title} />
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">
                    <div className="flex flex-wrap items-center gap-2">
                      <LibraryBadge library={r.library} />
                      <span>
                        {r.author} ・ 貸出日: {r.loan_date}
                        {r.return_date
                          ? ` ・ 返却日: ${r.return_date}`
                          : ' ・ 未返却'}
                        {!r.return_date
                          ? ` ・ 返却期限: ${r.due_date ?? '不明'}`
                          : ''}
                      </span>
                      {!r.return_date && <DueBadge dueDate={r.due_date} />}
                      {!r.return_date && <RenewBadge renewed={r.renewed} />}
                    </div>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {!r.return_date && <MarkAsReturnedButton id={r.id} />}
                      <DeleteButton id={r.id} title={r.title} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
