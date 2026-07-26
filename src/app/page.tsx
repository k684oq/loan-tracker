import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import RecordList from './RecordList'
import LogoutButton from './LogoutButton'

export const dynamic = 'force-dynamic'

type SearchParams = { library?: string; status?: string; q?: string }

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const { library, status: statusParam, q } = await searchParams
  // 初回アクセス(状態が未指定)時は「貸出中(未返却)」をデフォルト表示にする
  const status = statusParam ?? 'active'

  // フィルタ用の図書館一覧を取得(重複除去)
  const { data: libraryRows } = await supabase
    .from('loan_records')
    .select('library')

  const libraries = Array.from(
    new Set((libraryRows ?? []).map((r) => r.library))
  ).sort()

  // メインクエリにフィルタ条件を組み立てる
  let query = supabase
    .from('loan_records')
    .select(
      'id, title, author, library, loan_date, return_date, status, rank, pickup_library, pickup_deadline, due_date',
      { count: 'exact' }
    )
    .limit(50)

  if (status === 'reserved') {
    // 予約中は「取置期限あり(受取可能)」を先頭、期限が近い順に並べる
    query = query
      .order('pickup_deadline', { ascending: true, nullsFirst: false })
      .order('loan_date', { ascending: true })
  } else {
    // それ以外は返却期限が近い順(未設定は末尾)、次点で貸出日が新しい順に並べる
    query = query
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('loan_date', { ascending: false })
  }

  if (library) {
    query = query.eq('library', library)
  }
  if (q) {
    query = query.ilike('title', `%${q}%`)
  }
  if (status === 'active') {
    // 返却期限が不明なレコードはCSV取込時の履歴データで実際の貸出中ではないため除外する
    query = query
      .is('return_date', null)
      .neq('status', '予約中')
      .not('due_date', 'is', null)
  } else if (status === 'reserved') {
    query = query.eq('status', '予約中')
  }

  const { data: records, count, error } = await query

  const exportParams = new URLSearchParams()
  if (library) exportParams.set('library', library)
  exportParams.set('status', status)
  if (q) exportParams.set('q', q)

  return (
    <main className="min-h-screen p-8 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold">貸出台帳</h1>
        <LogoutButton />
      </div>
      <div className="flex gap-4 mb-4">
        <Link href="/add" className="inline-block text-sm text-blue-600 underline">
          + 新規登録
        </Link>
        <a
          href={`/api/export?${exportParams.toString()}`}
          className="inline-block text-sm text-blue-600 underline"
        >
          CSVダウンロード
        </a>
      </div>
      <p className="text-gray-600 mb-6">
        該当件数: {count ?? '?'}件(最大50件を表示)
      </p>

      <form method="get" className="flex flex-wrap gap-3 mb-6 items-end">
        <div>
          <label className="block text-sm text-gray-600 mb-1">書名検索</label>
          <input
            type="text"
            name="q"
            defaultValue={q ?? ''}
            placeholder="書名の一部を入力"
            className="border rounded px-2 py-1"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">図書館</label>
          <select
            name="library"
            defaultValue={library ?? ''}
            className="border rounded px-2 py-1"
          >
            <option value="">すべて</option>
            {libraries.map((lib) => (
              <option key={lib} value={lib}>
                {lib}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">状態</label>
          <select
            name="status"
            defaultValue={status}
            className="border rounded px-2 py-1"
          >
            <option value="">すべて</option>
            <option value="active">貸出中(未返却)</option>
            <option value="reserved">予約中</option>
          </select>
        </div>

        <button
          type="submit"
          className="bg-gray-800 text-white rounded px-4 py-1.5"
        >
          絞り込む
        </button>
      </form>

      {error && (
        <p className="text-red-600 mb-4">エラー: {error.message}</p>
      )}

      <RecordList records={records ?? []} />
    </main>
  )
}
