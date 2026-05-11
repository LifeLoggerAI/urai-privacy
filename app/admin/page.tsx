'use client'

import { useFirebase } from '../providers'

export default function AdminDashboard() {
  const { user } = useFirebase()

  if (!user) return <div>Please sign in to view the admin dashboard.</div>

  return (
    <div>
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>
      <p>Welcome, {user.displayName}!</p>
    </div>
  )
}
