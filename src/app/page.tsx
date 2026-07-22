import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

type LoanRecord = {
  id: number
  title: string
  author: string | null
  library: string
  loan_date: string | null
  return_date: string | null
}

type SearchParams = { library?: string; status?: string }

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const { library, status } = await searchParams

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
    .select('id, title, author, library, loan_date, return_date', {
      count: 'exact',
    })
    .order('loan_date', { ascending: false })
    .limit(50)

  if (library) {
    query = query.eq('library', library)
  }
  if (status === 'active') {
    query = query.is('return_date', null)
  } else if (status === 'returned') {
    query = query.not('return_date', 'is', null)
  }

  const { data: records, count, error } = await query

  return (
    <main className="min-h-screen p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">貸出台帳</h1>
      <p className="text-gray-600 mb-6">
        該当件数: {count ?? '?'}件(最大50件を表示)
      </p>

      <form method="get" className="flex flex-wrap gap-3 mb-6 items-end">
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
            defaultValue={status ?? ''}
            className="border rounded px-2 py-1"
          >
            <option value="">すべて</option>
            <option value="active">貸出中(未返却)</option>
            <option value="returned">返却済み</option>
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

      <ul className="space-y-3">
        {records?.map((r: LoanRecord) => (
          <li key={r.id} className="border-b pb-2">
            <div className="font-medium">{r.title}</div>
            <div className="text-sm text-gray-500">
              {r.author} ・ {r.library} ・ 貸出日: {r.loan_date}
              {r.return_date ? ` ・ 返却日: ${r.return_date}` : ' ・ 未返却'}
            </div>
          </li>
        ))}
      </ul>
    </main>
  )
}
