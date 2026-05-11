'use client'

import { useEffect, useState } from 'react'
import { useFirebase } from '../../../providers'
import { collection, getDocs } from 'firebase/firestore'

export default function AdminConsentTiers() {
  const { db, user } = useFirebase()
  const [tiers, setTiers] = useState([])

  useEffect(() => {
    if (!db || !user) return
    const fetchTiers = async () => {
      const querySnapshot = await getDocs(collection(db, 'consentTiers'))
      const tiersData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      setTiers(tiersData)
    }
    fetchTiers()
  }, [db, user])

  if (!user) return <div>Please sign in to manage consent tiers.</div>

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Consent Tiers</h1>
        <button className="bg-brand text-white px-4 py-2 rounded">New Tier</button>
      </div>
      <div className="space-y-4">
        {tiers.map(tier => (
          <div key={tier.id} className="p-4 border rounded">
            <h2 className="font-bold">{tier.name}</h2>
            <p className="text-text-secondary">{tier.description}</p>
            <div className="text-sm text-text-secondary mt-2">
              <span>Enabled: {tier.enabled ? 'Yes' : 'No'}</span>
              <span className="ml-4">Retention: {tier.retentionDays} days</span>
            </div>
            <button className="mt-4 border border-brand text-brand px-4 py-2 rounded">Edit</button>
          </div>
        ))}
      </div>
    </div>
  )
}
