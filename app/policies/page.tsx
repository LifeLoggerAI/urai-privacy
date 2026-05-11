'use client'

import { useEffect, useState } from 'react'
import { useFirebase } from '../providers'
import { collection, query, where, getDocs } from 'firebase/firestore'
import Link from 'next/link'

export default function Policies() {
  const { db } = useFirebase()
  const [policies, setPolicies] = useState([])

  useEffect(() => {
    if (!db) return
    const fetchPolicies = async () => {
      const q = query(collection(db, 'policyDocs'), where('status', '==', 'active'))
      const querySnapshot = await getDocs(q)
      const policiesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      setPolicies(policiesData)
    }
    fetchPolicies()
  }, [db])

  return (
    <div>
      <h1 className="text-2xl font-bold">Our Policies</h1>
      <div className="space-y-4 mt-4">
        {policies.map(policy => (
          <Link href={`/policies/${policy.slug}`} key={policy.id} className="block p-4 border rounded hover:bg-surface">
            <h2 className="font-bold">{policy.title}</h2>
            <p className="text-text-secondary">{policy.summary}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
