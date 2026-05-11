'use client'

import { useEffect, useState } from 'react'
import { useFirebase } from '../../providers'
import { collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore'
import { remark } from 'remark'
import html from 'remark-html'

async function markdownToHtml(markdown) {
  const result = await remark().use(html).process(markdown)
  return result.toString()
}

export default function PolicyPage({ params }) {
  const { db } = useFirebase()
  const [version, setVersion] = useState(null)
  const [content, setContent] = useState('')

  useEffect(() => {
    if (!db) return
    const fetchPolicy = async () => {
      const q = query(
        collection(db, `policyDocs`), 
        where('slug', '==', params.slug)
      );
      const policyDocsSnap = await getDocs(q);
      if (policyDocsSnap.empty) return;
      const policyDoc = policyDocsSnap.docs[0];

      const versionsQuery = query(
        collection(db, `policyDocs/${policyDoc.id}/versions`),
        where('state', '==', 'published'),
        orderBy('publishedAt', 'desc'),
        limit(1)
      )
      const versionsSnap = await getDocs(versionsQuery)
      if (versionsSnap.empty) return;
      const latestVersion = versionsSnap.docs[0].data();
      setVersion(latestVersion)
      const htmlContent = await markdownToHtml(latestVersion.content.body)
      setContent(htmlContent)
    }
    fetchPolicy()
  }, [db, params.slug])

  if (!version) return <div>Loading...</div>

  return (
    <div>
      <h1 className="text-4xl font-bold">{version.title}</h1>
      <div className="flex items-center gap-4 text-text-secondary mt-2">
        <span>Version {version.version}</span>
        <span>Effective: {new Date(version.effectiveAt.seconds * 1000).toLocaleDateString()}</span>
        <span>Published: {new Date(version.publishedAt.seconds * 1000).toLocaleDateString()}</span>
      </div>
      <div className="prose mt-8" dangerouslySetInnerHTML={{ __html: content }} />
      <div className="mt-8">
          <h2 class="text-2xl font-bold">Changelog</h2>
          <p>{version.content.changelog}</p>
      </div>
    </div>
  )
}
