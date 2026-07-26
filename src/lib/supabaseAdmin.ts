import 'server-only'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// RLSを無視してDBへ直接アクセスするための管理者クライアント。
// サーバー側(Route Handler/Server Component)からのみインポートすること。
// ブラウザ側コードに混入した場合はビルド時にserver-onlyがエラーを出す
export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
})
