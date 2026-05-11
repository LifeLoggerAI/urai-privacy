"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, getFirestore, setDoc } from "firebase/firestore";
import { app } from "../../../../firebase/firebase";
import { useRouter } from "next/navigation";

export default function EditDataRightsRequest({ params }: { params: { id: string } }) {
  const [request, setRequest] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const fetchRequest = async () => {
      const db = getFirestore(app);
      const requestDoc = await getDoc(doc(db, "dataRights", params.id));
      if (requestDoc.exists()) {
        setRequest(requestDoc.data());
      }
    };
    fetchRequest();
  }, [params.id]);

  const handleChange = (e) => {
    setRequest({ ...request, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const db = getFirestore(app);
    await setDoc(doc(db, "dataRights", params.id), request);
    router.push("/admin/requests");
  };

  if (!request) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <h1 className="text-4xl font-bold mb-4">Data Rights Request</h1>
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <p><strong>Requester:</strong> {request.requesterName} ({request.requesterEmail})</p>
          <p><strong>Type:</strong> {request.type}</p>
          <p><strong>Details:</strong> {request.details}</p>
        </div>
        <div className="mb-4">
          <label htmlFor="status">Status</label>
          <select name="status" id="status" value={request.status} onChange={handleChange}>
            <option value="submitted">Submitted</option>
            <option value="in_review">In Review</option>
            <option value="verified">Verified</option>
            <option value="fulfilled">Fulfilled</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        <div className="mb-4">
          <label htmlFor="caseNotes">Case Notes</label>
          <textarea name="caseNotes" id="caseNotes" value={request.caseNotes || ''} onChange={handleChange} />
        </div>
        <button type="submit" className="bg-blue-500 text-white p-2 rounded">
          Update
        </button>
      </form>
    </div>
  );
}
