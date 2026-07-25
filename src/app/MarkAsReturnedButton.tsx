'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function MarkAsReturnedButton({ id }: { id: number }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setLoading(true)
    setError(null)

    const today = new Date().toISOString().slice(0, 10)
    const { error } = await supabase
      .from('loan_records')
      .update({ return_date: today })
      .eq('id', id)

    setLoading(false)

    if (error) {
      setError(error.message)
    } else {
      router.refresh()
    }
  }

  return (
    <div className="mt-1">
      <button
        onClick={handleClick}
        disabled={loading}
        className="text-xs bg-gray-700 text-white rounded px-2 py-1 disabled:opacity-50"
      >
        {loading ? '更新中...' : '返却した'}
      </button>
      {error && <p className="text-xs text-red-600 mt-1">エラー: {error}</p>}
    </div>
  )
}
