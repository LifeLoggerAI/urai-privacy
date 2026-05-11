'use client'

import { useEffect, useState } from 'react'
import { useFirebase } from '../../../providers'
import { collection, getDocs } from 'firebase/firestore'

export default function AdminUsers() {
  const { db, user } = useFirebase()
  const [users, setUsers] = useState([])

  useEffect(() => {
    if (!db || !user) return
    const fetchUsers = async () => {
      // In a real app, you would have security rules
      // to ensure only admins can fetch all users.
      const querySnapshot = await getDocs(collection(db, 'privacyUsers'))
      const usersData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      setUsers(usersData)
    }
    fetchUsers()
  }, [db, user])

  // In a real app, you'd also check the user's role.
  if (!user) return <div>You do not have permission to view this page.</div>

  return (
    <div>
      <h1 className="text-2xl font-bold">Users</h1>
      <div className="space-y-4 mt-4">
        {users.map(u => (
          <div key={u.id} className="p-4 border rounded">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="font-bold">{u.displayName}</h2>
                    <p className="text-text-secondary">{u.email}</p>
                </div>
                <div>
                    <span className="text-text-secondary mr-4">{u.role}</span>
                    <button className="border border-brand text-brand px-4 py-2 rounded">Edit</button>
                </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
