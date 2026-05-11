"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, getFirestore, setDoc, collection, addDoc } from "firebase/firestore";
import { app } from "../../../../firebase/firebase";
import { useRouter } from "next/navigation";

export default function EditTransparency({ params }: { params: { id: string } }) {
  const [entry, setEntry] = useState({ category: "announcement", title: "", body: "", state: "draft" });
  const router = useRouter();
  const isNew = params.id === "new";

  useEffect(() => {
    if (!isNew) {
      const fetchEntry = async () => {
        const db = getFirestore(app);
        const entryDoc = await getDoc(doc(db, "transparency", params.id));
        if (entryDoc.exists()) {
          setEntry(entryDoc.data());
        }
      };
      fetchEntry();
    }
  }, [isNew, params.id]);

  const handleChange = (e) => {
    setEntry({ ...entry, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const db = getFirestore(app);
    if (isNew) {
        const transparencyCol = collection(db, "transparency");
        await addDoc(transparencyCol, entry);
    } else {
      await setDoc(doc(db, "transparency", params.id), entry);
    }
    router.push("/admin/transparency");
  };

  return (
    <div>
      <h1 className="text-4xl font-bold mb-4">{isNew ? "New Transparency Entry" : "Edit Transparency Entry"}</h1>
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="title">Title</label>
          <input type="text" name="title" id="title" value={entry.title} onChange={handleChange} required />
        </div>
        <div className="mb-4">
            <label htmlFor="category">Category</label>
            <select name="category" id="category" value={entry.category} onChange={handleChange}>
                <option value="policy_change">Policy Change</option>
                <option value="subprocessor">Sub-processor</option>
                <option value="incident">Incident</option>
                <option value="audit">Audit</option>
                <option value="announcement">Announcement</option>
            </select>
        </div>
        <div className="mb-4">
          <label htmlFor="body">Body</label>
          <textarea name="body" id="body" value={entry.body} onChange={handleChange} required />
        </div>
        <div className="mb-4">
          <label htmlFor="state">State</label>
          <select name="state" id="state" value={entry.state} onChange={handleChange}>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </div>
        <button type="submit" className="bg-blue-500 text-white p-2 rounded">
          {isNew ? "Create" : "Update"}
        </button>
      </form>
    </div>
  );
}
