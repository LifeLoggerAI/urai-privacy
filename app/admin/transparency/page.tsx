'use client'

import { useEffect, useState } from 'react'
import { useFirebase } from '../../../providers'
import { collection, getDocs } from 'firebase/firestore'

export default function AdminTransparency() {
  const { db, user } = useFirebase()
  const [entries, setEntries] = useState([])

  useEffect(() => {
    if (!db || !user) return
    const fetchEntries = async () => {
      const querySnapshot = await getDocs(collection(db, 'transparency'))
      const entriesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      setEntries(entriesData)
    }
    fetchEntries()
  }, [db, user])

  if (!user) return <div>Please sign in to manage transparency entries.</div>

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Transparency</h1>
        <button className="bg-brand text-white px-4 py-2 rounded">New Entry</button>
      </div>
      <div className="space-y-4">
        {entries.map(entry => (
          <div key={entry.id} className="p-4 border rounded">
            <h2 className="font-bold">{entry.title}</h2>
            <p className="text-text-secondary">{entry.category}</p>
            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${entry.state === 'published' ? 'bg-green-200 text-green-800' : 'bg-yellow-200 text-yellow-800'}`}>
              {entry.state}
            </span>
            <button className="mt-4 border border-brand text-brand px-4 py-2 rounded">Edit</button>
          </div>
        ))}
      </div>
    </div>
  )
}
