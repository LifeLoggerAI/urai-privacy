'use client'

import { useEffect, useState } from 'react'
import { useFirebase } from '../../../providers'
import { collection, getDocs } from 'firebase/firestore'
import Link from 'next/link'

export default function AdminPolicies() {
  const { db, user } = useFirebase()
  const [policies, setPolicies] = useState([])

  useEffect(() => {
    if (!db || !user) return
    const fetchPolicies = async () => {
      const querySnapshot = await getDocs(collection(db, 'policyDocs'))
      const policiesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      setPolicies(policiesData)
    }
    fetchPolicies()
  }, [db, user])

  if (!user) return <div>Please sign in to manage policies.</div>

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Policies</h1>
        {/* In a real app, this would open a modal or go to a new page */}
        <button className="bg-brand text-white px-4 py-2 rounded">New Policy</button>
      </div>
      <div className="space-y-4">
        {policies.map(policy => (
          <Link href={`/admin/policies/${policy.id}`} key={policy.id} className="block p-4 border rounded hover:bg-surface">
            <h2 className="font-bold">{policy.title}</h2>
            <p className="text-text-secondary">{policy.summary}</p>
            <span className="text-sm text-text-secondary">Status: {policy.status}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
