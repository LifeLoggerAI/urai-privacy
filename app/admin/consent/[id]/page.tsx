"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, getFirestore, setDoc, collection, addDoc } from "firebase/firestore";
import { app } from "../../../../firebase/firebase";
import { useRouter } from "next/navigation";

export default function EditConsentTier({ params }: { params: { id: string } }) {
  const [tier, setTier] = useState({ name: "", description: "", enabled: false, scopes: [], dataCategories: [], retentionDays: 0 });
  const router = useRouter();
  const isNew = params.id === "new";

  useEffect(() => {
    if (!isNew) {
      const fetchTier = async () => {
        const db = getFirestore(app);
        const tierDoc = await getDoc(doc(db, "consentTiers", params.id));
        if (tierDoc.exists()) {
          setTier(tierDoc.data());
        }
      };
      fetchTier();
    }
  }, [isNew, params.id]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === "checkbox") {
      setTier({ ...tier, [name]: checked });
    } else if (name === "scopes" || name === "dataCategories") {
        setTier({ ...tier, [name]: value.split(",").map(s => s.trim()) });
    }else {
      setTier({ ...tier, [name]: value });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const db = getFirestore(app);
    if (isNew) {
        const consentTiersCol = collection(db, "consentTiers");
        await addDoc(consentTiersCol, tier);
    } else {
      await setDoc(doc(db, "consentTiers", params.id), tier);
    }
    router.push("/admin/consent");
  };

  return (
    <div>
      <h1 className="text-4xl font-bold mb-4">{isNew ? "New Consent Tier" : "Edit Consent Tier"}</h1>
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="name">Name</label>
          <input type="text" name="name" id="name" value={tier.name} onChange={handleChange} required />
        </div>
        <div className="mb-4">
          <label htmlFor="description">Description</label>
          <textarea name="description" id="description" value={tier.description} onChange={handleChange} required />
        </div>
        <div className="mb-4">
          <label htmlFor="enabled">Enabled</label>
          <input type="checkbox" name="enabled" id="enabled" checked={tier.enabled} onChange={handleChange} />
        </div>
        <div className="mb-4">
            <label htmlFor="scopes">Scopes (comma-separated)</label>
            <input type="text" name="scopes" id="scopes" value={tier.scopes.join(", ")} onChange={handleChange} />
        </div>
        <div className="mb-4">
            <label htmlFor="dataCategories">Data Categories (comma-separated)</label>
            <input type="text" name="dataCategories" id="dataCategories" value={tier.dataCategories.join(", ")} onChange={handleChange} />
        </div>
        <div className="mb-4">
            <label htmlFor="retentionDays">Retention Days</label>
            <input type="number" name="retentionDays" id="retentionDays" value={tier.retentionDays} onChange={handleChange} />
        </div>
        <button type="submit" className="bg-blue-500 text-white p-2 rounded">
          {isNew ? "Create" : "Update"}
        </button>
      </form>
    </div>
  );
}
