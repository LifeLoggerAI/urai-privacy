'use client'

import { useEffect, useState } from 'react'
import { useFirebase } from '../../../providers'
import { collection, getDocs } from 'firebase/firestore'

export default function AdminDataRights() {
  const { db, user } = useFirebase()
  const [requests, setRequests] = useState([])

  useEffect(() => {
    if (!db || !user) return
    const fetchRequests = async () => {
      const querySnapshot = await getDocs(collection(db, 'dataRights'))
      const requestsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      setRequests(requestsData)
    }
    fetchRequests()
  }, [db, user])

  if (!user) return <div>Please sign in to view data rights requests.</div>

  return (
    <div>
      <h1 className="text-2xl font-bold">Data Rights Requests</h1>
      <div className="space-y-4 mt-4">
        {requests.map(request => (
          <div key={request.id} className="p-4 border rounded">
            <div className="flex justify-between items-center">
              <h2 className="font-bold">{request.type} Request</h2>
              <span className={`px-2 py-1 text-xs font-semibold rounded-full bg-gray-200 text-gray-800`}>
                {request.status}
              </span>
            </div>
            <p className="text-text-secondary">From: {request.requesterName} ({request.requesterEmail})</p>
            <button className="mt-4 border border-brand text-brand px-4 py-2 rounded">View Details</button>
          </div>
        ))}
      </div>
    </div>
  )
}
