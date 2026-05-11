'use client'

import { useEffect, useState } from 'react'
import { useFirebase } from '../providers'
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore'

export default function Transparency() {
  const { db } = useFirebase()
  const [entries, setEntries] = useState([])

  useEffect(() => {
    if (!db) return
    const fetchEntries = async () => {
      const q = query(
        collection(db, 'transparency'), 
        where('state', '==', 'published'),
        orderBy('publishedAt', 'desc')
      )
      const querySnapshot = await getDocs(q)
      const entriesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      setEntries(entriesData)
    }
    fetchEntries()
  }, [db])

  return (
    <div>
      <h1 className="text-2xl font-bold">Transparency Timeline</h1>
      <div className="space-y-8 mt-8">
        {entries.map(entry => (
          <div key={entry.id} className="p-4 border rounded">
            <h2 className="font-bold">{entry.title}</h2>
            <p className="text-sm text-text-secondary">{new Date(entry.publishedAt.seconds * 1000).toLocaleDateString()} | {entry.category}</p>
            <p className="mt-4">{entry.body}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
