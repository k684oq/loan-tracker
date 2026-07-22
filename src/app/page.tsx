import { supabase } from '@/lib/supabase'

type LoanRecord = {
  id: number
  title: string
  author: string | null
  library: string
  loan_date: string | null
  return_date: string | null
}

export default async function Home() {
  const { count } = await supabase
    .from('loan_records')
    .select('*', { count: 'exact', head: true })

  const { data: recentRecords, error } = await supabase
    .from('loan_records')
    .select('id, title, author, library, loan_date, return_date')
    .order('loan_date', { ascending: false })
    .limit(10)

  return (
    <main className="min-h-screen p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">貸出台帳</h1>
      <p className="text-gray-600 mb-6">
        Supabase接続確認 — 全{count ?? '?'}件
      </p>

      {error && (
        <p className="text-red-600 mb-4">
          エラー: {error.message}
        </p>
      )}

      <ul className="space-y-3">
        {recentRecords?.map((r: LoanRecord) => (
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
